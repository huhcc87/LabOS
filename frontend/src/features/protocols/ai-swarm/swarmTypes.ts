// ═══════════════════════════════════════════════════════════════════════════
// AI SWARM PROTOCOL INTELLIGENCE — TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type AgentId =
  | 'architect'
  | 'reviewer'
  | 'biosafety'
  | 'qaqc'
  | 'troubleshooter'
  | 'equipment'
  | 'reagent'
  | 'literature'
  | 'optimizer'
  | 'trainer'

export type AgentStatus = 'idle' | 'thinking' | 'complete' | 'error'

export interface AgentScore {
  value: number   // 0-100
  label: string
  details: string
}

export interface AgentOutput {
  agentId: AgentId
  status: AgentStatus
  title: string
  icon: string
  color: string
  summary: string
  sections: AgentSection[]
  scores: AgentScore[]
  warnings: string[]
  recommendations: string[]
  timestamp: string
  durationMs: number
}

export interface AgentSection {
  heading: string
  content: string
  items?: string[]
  severity?: 'info' | 'warning' | 'critical'
  collapsible?: boolean
}

export interface SwarmSession {
  id: string
  protocolTitle: string
  protocolCategory: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'complete' | 'partial' | 'error'
  agents: AgentOutput[]
  consensus: SwarmConsensus
  generatedSOP?: GeneratedSOP
}

export interface SwarmConsensus {
  overallScore: number
  scientificValidity: number
  safetyCompliance: number
  reproducibility: number
  optimizationPotential: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  confidenceScore: number
  agentAgreement: number // 0-100 how much agents agree
  topRecommendations: string[]
  conflicts: SwarmConflict[]
}

export interface SwarmConflict {
  agents: AgentId[]
  issue: string
  resolution: string
}

export interface GeneratedSOP {
  purpose: string
  scope: string
  responsibilities: string[]
  materials: SOPMaterial[]
  reagents: SOPReagent[]
  equipment: SOPEquipment[]
  procedure: SOPStep[]
  qcCheckpoints: SOPCheckpoint[]
  expectedResults: string
  troubleshooting: SOPTroubleshooting[]
  safetyNotes: string[]
  wasteDisposal: string[]
  references: string[]
  trainingRequirements: string[]
  approvalRequirements: string[]
  riskAssessment: SOPRiskItem[]
  optimizationNotes: string[]
  revisionHistory: SOPRevision[]
  complianceNotes: string[]
}

export interface SOPMaterial {
  name: string
  quantity: string
  specification: string
  supplier?: string
  catalogNumber?: string
}

export interface SOPReagent {
  name: string
  concentration: string
  volume: string
  storage: string
  hazardClass?: string
  alternatives?: string[]
}

export interface SOPEquipment {
  name: string
  specification: string
  calibration?: string
  maintenance?: string
}

export interface SOPStep {
  number: number
  title: string
  instruction: string
  duration?: string
  temperature?: string
  criticalParams?: string[]
  qcPoint?: boolean
  safetyNote?: string
  tip?: string
  expectedOutput?: string
}

export interface SOPCheckpoint {
  step: number
  description: string
  acceptanceCriteria: string
  action: string
}

export interface SOPTroubleshooting {
  problem: string
  possibleCauses: string[]
  solutions: string[]
  prevention: string
}

export interface SOPRiskItem {
  hazard: string
  risk: 'low' | 'medium' | 'high' | 'critical'
  control: string
  ppe: string[]
}

export interface SOPRevision {
  version: string
  date: string
  author: string
  changes: string
}

// ── AI SOP Generator Input ────────────────────────────────────────────────
export interface SOPGeneratorInput {
  experimentName: string
  researchArea: string
  technique: string
  sampleType: string
  organism: string
  equipment: string
  reagents: string
  biosafetyLevel: string
  goal: string
  additionalNotes: string
}

