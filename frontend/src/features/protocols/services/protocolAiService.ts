import type { Protocol, Difficulty } from '../types/protocol.types'

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

// TODO: Connect to Claude API or OpenAI API:
// POST https://api.anthropic.com/v1/messages
// Header: x-api-key: YOUR_ANTHROPIC_API_KEY
// Body: { model: "claude-opus-4-6", messages: [{ role: "user", content: buildPrompt(params) }] }
// Parse response and map to Protocol schema.

export async function generateProtocol(params: AiGenerationParams): Promise<Protocol> {
  await new Promise(r => setTimeout(r, 2000)) // simulate AI generation latency

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
    sourceName: 'Claude AI (Anthropic)',
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
    aiModel: 'Claude Sonnet (mock)',
    confidenceScore: 0.62,
    reviewNotes: `⚠️ DISCLAIMER: This protocol is AI-generated and must be reviewed by a qualified scientist before laboratory use. AI confidence score: 62%. Parameters used: ${JSON.stringify(params, null, 2)}`,
    evidenceLinks: [],
    createdAt: now,
    updatedAt: now,
  }
}
