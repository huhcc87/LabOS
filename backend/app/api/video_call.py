"""
WebRTC Video Conferencing Module
Self-hosted, no external dependencies required
"""
import json
import uuid
from datetime import datetime
from typing import Dict, List, Set
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import User, LabMeeting
from app.services.auth import get_current_user

router = APIRouter(prefix="/video", tags=["video"])


# ─── DATA MODELS ────────────────────────────────────────────────────────────────

class VideoRoom:
    def __init__(self, room_id: str, meeting_id: int = None, host_id: int = None):
        self.room_id = room_id
        self.meeting_id = meeting_id
        self.host_id = host_id
        self.participants: Dict[str, dict] = {}  # socket_id -> participant info
        self.websockets: Dict[str, WebSocket] = {}  # socket_id -> websocket
        self.chat_messages: List[dict] = []
        self.transcriptions: List[dict] = []
        self.created_at = datetime.utcnow()
        self.is_recording = False
        self.whiteboard_state: List[dict] = []
        self.shared_documents: List[dict] = []

    def to_dict(self):
        return {
            "room_id": self.room_id,
            "meeting_id": self.meeting_id,
            "host_id": self.host_id,
            "participants": list(self.participants.values()),
            "participant_count": len(self.participants),
            "created_at": self.created_at.isoformat(),
            "is_recording": self.is_recording,
        }


# ─── ROOM MANAGER ───────────────────────────────────────────────────────────────

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, VideoRoom] = {}

    def create_room(self, meeting_id: int = None, host_id: int = None) -> VideoRoom:
        room_id = str(uuid.uuid4())[:8]
        room = VideoRoom(room_id, meeting_id, host_id)
        self.rooms[room_id] = room
        return room

    def get_room(self, room_id: str) -> VideoRoom:
        return self.rooms.get(room_id)

    def delete_room(self, room_id: str):
        if room_id in self.rooms:
            del self.rooms[room_id]

    def get_room_for_meeting(self, meeting_id: int) -> VideoRoom:
        for room in self.rooms.values():
            if room.meeting_id == meeting_id:
                return room
        return None


room_manager = RoomManager()


# ─── REST API ENDPOINTS ─────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    meeting_id: int = None


class JoinRoomRequest(BaseModel):
    room_id: str
    display_name: str


@router.post("/rooms")
def create_video_room(
    data: CreateRoomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new video room, optionally linked to a meeting"""
    if data.meeting_id:
        # Check if meeting exists
        meeting = db.query(LabMeeting).filter(LabMeeting.id == data.meeting_id).first()
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")

        # Check if room already exists for this meeting
        existing = room_manager.get_room_for_meeting(data.meeting_id)
        if existing:
            return existing.to_dict()

    room = room_manager.create_room(data.meeting_id, current_user.id)
    return room.to_dict()


@router.get("/rooms/{room_id}")
def get_video_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get room information"""
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.to_dict()


@router.get("/rooms/meeting/{meeting_id}")
def get_room_for_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
):
    """Get or check if a room exists for a meeting"""
    room = room_manager.get_room_for_meeting(meeting_id)
    if room:
        return room.to_dict()
    return {"exists": False, "room_id": None}


@router.delete("/rooms/{room_id}")
def delete_video_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a video room (host only)"""
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only host can delete room")
    room_manager.delete_room(room_id)
    return {"detail": "Room deleted"}


@router.get("/rooms/{room_id}/chat")
def get_chat_history(
    room_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get chat history for a room"""
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.chat_messages