// ── Agent Definitions ─────────────────────────────────────────────────────
export interface AgentDefinition {
  id: AgentId
  name: string
  icon: string
  color: string
  role: string
  capabilities: string[]
}

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'architect',
    name: 'Protocol Architect',
    icon: '🏗️',
    color: '#6366f1',
    role: 'Creates SOP structure, workflow, and procedural logic',
    capabilities: ['Draft SOP creation', 'Workflow mapping', 'Procedure hierarchy', 'Execution flow design'],
  },
  {
    id: 'reviewer',
    name: 'Scientific Reviewer',
    icon: '🔬',
    color: '#10b981',
    role: 'Verifies scientific accuracy and methodology',
    capabilities: ['Scientific accuracy check', 'Methodology validation', 'Experimental design review', 'Controls verification'],
  },
  {
    id: 'biosafety',
    name: 'Biosafety Officer',
    icon: '☣️',
    color: '#ef4444',
    role: 'Risk assessment, PPE, hazard identification',
    capabilities: ['Risk assessment', 'PPE recommendations', 'Hazard identification', 'Waste disposal requirements', 'BSL compliance'],
  },
  {
    id: 'qaqc',
    name: 'QA/QC Specialist',
    icon: '✅',
    color: '#f59e0b',
    role: 'Quality checkpoints, reproducibility, validation',
    capabilities: ['Quality checkpoints', 'Reproducibility assessment', 'Validation criteria', 'Acceptance criteria'],
  },
  {
    id: 'troubleshooter',
    name: 'Troubleshooting Expert',
    icon: '🔧',
    color: '#8b5cf6',
    role: 'Detects weaknesses, anticipates failures',
    capabilities: ['Failure analysis', 'Troubleshooting guides', 'Protocol weakness detection', 'Optimization suggestions'],
  },
  {
    id: 'equipment',
    name: 'Equipment Specialist',
    icon: '⚙️',
    color: '#06b6d4',
    role: 'Equipment validation, calibration, maintenance',
    capabilities: ['Equipment validation', 'Calibration recommendations', 'Maintenance requirements', 'Instrument setup'],
  },
  {
    id: 'reagent',
    name: 'Reagent Specialist',
    icon: '🧪',
    color: '#ec4899',
    role: 'Reagent verification, alternatives, storage',
    capabilities: ['Reagent verification', 'Alternative reagents', 'Storage conditions', 'Stability information'],
  },
  {
    id: 'literature',
    name: 'Literature Intelligence',
    icon: '📚',
    color: '#14b8a6',
    role: 'Searches publications, compares methodologies',
    capabilities: ['Publication search', 'Method comparison', 'Evidence scoring', 'Citation extraction'],
  },
  {
    id: 'optimizer',
    name: 'Protocol Optimizer',
    icon: '⚡',
    color: '#f97316',
    role: 'Reduces cost/time, improves reproducibility',
    capabilities: ['Cost reduction', 'Time optimization', 'Reproducibility improvement', 'Efficiency scoring'],
  },
  {
    id: 'trainer',
    name: 'Training Agent',
    icon: '🎓',
    color: '#a855f7',
    role: 'Generates training materials and assessments',
    capabilities: ['Training materials', 'Competency tests', 'Certification quizzes', 'Knowledge assessments'],
  },
]

// ── Chat Types ────────────────────────────────────────────────────────────
export interface SwarmChatMessage {
  id: string
  role: 'user' | 'swarm'
  agentId?: AgentId
  content: string
  timestamp: string
  suggestions?: string[]
}

// ── Knowledge Graph Types ─────────────────────────────────────────────────
export interface KnowledgeNode {
  id: string
  type: 'protocol' | 'reagent' | 'equipment' | 'publication' | 'experiment' | 'scientist' | 'project' | 'training'
  label: string
  icon: string
  color: string
}

export interface KnowledgeEdge {
  source: string
  target: string
  relationship: string
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}
