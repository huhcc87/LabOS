// ═══════════════════════════════════════════════════════════════════════════
// ELN AI SWARM — Type Definitions
// Research Intelligence Platform for the Electronic Lab Notebook
// ═══════════════════════════════════════════════════════════════════════════

// ── Agent IDs ────────────────────────────────────────────────────────────
export type ELNAgentId =
  | 'scientific-reviewer'
  | 'protocol-compliance'
  | 'statistics'
  | 'biosafety'
  | 'literature'
  | 'reproducibility'
  | 'optimization'
  | 'research-memory'

export type ELNAgentStatus = 'idle' | 'thinking' | 'complete' | 'error'

// ── Agent Output ─────────────────────────────────────────────────────────
export interface ELNAgentScore {
  value: number // 0-100
  label: string
  details: string
}

export interface ELNAgentSection {
  heading: string
  content: string
  items?: string[]
  severity?: 'info' | 'warning' | 'critical'
}

export interface ELNAgentOutput {
  agentId: ELNAgentId
  status: ELNAgentStatus
  title: string
  icon: string
  color: string
  summary: string
  sections: ELNAgentSection[]
  scores: ELNAgentScore[]
  warnings: string[]
  recommendations: string[]
  timestamp: string
  durationMs: number
}

// ── Agent Definitions ────────────────────────────────────────────────────
export interface ELNAgentDefinition {
  id: ELNAgentId
  name: string
  icon: string
  color: string
  role: string
  capabilities: string[]
}

export const ELN_AGENT_DEFINITIONS: ELNAgentDefinition[] = [
  {
    id: 'scientific-reviewer',
    name: 'Scientific Reviewer',
    icon: '🔬',
    color: '#6366f1',
    role: 'Evaluates experimental design, methodology, controls, and reproducibility',
    capabilities: ['Design evaluation', 'Methodology review', 'Controls assessment', 'Weakness detection', 'Reproducibility scoring'],
  },
  {
    id: 'protocol-compliance',
    name: 'Protocol Compliance',
    icon: '📋',
    color: '#10b981',
    role: 'Verifies SOP compliance and detects missing protocol steps',
    capabilities: ['SOP comparison', 'Step verification', 'Deviation detection', 'Compliance scoring', 'Protocol gap analysis'],
  },
  {
    id: 'statistics',
    name: 'Statistics Agent',
    icon: '📊',
    color: '#f59e0b',
    role: 'Recommends sample sizes, replicates, and statistical tests',
    capabilities: ['Power analysis', 'Sample size calc', 'Test recommendation', 'Statistical weakness detection', 'Replicate assessment'],
  },
  {
    id: 'biosafety',
    name: 'Biosafety Agent',
    icon: '☣️',
    color: '#ef4444',
    role: 'Assesses biosafety risks, PPE requirements, and compliance',
    capabilities: ['Risk assessment', 'PPE recommendations', 'BSL compliance', 'Hazard identification', 'Waste disposal'],
  },
  {
    id: 'literature',
    name: 'Literature Intelligence',
    icon: '📚',
    color: '#8b5cf6',
    role: 'Searches literature, identifies methods, suggests references',
    capabilities: ['PubMed search', 'Method comparison', 'Reference suggestion', 'Evidence scoring', 'Conflict detection'],
  },
  {
    id: 'reproducibility',
    name: 'Reproducibility Agent',
    icon: '🔄',
    color: '#06b6d4',
    role: 'Verifies metadata completeness and experimental reproducibility',
    capabilities: ['Metadata audit', 'FAIR assessment', 'Detail verification', 'Reproducibility scoring', 'Missing data detection'],
  },
  {
    id: 'optimization',
    name: 'Optimization Agent',
    icon: '⚡',
    color: '#f97316',
    role: 'Improves workflow, reduces cost/time, improves quality',
    capabilities: ['Workflow optimization', 'Cost reduction', 'Time optimization', 'Efficiency scoring', 'Alternative methods'],
  },
  {
    id: 'research-memory',
    name: 'Research Memory',
    icon: '🧠',
    color: '#ec4899',
    role: 'Compares against historical experiments, detects similar work',
    capabilities: ['Historical comparison', 'Similarity detection', 'Failure tracking', 'Trend analysis', 'Lessons learned'],
  },
]

// ── Swarm Review Session ─────────────────────────────────────────────────
export interface ELNSwarmReview {
  id: string
  entryId: number | string
  entryTitle: string
  template: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'complete' | 'partial' | 'error'
  agents: ELNAgentOutput[]
  consensus: ELNConsensus
}

export interface ELNConsensus {
  overallScore: number
  scientificScore: number
  complianceScore: number
  safetyScore: number
  reproducibilityScore: number
  optimizationScore: number
  confidenceScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  agentAgreement: number
  topFindings: string[]
  criticalIssues: string[]
}

// ── Experiment Generator ─────────────────────────────────────────────────
export interface ExperimentGeneratorInput {
  researchQuestion: string
  gene?: string
  pathway?: string
  cellLine?: string
  disease?: string
  technique: string
  additionalContext?: string
}

export interface GeneratedExperiment {
  title: string
  hypothesis: string
  controls: { positive: string[]; negative: string[]; internal: string[] }
  experimentalDesign: string
  replicates: string
  expectedResults: string
  statisticalPlan: string
  requiredReagents: string[]
  requiredEquipment: string[]
  potentialPitfalls: string[]
  estimatedTime: string
  biosafetyConsiderations: string
}

// ── Smart Suggestions ────────────────────────────────────────────────────
export interface TemplateSuggestions {
  template: string
  suggestions: SmartSuggestion[]
}

export interface SmartSuggestion {
  field: string
  category: string
  icon: string
  items: { label: string; detail: string }[]
}

// ── Literature Intelligence ──────────────────────────────────────────────
export interface LiteratureResult {
  title: string
  authors: string
  journal: string
  year: number
  doi?: string
  relevanceScore: number
  summary: string
  keyFindings: string[]
}

// ── Manuscript / Grant Intelligence ──────────────────────────────────────
export interface ManuscriptSection {
  type: 'methods' | 'results' | 'figure-legend' | 'supplementary' | 'materials'
  title: string
  content: string
}

export interface GrantSection {
  type: 'preliminary-data' | 'significance' | 'innovation' | 'strategy' | 'progress'
  title: string
  content: string
}

// ── Chat ─────────────────────────────────────────────────────────────────
export interface ELNSwarmMessage {
  id: string
  role: 'user' | 'swarm'
  agentId?: ELNAgentId
  content: string
  timestamp: string
  suggestions?: string[]
}
