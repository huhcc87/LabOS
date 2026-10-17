import type { Protocol, Difficulty } from '../types/protocol.types'
import { protocolAiApi } from '../../../lib/convexClient'

export interface AiGenerationParams {
  title: string
  category: string
  subcategory: string
  sampleType: string
  organism: string
  goal: string
  platform: string
  difficulty: Difficulty
  safetyLevel: string
  notes: string
}

// The draft is written by the local Ollama model (free, private) through convex/protocolAi.ts.
// When Ollama is off or its answer can't be read, the built-in template draft below is used instead.

const buildPrompt = (p: AiGenerationParams) =>
  `Write a draft lab protocol.\nTitle: ${p.title}\nCategory: ${p.category} / ${p.subcategory}\nSample type: ${p.sampleType}\n` +
  `Organism: ${p.organism}\nGoal: ${p.goal}\nPlatform: ${p.platform}\nDifficulty: ${p.difficulty}\nBiosafety: ${p.safetyLevel}\nNotes: ${p.notes}`

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, 30) : [])

/** Read the model's JSON answer into the protocol fields it filled in; null if it isn't usable. */
function parseDraft(text: string): Partial<Protocol> | null {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let d: any
  try { d = JSON.parse(text.slice(start, end + 1)) } catch { return null }
  if (!d || typeof d !== 'object') return null
  const steps = (Array.isArray(d.steps) ? d.steps : []).filter((s: any) => s && s.instruction).slice(0, 20)
    .map((s: any, i: number) => ({ stepNumber: i + 1, title: String(s.title || `Step ${i + 1}`), instruction: String(s.instruction), duration: s.duration ? String(s.duration) : undefined }))
  if (steps.length < 2) return null
  const out: Partial<Protocol> = { steps }
  if (typeof d.summary === 'string' && d.summary.trim()) out.summary = d.summary.trim()
  if (typeof d.estimatedTime === 'string' && d.estimatedTime.trim()) out.estimatedTime = d.estimatedTime.trim()
  for (const k of ['reagents', 'equipment', 'safetyNotes', 'qcChecklist'] as const) {
    const list = strings(d[k]); if (list.length) out[k] = list
  }
  const tr = (Array.isArray(d.troubleshooting) ? d.troubleshooting : []).filter((t: any) => t && t.problem && t.solution)
    .map((t: any) => ({ problem: String(t.problem), solution: String(t.solution) }))
  if (tr.length) out.troubleshooting = tr
  return out
}

export async function generateProtocol(params: AiGenerationParams): Promise<Protocol> {
  const text = await protocolAiApi.complete('protocol', buildPrompt(params))
  const draft = text ? parseDraft(text) : null
  const base = templateDraft(params)
  if (!draft) return base
  return {
    ...base, ...draft,
    sourceName: 'Ollama (local AI)',
    aiModel: 'Ollama (local)',
    confidenceScore: 0.5,
    reviewNotes: `⚠️ DISCLAIMER: This protocol was drafted by a local AI model and must be reviewed by a qualified scientist before laboratory use. Parameters used: ${JSON.stringify(params, null, 2)}`,
  }
}

function templateDraft(params: AiGenerationParams): Protocol {
  const now = new Date().toISOString()
  return {
    id: `ai-${Date.now()}`,
    slug: params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
    title: params.title,
    category: params.category,
    subcategory: params.subcategory,
    summary: `AI-generated protocol for ${params.title}. ${params.goal}`,
    abstract: `This is an AI-generated draft protocol for "${params.title}". It has been generated based on the following parameters: category=${params.category}, organism=${params.organism}, platform=${params.platform}. This protocol has NOT been experimentally validated and must be reviewed by a qualified scientist before laboratory use.`,
    protocolType: 'ai_draft',
    approvalStatus: 'draft',
    sourceType: 'ai_generated',
    sourceName: 'Built-in template (AI is off)',
    sourceUrl: '',
    authors: ['AI Generated'],
    keywords: [params.category, params.subcategory, params.organism].filter(Boolean),
    tags: ['ai-draft', 'needs-review', params.category],
    field: params.category,
    biosafetyLevel: (params.safetyLevel as any) || 'BSL-1',
    reagents: [
      'Reagent A (specify concentration and supplier)',
      'Reagent B (specify volume and grade)',
      'Buffer solution (specify composition)',
      'Positive control material',
      'Negative control material',
    ],
    equipment: [
      `${params.platform || 'Primary instrument'} (specify model)`,
      'Pipettes (P20, P200, P1000)',
      'Microcentrifuge',
      'Incubator (specify temperature)',
    ],
    estimatedTime: '4–6 hours (AI estimate)',
    sampleType: params.sampleType,
    organism: params.organism,
    difficulty: params.difficulty,
    prerequisites: ['Relevant safety training', 'Familiarity with basic lab techniques', 'Review of cited literature'],
    safetyNotes: [
      '⚠️ This is an AI-generated protocol. All safety notes must be verified by a qualified safety officer.',
      'Consult SDS for all reagents before use.',
      'Follow institutional biosafety guidelines.',
    ],
    qcChecklist: [
      'Verify reagent quality and expiry dates',
      'Run positive and negative controls',
      'Document all QC results',
      'Review protocol steps with supervisor before proceeding',
    ],
    troubleshooting: [
      { problem: 'Protocol does not perform as expected', solution: 'Consult published literature and validated protocols. This AI draft should be used as a starting point only.' },
    ],
    steps: [
      { stepNumber: 1, title: 'Sample Preparation', instruction: `Prepare ${params.sampleType || 'sample'} according to standard laboratory procedures. Ensure sample quality meets minimum requirements for ${params.title}.`, duration: '30 min', notes: 'AI-generated step — verify against validated literature' },
      { stepNumber: 2, title: 'Reagent Preparation', instruction: 'Prepare all reagents according to manufacturer instructions. Verify concentrations and volumes before proceeding.', duration: '20 min', caution: 'AI-generated — all reagent concentrations must be verified' },
      { stepNumber: 3, title: 'Primary Protocol Steps', instruction: `Execute the primary steps for ${params.goal}. Monitor key parameters throughout the procedure.`, duration: '2–3 hours', qcPoint: true, notes: 'AI-generated steps — experimental validation required' },
      { stepNumber: 4, title: 'Data Collection', instruction: `Record data using ${params.platform || 'appropriate instrument'}. Ensure instrument is calibrated and within specification.`, duration: '1 hour', qcPoint: true },
      { stepNumber: 5, title: 'Analysis and Interpretation', instruction: 'Analyse results according to standard statistical methods. Compare to controls. Document findings in lab notebook.', duration: '1 hour', expectedOutput: 'Results consistent with experimental hypothesis (AI estimate)' },
    ],
    references: [
      { id: `ai-ref-1`, title: 'Literature references should be added after review', url: 'https://pubmed.ncbi.nlm.nih.gov/', source: 'pubmed', citationText: 'TODO: Add validated references from PubMed', openAccess: true },
    ],
    relatedArticles: [],
    version: '0.1-ai',
    createdBy: 'AI System',
    owner: 'Pending Assignment',
    curator: undefined,
    aiGenerated: true,
    aiModel: 'Template (no AI)',
    confidenceScore: 0.62,
    reviewNotes: `⚠️ DISCLAIMER: This protocol is AI-generated and must be reviewed by a qualified scientist before laboratory use. AI confidence score: 62%. Parameters used: ${JSON.stringify(params, null, 2)}`,
    evidenceLinks: [],
    createdAt: now,
    updatedAt: now,
  }
}
