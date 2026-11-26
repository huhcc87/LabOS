import { useState } from 'react'
import PreJoin, { type JoinChoice } from './huddle/PreJoin'
import CallRoom from './huddle/CallRoom'
import type { AgendaLite } from './huddle/AgendaPanel'

interface Props {
  roomId: string
  meetingId?: string | number
  meetingTitle?: string
  userName: string
  userId: string | number
  agenda?: AgendaLite[]
  onLeave: () => void
}

/** LabHuddle call: a join screen first (check camera and sound), then the call itself. */
export default function VideoCallRoom({ roomId, meetingId, meetingTitle, userName, agenda = [], onLeave }: Props) {
  const [join, setJoin] = useState<JoinChoice | null>(null)
  const title = meetingTitle || 'LabHuddle call'
  if (!join) return <PreJoin title={title} userName={userName} onJoin={setJoin} onCancel={onLeave} />
  return <CallRoom roomId={roomId} meetingId={meetingId} title={title} userName={userName} agenda={agenda} join={join} onLeave={onLeave} />
}
