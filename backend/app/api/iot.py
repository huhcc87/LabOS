"""
IoT sensor API — receives readings from Raspberry Pi gateways and serves
live + historical data to the frontend.

Authentication:
  - Pi devices POST readings using an X-API-Key header (per-sensor key).
  - Dashboard GET endpoints require a normal JWT bearer token.
  - WebSocket /iot/ws streams live readings to connected browser clients.
  - MQTT listener (optional) relays paho-mqtt messages into the WS broadcast.
"""

import asyncio
import json
import logging
import secrets
import threading
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import IoTAlert, IoTAlertSeverity, IoTReading, IoTSensor, IoTSensorType
from app.services.auth import get_current_user

log = logging.getLogger(__name__)

# ─── WebSocket connection manager ────────────────────────────────────────────

class _WSManager:
    """Thread-safe manager for all active WebSocket connections."""

    def __init__(self):
        self._connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.append(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self._connections = [c for c in self._connections if c is not ws]

    async def broadcast(self, payload: dict):
        """Send JSON payload to all connected clients; silently drop dead sockets."""
        text = json.dumps(payload)
        async with self._lock:
            live = list(self._connections)
        dead = []
        for ws in live:
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                self._connections = [c for c in self._connections if c not in dead]


_ws_manager = _WSManager()


# ─── MQTT subscriber (optional, starts only when broker is configured) ────────

def _start_mqtt_listener(broker_host: str, broker_port: int, topic: str, loop: asyncio.AbstractEventLoop):
    """Run a blocking paho-mqtt loop in a daemon thread and forward messages
    to the WebSocket broadcast coroutine in the main asyncio event loop."""
    try:
        import paho.mqtt.client as mqtt  # type: ignore
    except ImportError:
        log.warning("paho-mqtt not installed; MQTT listener disabled")
        return

    def on_message(_client, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
        except Exception:
            payload = {"raw": msg.payload.decode()}
        payload["_topic"] = msg.topic
        asyncio.run_coroutine_threadsafe(_ws_manager.broadcast({"type": "mqtt", "data": payload}), loop)

    client = mqtt.Client()
    client.on_message = on_message
    try:
        client.connect(broker_host, broker_port, keepalive=60)
        client.subscribe(topic)
        client.loop_forever()
    except Exception as exc:
        log.warning("MQTT connection failed: %s — live sensor relay disabled", exc)


def maybe_start_mqtt():
    """Called once at startup. No-ops if MQTT_BROKER_HOST is not configured."""
    broker = getattr(settings, "mqtt_broker_host", "")
    if not broker:
        return
    port = getattr(settings, "mqtt_broker_port", 1883)
    topic = getattr(settings, "mqtt_topic", "lab/sensors/#")
    loop = asyncio.get_event_loop()
    t = threading.Thread(target=_start_mqtt_listener, args=(broker, port, topic, loop), daemon=True)
    t.start()
    log.info("MQTT listener thread started for %s:%s topic=%s", broker, port, topic)

router = APIRouter(prefix="/iot", tags=["iot"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SensorCreate(BaseModel):
    sensor_key: str
    name: str
    location: str = ""
    sensor_type: IoTSensorType = IoTSensorType.freezer
    unit: str = "°C"
    target: float = 0.0
    min_threshold: float = -85.0
    max_threshold: float = -70.0
    notify_email: str = ""
    alert_cooldown_minutes: int = 30


class SensorUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    min_threshold: Optional[float] = None
    max_threshold: Optional[float] = None
    target: Optional[float] = None
    notify_email: Optional[str] = None
    alert_cooldown_minutes: Optional[int] = None


class SensorOut(BaseModel):
    id: int
    sensor_key: str
    name: str
    location: str
    sensor_type: str
    unit: str
    target: float
    min_threshold: float
    max_threshold: float
    is_active: bool
    api_key: str
    notify_email: str
    alert_cooldown_minutes: int
    current_value: Optional[float] = None
    current_status: str = "offline"
    last_updated: Optional[str] = None
    unack_alerts: int = 0

    model_config = {"from_attributes": True}


class ReadingIn(BaseModel):
    value: float
    recorded_at: Optional[datetime] = None


class ReadingOut(BaseModel):
    id: int
    value: float
    recorded_at: datetime

    model_config = {"from_attributes": True}


class AlertOut(BaseModel):
    id: int
    sensor_id: int
    sensor_name: str
    severity: str
    value: float
    message: str
    triggered_at: datetime
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    notified_emails: str

    model_config = {"from_attributes": True}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _sensor_status(sensor: IoTSensor, value: float) -> str:
    if value < sensor.min_threshold or value > sensor.max_threshold:
        return "critical"
    margin = abs(sensor.max_threshold - sensor.min_threshold) * 0.1
    if value < sensor.min_threshold + margin or value > sensor.max_threshold - margin:
        return "warning"
    return "normal"


def _enrich(sensor: IoTSensor) -> dict:
    latest = sensor.readings[0] if sensor.readings else None
    unack = sum(1 for a in sensor.alerts if not a.acknowledged)
    return {
        "id": sensor.id,
        "sensor_key": sensor.sensor_key,
        "name": sensor.name,
        "location": sensor.location,
        "sensor_type": sensor.sensor_type,
        "unit": sensor.unit,
        "target": sensor.target,
        "min_threshold": sensor.min_threshold,
        "max_threshold": sensor.max_threshold,
        "is_active": sensor.is_active,
        "api_key": sensor.api_key,
        "notify_email": sensor.notify_email,
        "alert_cooldown_minutes": sensor.alert_cooldown_minutes,
        "current_value": latest.value if latest else None,
        "current_status": _sensor_status(sensor, latest.value) if latest else "offline",
        "last_updated": latest.recorded_at.isoformat() if latest else None,
        "unack_alerts": unack,
    }


# ─── Sensors CRUD ────────────────────────────────────────────────────────────

@router.post("/sensors", response_model=SensorOut)
def create_sensor(
    body: SensorCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if db.query(IoTSensor).filter(IoTSensor.sensor_key == body.sensor_key).first():
        raise HTTPException(400, "sensor_key already registered")
    sensor = IoTSensor(
        sensor_key=body.sensor_key,
        name=body.name,
        location=body.location,
        sensor_type=body.sensor_type,
        unit=body.unit,
        target=body.target,
        min_threshold=body.min_threshold,
        max_threshold=body.max_threshold,
        notify_email=body.notify_email,
        alert_cooldown_minutes=body.alert_cooldown_minutes,
        api_key=secrets.token_hex(32),
    )
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return _enrich(sensor)


@router.get("/sensors", response_model=list[SensorOut])
def list_sensors(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sensors = db.query(IoTSensor).filter(IoTSensor.is_active == True).all()
    return [_enrich(s) for s in sensors]


@router.get("/sensors/{sensor_id}", response_model=SensorOut)
def get_sensor(
    sensor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sensor = db.query(IoTSensor).filter(IoTSensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(404, "Sensor not found")
    return _enrich(sensor)


@router.patch("/sensors/{sensor_id}", response_model=SensorOut)
def update_sensor(
    sensor_id: int,
    body: SensorUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sensor = db.query(IoTSensor).filter(IoTSensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(404, "Sensor not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(sensor, field, val)
    db.commit()
    db.refresh(sensor)
    return _enrich(sensor)


@router.delete("/sensors/{sensor_id}")
def delete_sensor(
    sensor_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sensor = db.query(IoTSensor).filter(IoTSensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(404, "Sensor not found")
    sensor.is_active = False
    db.commit()
    return {"ok": True}


# ─── Pi → server: POST a reading ─────────────────────────────────────────────

@router.post("/readings/{sensor_key}")
async def post_reading(
    sensor_key: str,
    body: ReadingIn,
    x_api_key: str = Header(...),
    db: Session = Depends(get_db),
):
    sensor = db.query(IoTSensor).filter(
        IoTSensor.sensor_key == sensor_key,
        IoTSensor.api_key == x_api_key,
        IoTSensor.is_active == True,
    ).first()
    if not sensor:
        raise HTTPException(401, "Invalid sensor key or API key")

    ts = body.recorded_at or datetime.utcnow()
    reading = IoTReading(sensor_id=sensor.id, value=body.value, recorded_at=ts)
    db.add(reading)
    db.commit()

    # Broadcast live reading to all connected WebSocket clients
    await _ws_manager.broadcast({
        "type": "reading",
        "sensor_id": sensor.id,
        "sensor_key": sensor.sensor_key,
        "sensor_name": sensor.name,
        "unit": sensor.unit,
        "value": body.value,
        "status": _sensor_status(sensor, body.value),
        "recorded_at": ts.isoformat(),
    })
    return {"ok": True, "sensor_id": sensor.id, "value": body.value}


# ─── WebSocket live stream ────────────────────────────────────────────────────

@router.websocket("/ws")
async def iot_websocket(ws: WebSocket):
    """
    Connect to receive real-time sensor readings as JSON frames:
      { type: "reading", sensor_id, sensor_name, value, unit, status, recorded_at }
      { type: "mqtt",    data: { ... raw MQTT payload ... } }
      { type: "ping" }   — sent every 30 s to keep the connection alive
    """
    await _ws_manager.connect(ws)
    try:
        while True:
            # Send a keepalive ping every 30 s; also drain any incoming messages
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    finally:
        await _ws_manager.disconnect(ws)


# ─── History ─────────────────────────────────────────────────────────────────

@router.get("/sensors/{sensor_id}/history", response_model=list[ReadingOut])
def get_history(
    sensor_id: int,
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(hours=hours)
    readings = (
        db.query(IoTReading)
        .filter(IoTReading.sensor_id == sensor_id, IoTReading.recorded_at >= since)
        .order_by(desc(IoTReading.recorded_at))
        .limit(500)
        .all()
    )
    return readings


# ─── Alerts ──────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    unack_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(IoTAlert)
    if unack_only:
        q = q.filter(IoTAlert.acknowledged == False)
    alerts = q.order_by(desc(IoTAlert.triggered_at)).limit(limit).all()
    result = []
    for a in alerts:
        result.append({
            "id": a.id,
            "sensor_id": a.sensor_id,
            "sensor_name": a.sensor.name if a.sensor else "Unknown",
            "severity": a.severity,
            "value": a.value,
            "message": a.message,
            "triggered_at": a.triggered_at,
            "acknowledged": a.acknowledged,
            "acknowledged_at": a.acknowledged_at,
            "notified_emails": a.notified_emails,
        })
    return result


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    alert = db.query(IoTAlert).filter(IoTAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.get("/sensors/{sensor_id}/alerts", response_model=list[AlertOut])
def get_sensor_alerts(
    sensor_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    alerts = (
        db.query(IoTAlert)
        .filter(IoTAlert.sensor_id == sensor_id)
        .order_by(desc(IoTAlert.triggered_at))
        .limit(limit)
        .all()
    )
    return [
        {
            "id": a.id, "sensor_id": a.sensor_id,
            "sensor_name": a.sensor.name if a.sensor else "Unknown",
            "severity": a.severity, "value": a.value, "message": a.message,
            "triggered_at": a.triggered_at, "acknowledged": a.acknowledged,
            "acknowledged_at": a.acknowledged_at, "notified_emails": a.notified_emails,
        }
        for a in alerts
    ]
