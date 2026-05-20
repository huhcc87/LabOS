import type { ApprovalStatus, SourceType, ProtocolType, Difficulty, BiosafetyLevel } from '../types/protocol.types'

interface BadgeStyle { label: string; color: string; background: string; icon: string }

export function getApprovalBadge(status: ApprovalStatus): BadgeStyle {
  switch (status) {
    case 'approved':     return { label: 'Approved',      color: '#d1fae5', background: '#065f46', icon: '✓' }
    case 'under_review': return { label: 'Under Review',  color: '#fef3c7', background: '#92400e', icon: '⏳' }
    case 'draft':        return { label: 'Draft',         color: '#e2e8f0', background: '#374151', icon: '✏️' }
    case 'archived':     return { label: 'Archived',      color: '#d1d5db', background: '#374151', icon: '🗄️' }
  }
}

export function getSourceBadge(sourceType: SourceType): BadgeStyle {
  switch (sourceType) {
    case 'pubmed':       return { label: 'PubMed',        color: '#bfdbfe', background: '#1e3a5f', icon: '🔬' }
    case 'europe_pmc':  return { label: 'Europe PMC',    color: '#bfdbfe', background: '#1e3a8a', icon: '🔬' }
    case 'crossref':    return { label: 'Crossref',      color: '#fef3c7', background: '#78350f', icon: '🔗' }
    case 'protocols_io':return { label: 'protocols.io',  color: '#fed7aa', background: '#7c2d12', icon: '📋' }
    case 'bio_protocol':return { label: 'Bio-protocol',  color: '#d1fae5', background: '#064e3b', icon: '🧪' }
    case 'jove':        return { label: 'JoVE',          color: '#fecaca', background: '#7f1d1d', icon: '🎬' }
    case 'manual':      return { label: 'Internal',      color: '#e2e8f0', background: '#1f2937', icon: '🏠' }
    case 'ai_generated':return { label: 'AI Generated',  color: '#e9d5ff', background: '#4c1d95', icon: '🤖' }
  }
}

export function getProtocolTypeBadge(type: ProtocolType): BadgeStyle {
  switch (type) {
    case 'published':   return { label: 'Published',     color: '#bfdbfe', background: '#1d4ed8', icon: '📰' }
    case 'imported':    return { label: 'Imported',      color: '#d1fae5', background: '#047857', icon: '📥' }
    case 'internal':    return { label: 'Internal',      color: '#a5f3fc', background: '#0e7490', icon: '🏠' }
    case 'ai_draft':    return { label: 'AI Draft',      color: '#e9d5ff', background: '#6d28d9', icon: '🤖' }
  }
}

export function getDifficultyBadge(difficulty: Difficulty): BadgeStyle {
  switch (difficulty) {
    case 'beginner':     return { label: 'Beginner',     color: '#d1fae5', background: '#065f46', icon: '🟢' }
    case 'intermediate': return { label: 'Intermediate', color: '#fef3c7', background: '#92400e', icon: '🟡' }
    case 'advanced':     return { label: 'Advanced',     color: '#fed7aa', background: '#7c2d12', icon: '🟠' }
    case 'expert':       return { label: 'Expert',       color: '#fecaca', background: '#7f1d1d', icon: '🔴' }
  }
}

export function getBiosafetyBadge(level: BiosafetyLevel): BadgeStyle {
  switch (level) {
    case 'BSL-1': return { label: 'BSL-1', color: '#d1fae5', background: '#065f46', icon: '🟢' }
    case 'BSL-2': return { label: 'BSL-2', color: '#fef3c7', background: '#92400e', icon: '🟡' }
    case 'BSL-3': return { label: 'BSL-3', color: '#fed7aa', background: '#7c2d12', icon: '🟠' }
    case 'BSL-4': return { label: 'BSL-4', color: '#fecaca', background: '#7f1d1d', icon: '🔴' }
  }
}

export function getCategoryColor(category: string): string {
  // Brighter colors for better visibility
  const map: Record<string, string> = {
    'microbiology':     '#4ade80',
    'molecular-biology':'#a78bfa',
    'immunology':       '#fb923c',
    'cancer-biology':   '#f472b6',
  }
  return map[category] || '#60a5fa'
}