@router.get("/rooms/{room_id}/transcription")
def get_transcription(
    room_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get AI transcription for a room"""
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.transcriptions


# ─── WEBRTC SIGNALING SERVER ────────────────────────────────────────────────────

@router.websocket("/ws/{room_id}")
async def video_websocket(
    websocket: WebSocket,
    room_id: str,
):
    """WebSocket endpoint for WebRTC signaling"""
    await websocket.accept()

    room = room_manager.get_room(room_id)
    if not room:
        await websocket.close(code=4004, reason="Room not found")
        return

    socket_id = str(uuid.uuid4())[:12]
    participant_info = {
        "socket_id": socket_id,
        "display_name": "Guest",
        "user_id": None,
        "is_muted": False,
        "is_video_off": False,
        "is_screen_sharing": False,
        "joined_at": datetime.utcnow().isoformat(),
    }

    try:
        # Wait for join message with user info
        initial_msg = await websocket.receive_json()
        if initial_msg.get("type") == "join":
            participant_info["display_name"] = initial_msg.get("display_name", "Guest")
            participant_info["user_id"] = initial_msg.get("user_id")

        # Add to room
        room.participants[socket_id] = participant_info
        room.websockets[socket_id] = websocket

        # Notify others about new participant
        await broadcast_to_room(room, {
            "type": "participant_joined",
            "participant": participant_info,
            "participants": list(room.participants.values()),
        }, exclude=socket_id)

        # Send room state to new participant
        await websocket.send_json({
            "type": "room_state",
            "socket_id": socket_id,
            "participants": list(room.participants.values()),
            "chat_messages": room.chat_messages[-50:],  # Last 50 messages
            "is_recording": room.is_recording,
        })

        # Main message loop
        while True:
            data = await websocket.receive_json()
            await handle_signaling_message(room, socket_id, data)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Cleanup on disconnect
        if socket_id in room.participants:
            del room.participants[socket_id]
        if socket_id in room.websockets:
            del room.websockets[socket_id]

        # Notify others
        await broadcast_to_room(room, {
            "type": "participant_left",
            "socket_id": socket_id,
            "participants": list(room.participants.values()),
        })

        # Delete room if empty
        if len(room.participants) == 0:
            room_manager.delete_room(room_id)


async def broadcast_to_room(room: VideoRoom, message: dict, exclude: str = None):
    """Broadcast message to all participants in room"""
    for sid, ws in list(room.websockets.items()):
        if sid != exclude:
            try:
                await ws.send_json(message)
            except:
                pass


async def send_to_participant(room: VideoRoom, socket_id: str, message: dict):
    """Send message to specific participant"""
    ws = room.websockets.get(socket_id)
    if ws:
        try:
            await ws.send_json(message)
        except:
            pass


async def handle_signaling_message(room: VideoRoom, sender_id: str, data: dict):
    """Handle WebRTC signaling and other messages"""
    msg_type = data.get("type")

    if msg_type == "offer":
        # WebRTC offer - forward to target peer
        target = data.get("target")
        await send_to_participant(room, target, {
            "type": "offer",
            "offer": data.get("offer"),
            "sender": sender_id,
        })

    elif msg_type == "answer":
        # WebRTC answer - forward to target peer
        target = data.get("target")
        await send_to_participant(room, target, {
            "type": "answer",
            "answer": data.get("answer"),
            "sender": sender_id,
        })

    elif msg_type == "ice_candidate":
        # ICE candidate - forward to target peer
        target = data.get("target")
        await send_to_participant(room, target, {
            "type": "ice_candidate",
            "candidate": data.get("candidate"),
            "sender": sender_id,
        })

    elif msg_type == "chat_message":
        # Chat message
        chat_msg = {
            "id": str(uuid.uuid4())[:8],
            "sender_id": sender_id,
            "sender_name": room.participants.get(sender_id, {}).get("display_name", "Unknown"),
            "message": data.get("message", ""),
            "timestamp": datetime.utcnow().isoformat(),
        }
        room.chat_messages.append(chat_msg)
        await broadcast_to_room(room, {
            "type": "chat_message",
            "message": chat_msg,
        })

    elif msg_type == "transcription":
        # AI transcription segment
        transcription = {
            "id": str(uuid.uuid4())[:8],
            "speaker_id": sender_id,
            "speaker_name": room.participants.get(sender_id, {}).get("display_name", "Unknown"),
            "text": data.get("text", ""),
            "timestamp": datetime.utcnow().isoformat(),
            "is_final": data.get("is_final", False),
        }
        if data.get("is_final"):
            room.transcriptions.append(transcription)
        await broadcast_to_room(room, {
            "type": "transcription",
            "transcription": transcription,
        })

    elif msg_type == "media_state":
        # Update participant media state
        if sender_id in room.participants:
            room.participants[sender_id]["is_muted"] = data.get("is_muted", False)
            room.participants[sender_id]["is_video_off"] = data.get("is_video_off", False)
            room.participants[sender_id]["is_screen_sharing"] = data.get("is_screen_sharing", False)
        await broadcast_to_room(room, {
            "type": "media_state_changed",
            "socket_id": sender_id,
            "is_muted": data.get("is_muted"),
            "is_video_off": data.get("is_video_off"),
            "is_screen_sharing": data.get("is_screen_sharing"),
        }, exclude=sender_id)

    elif msg_type == "recording_state":
        # Recording state change (host only)
        if room.host_id and sender_id == str(room.host_id):
            room.is_recording = data.get("is_recording", False)
            await broadcast_to_room(room, {
                "type": "recording_state_changed",
                "is_recording": room.is_recording,
            })

    elif msg_type == "whiteboard_action":
        # Whiteboard sync
        action = data.get("action")
        room.whiteboard_state.append(action)
        await broadcast_to_room(room, {
            "type": "whiteboard_action",
            "action": action,
            "sender": sender_id,
        }, exclude=sender_id)

    elif msg_type == "reaction":
        # Emoji reactions
        await broadcast_to_room(room, {
            "type": "reaction",
            "sender_id": sender_id,
            "sender_name": room.participants.get(sender_id, {}).get("display_name", "Unknown"),
            "emoji": data.get("emoji", "👍"),
        })

    elif msg_type == "hand_raise":
        # Hand raise/lower
        if sender_id in room.participants:
            room.participants[sender_id]["hand_raised"] = data.get("raised", False)
        await broadcast_to_room(room, {
            "type": "hand_raise_changed",
            "socket_id": sender_id,
            "raised": data.get("raised", False),
        })

    elif msg_type == "pin_video":
        # Pin a participant's video
        await broadcast_to_room(room, {
            "type": "video_pinned",
            "pinned_socket_id": data.get("target"),
            "pinned_by": sender_id,
        })
