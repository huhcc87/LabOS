export type ProtocolType = 'published' | 'imported' | 'internal' | 'ai_draft'
export type ApprovalStatus = 'approved' | 'under_review' | 'draft' | 'archived'
export type SourceType = 'protocols_io' | 'pubmed' | 'europe_pmc' | 'crossref' | 'bio_protocol' | 'jove' | 'manual' | 'ai_generated'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type BiosafetyLevel = 'BSL-1' | 'BSL-2' | 'BSL-3' | 'BSL-4'

export interface ProtocolStep {
  stepNumber: number
  title: string
  instruction: string
  duration?: string
  temperature?: string
  rpm?: string
  notes?: string
  caution?: string
  expectedOutput?: string
  imageUrl?: string
  videoUrl?: string
  qcPoint?: boolean
  troubleshootingTip?: string
}

export interface ProtocolReference {
  id: string
  title: string
  doi?: string
  pmid?: string
  pmcid?: string
  url: string
  source: SourceType
  citationText: string
  openAccess: boolean
  journal?: string
  year?: number
  authors?: string[]
}

export interface Protocol {
  id: string
  slug: string
  title: string
  category: string
  subcategory: string
  summary: string
  abstract: string
  protocolType: ProtocolType
  approvalStatus: ApprovalStatus
  sourceType: SourceType
  sourceName: string
  sourceUrl: string
  doi?: string
  pmid?: string
  pmcid?: string
  journal?: string
  publicationYear?: number
  authors: string[]
  keywords: string[]
  tags: string[]
  field: string
  biosafetyLevel?: BiosafetyLevel
  reagents: string[]
  equipment: string[]
  estimatedTime?: string
  sampleType?: string
  organism?: string
  difficulty?: Difficulty
  prerequisites: string[]
  safetyNotes: string[]
  qcChecklist: string[]
  troubleshooting: { problem: string; solution: string }[]
  steps: ProtocolStep[]
  references: ProtocolReference[]
  relatedArticles: ProtocolReference[]
  version: string
  parentProtocolId?: string
  createdBy: string
  owner: string
  curator?: string
  lastReviewedAt?: string
  createdAt: string
  updatedAt: string
  aiGenerated: boolean
  aiModel?: string
  confidenceScore?: number
  reviewNotes?: string
  evidenceLinks: string[]
}

export interface ProtocolCategory {
  id: string
  name: string
  icon: string
  description: string
  color: string
  subcategories: ProtocolSubcategory[]
  protocolCount: number
}

export interface ProtocolSubcategory {
  id: string
  name: string
  categoryId: string
  description: string
  protocolCount: number
}

export interface ProtocolFilters {
  search: string
  category: string
  subcategory: string
  sourceType: string
  approvalStatus: string
  protocolType: string
  year: string
  organism: string
  difficulty: string
  biosafetyLevel: string
  openAccessOnly: boolean
  hasDoi: boolean
  hasPmid: boolean
}

export interface ImportSearchResult {
  externalId: string
  title: string
  authors: string[]
  journal?: string
  year?: number
  doi?: string
  pmid?: string
  abstract: string
  sourceType: SourceType
  sourceName: string
  sourceUrl: string
  openAccess: boolean
  alreadyImported: boolean
}

// Protocol Execution Types
export interface StepExecution {
  stepIndex: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  startedAt?: string
  completedAt?: string
  actualDuration?: number
  notes: string
  deviation: string
  outcome: 'success' | 'partial' | 'failed' | null
  photos: string[]
}

export interface ExecutionSession {
  id: string
  protocolId: string
  protocolVersion: string
  startedAt: string
  completedAt?: string
  executedBy: string
  steps: StepExecution[]
  overallNotes: string
  status: 'in_progress' | 'completed' | 'aborted'
}

// Protocol Version Types
export interface ProtocolVersion {
  id: string
  protocolId: string
  version: string
  changes: string
  changedBy: string
  changedAt: string
  snapshot: Protocol
}

// Protocol Comment Types
export interface ProtocolComment {
  id: string
  protocolId: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  stepIndex?: number
  createdAt: string
  updatedAt?: string
  replies: ProtocolComment[]
  mentions: string[]
}

// Approval Workflow Types
export interface ApprovalRequest {
  id: string
  protocolId: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested'
  reviewers: ApprovalReviewer[]
  dueDate?: string
  comments: string
}

export interface ApprovalReviewer {
  userId: string
  userName: string
  role: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested'
  reviewedAt?: string
  comments?: string
  signature?: string
}

// Training & Certification Types
export interface ProtocolTraining {
  id: string
  protocolId: string
  userId: string
  userName: string
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  startedAt?: string
  completedAt?: string
  expiresAt?: string
  certifiedBy?: string
  score?: number
  attempts: number
}

// Analytics Types
export interface ProtocolAnalytics {
  protocolId: string
  totalExecutions: number
  successRate: number
  averageDuration: number
  failureReasons: { reason: string; count: number }[]
  executionsByUser: { userId: string; userName: string; count: number }[]
  executionsByMonth: { month: string; count: number }[]
  averageStepDurations: { stepIndex: number; avgDuration: number }[]
}

// Scheduling Types
export interface ScheduledRun {
  id: string
  protocolId: string
  protocolName: string
  scheduledDate: string
  scheduledTime: string
  estimatedDuration: number
  assignedTo: { id: string; name: string; avatar?: string }
  equipment: { id: string; name: string; available: boolean }[]
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    interval: number
    endDate?: string
  }
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export interface LabEquipment {
  id: string
  name: string
  location: string
  bookings: { date: string; startTime: string; endTime: string; userId: string }[]
}

// Compliance & Audit Types
export interface AuditEntry {
  id: string
  timestamp: string
  action: 'created' | 'edited' | 'approved' | 'rejected' | 'executed' | 'deviation' | 'reviewed' | 'archived' | 'restored' | 'version_created' | 'comment_added' | 'attachment_added' | 'training_completed'
  userId: string
  userName: string
  userRole: string
  details: string
  oldValue?: string
  newValue?: string
  ipAddress?: string
  sessionId?: string
  sectionAffected?: string
  complianceFlags?: string[]
}

export interface Deviation {
  id: string
  executionId: string
  stepIndex: number
  type: 'minor' | 'major' | 'critical'
  description: string
  reportedBy: string
  reportedAt: string
  rootCause?: string
  correctiveAction?: string
  preventiveAction?: string
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  resolvedBy?: string
  resolvedAt?: string
  attachments?: string[]
}

export interface ComplianceCheck {
  id: string
  requirement: string
  category: 'documentation' | 'training' | 'approval' | 'execution' | 'storage' | 'review'
  status: 'compliant' | 'non_compliant' | 'needs_review' | 'not_applicable'
  lastChecked: string
  checkedBy?: string
  notes?: string
  regulation: string
}

// Media Attachment Types
export interface MediaAttachment {
  id: string
  type: 'image' | 'video' | 'document'
  url: string
  thumbnailUrl?: string
  name: string
  size: number
  uploadedBy: string
  uploadedAt: string
  stepIndex?: number
  annotations?: { x: number; y: number; text: string }[]
}
