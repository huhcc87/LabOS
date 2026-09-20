import React from 'react'
import type { ApprovalStatus, SourceType, ProtocolType, Difficulty, BiosafetyLevel } from '../types/protocol.types'
import { getApprovalBadge, getSourceBadge, getProtocolTypeBadge, getDifficultyBadge, getBiosafetyBadge } from '../utils/protocolStatus'

const badge = (b: { label: string; color: string; background: string; icon: string }, extra?: React.CSSProperties) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
    borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
    color: b.color, background: b.background, whiteSpace: 'nowrap', ...extra,
  }}>
    <span>{b.icon}</span>{b.label}
  </span>
)

export const ApprovalBadge = ({ status }: { status: ApprovalStatus }) => badge(getApprovalBadge(status))
export const SourceBadge = ({ sourceType }: { sourceType: SourceType }) => badge(getSourceBadge(sourceType))
export const ProtocolTypeBadge = ({ type }: { type: ProtocolType }) => badge(getProtocolTypeBadge(type))
export const DifficultyBadge = ({ difficulty }: { difficulty: Difficulty }) => badge(getDifficultyBadge(difficulty))
export const BiosafetyBadge = ({ level }: { level: BiosafetyLevel }) => badge(getBiosafetyBadge(level))

export const OpenAccessBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#d1fae5', background: '#065f46', whiteSpace: 'nowrap' }}>
    🔓 Open Access
  </span>
)

export const AiGeneratedBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#e9d5ff', background: '#4c1d95', whiteSpace: 'nowrap' }}>
    🤖 AI Draft
  </span>
)
