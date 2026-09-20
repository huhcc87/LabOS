// ═══════════════════════════════════════════════════════════════════════════
// ELN AI SWARM ENGINE — Orchestrates 8-agent experiment review & generation
// ═══════════════════════════════════════════════════════════════════════════
// Architecture: Ready for LangChain/CrewAI/AutoGen integration.
// Replace generate* functions with real LLM API calls.

import type {
  ELNAgentId, ELNAgentOutput, ELNAgentSection, ELNAgentScore,
  ELNSwarmReview, ELNConsensus, ExperimentGeneratorInput, GeneratedExperiment,
  TemplateSuggestions, SmartSuggestion, LiteratureResult,
  ManuscriptSection, GrantSection, ELNSwarmMessage,
} from './elnSwarmTypes'
import { ELN_AGENT_DEFINITIONS } from './elnSwarmTypes'

// ── Utility ──────────────────────────────────────────────────────────────
const uid = () => `eln-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const now = () => new Date().toISOString()
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const score = (min: number, max: number) => Math.round(min + Math.random() * (max - min))

// ── Entry context type (matches ELNPage ExperimentEntry shape) ────────
export interface EntryContext {
  title: string
  template: string
  data: Record<string, string>
  notes: string
  tags: string[]
  status: string
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT OUTPUT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

function generateScientificReviewerOutput(entry: EntryContext): ELNAgentOutput {
  const def = ELN_AGENT_DEFINITIONS.find(a => a.id === 'scientific-reviewer')!
  const hasControls = Object.values(entry.data).some(v =>
    v.toLowerCase().includes('control') || v.toLowerCase().includes('negative') || v.toLowerCase().includes('positive'))
  const hasReplicates = Object.values(entry.data).some(v =>
    v.toLowerCase().includes('replicate') || v.toLowerCase().includes('triplicate') || v.toLowerCase().includes('n='))
  const hasResults = Object.values(entry.data).some(v => v.toLowerCase().includes('result') && v.length > 20)

  const strengths: string[] = []
  const weaknesses: string[] = []

  if (entry.title.length > 10) strengths.push('Descriptive experiment title')
  if (hasControls) strengths.push('Appropriate controls documented')
  else weaknesses.push('No controls mentioned — add positive/negative controls')
  if (hasReplicates) strengths.push('Replicate information provided')
  else weaknesses.push('No replicate information — minimum 3 biological replicates recommended')
  if (hasResults) strengths.push('Results documented with detail')
  else weaknesses.push('Results section needs more quantitative data')
  if (entry.notes.length > 50) strengths.push('Detailed observations recorded')
  if (entry.tags.length >= 3) strengths.push('Well-tagged for discoverability')
  else weaknesses.push('Add more tags for FAIR data compliance')

  const sections: ELNAgentSection[] = [
    {
      heading: 'Experimental Design Assessment',
      content: `Reviewed "${entry.title}" (${entry.template}) for scientific rigor and completeness.`,
      items: [
        `Template: ${entry.template} — ${Object.keys(entry.data).length} data fields recorded`,
        `Documentation completeness: ${Object.values(entry.data).filter(v => v.trim().length > 0).length}/${Object.keys(entry.data).length} fields filled`,
      ],
    },
    { heading: 'Strengths', content: 'Identified scientific strengths:', items: strengths.length > 0 ? strengths : ['No major strengths identified — review experimental design'], severity: 'info' },
    { heading: 'Weaknesses', content: 'Areas requiring improvement:', items: weaknesses.length > 0 ? weaknesses : ['No critical weaknesses detected'], severity: weaknesses.length > 2 ? 'warning' : 'info' },
    {
      heading: 'Methodology Review',
      content: `The ${entry.template} methodology should follow established best practices. Verify all critical parameters are within validated ranges and instrument calibrations are current.`,
      items: getMethodologyTips(entry.template),
    },
  ]

  return {
    agentId: 'scientific-reviewer', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Scientific review complete: ${strengths.length} strengths, ${weaknesses.length} areas for improvement identified.`,
    sections, timestamp: now(), durationMs: score(800, 2400),
    scores: [
      { value: score(hasControls ? 75 : 55, hasControls ? 95 : 70), label: 'Scientific Rigor', details: 'Overall experimental design quality' },
      { value: score(hasReplicates ? 70 : 45, hasReplicates ? 90 : 65), label: 'Controls & Replicates', details: 'Adequate controls and statistical power' },
      { value: score(60, 92), label: 'Methodology', details: 'Adherence to best practices' },
    ],
    warnings: weaknesses.length > 2 ? ['Multiple methodology concerns detected — review before proceeding'] : [],
    recommendations: [
      !hasControls ? 'Add appropriate positive and negative controls' : 'Controls are documented — verify they are appropriate for this assay',
      !hasReplicates ? 'Include minimum 3 biological replicates with technical triplicates' : 'Verify replicate count provides adequate statistical power',
      'Document all deviations from standard protocol',
      'Include equipment calibration dates in your records',
    ],
  }
}

function generateProtocolComplianceOutput(entry: EntryContext): ELNAgentOutput {
  const def = ELN_AGENT_DEFINITIONS.find(a => a.id === 'protocol-compliance')!
  const filledFields = Object.values(entry.data).filter(v => v.trim().length > 0).length
  const totalFields = Object.keys(entry.data).length
  const completionPct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0

  const missingSteps: string[] = []
  const deviations: string[] = []

  if (entry.template === 'pcr') {
    if (!entry.data.primer_forward) missingSteps.push('Forward primer sequence not documented')
    if (!entry.data.primer_reverse) missingSteps.push('Reverse primer sequence not documented')
    if (!entry.data.annealing_temp) missingSteps.push('Annealing temperature not specified')
    if (!entry.data.cycles) missingSteps.push('Cycle number not recorded')
    if (!entry.data.template_dna) missingSteps.push('Template DNA source not specified')
  } else if (entry.template === 'western') {
    if (!entry.data.antibody_primary) missingSteps.push('Primary antibody not documented')
    if (!entry.data.blocking) missingSteps.push('Blocking conditions not specified')
    if (!entry.data.dilution_primary) missingSteps.push('Antibody dilution not recorded')
    if (!entry.data.band_size) missingSteps.push('Expected band size not specified')
  } else if (entry.template === 'cell_culture') {
    if (!entry.data.cell_line) missingSteps.push('Cell line and passage number not documented')
    if (!entry.data.media) missingSteps.push('Culture media not specified')
    if (!entry.data.seeding_density) missingSteps.push('Seeding density not recorded')
  } else if (entry.template === 'flow_cytometry') {
    if (!entry.data.instrument) missingSteps.push('Cytometer model not documented')
    if (!entry.data.markers) missingSteps.push('Marker panel not specified')
    if (!entry.data.gating) missingSteps.push('Gating strategy not documented')
  }

  if (filledFields > 0 && completionPct < 100) {
    deviations.push(`${totalFields - filledFields} required field(s) are empty or incomplete`)
  }

  return {
    agentId: 'protocol-compliance', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Protocol compliance: ${completionPct}% field completion. ${missingSteps.length} missing steps detected.`,
    sections: [
      { heading: 'Compliance Summary', content: `SOP field completion: ${filledFields}/${totalFields} (${completionPct}%).`, items: [`Template: ${entry.template}`, `Status: ${entry.status}`] },
      { heading: 'Missing Steps', content: missingSteps.length > 0 ? 'The following required SOP steps are not documented:' : 'All critical protocol steps are documented.', items: missingSteps, severity: missingSteps.length > 0 ? 'warning' : 'info' },
      { heading: 'Deviations', content: deviations.length > 0 ? 'Protocol deviations detected:' : 'No major deviations from standard protocol detected.', items: deviations, severity: deviations.length > 0 ? 'warning' : 'info' },
    ],
    timestamp: now(), durationMs: score(600, 1800),
    scores: [
      { value: Math.min(completionPct + score(0, 10), 100), label: 'Compliance Score', details: 'Adherence to standard operating procedure' },
      { value: score(missingSteps.length === 0 ? 80 : 50, missingSteps.length === 0 ? 98 : 75), label: 'Documentation', details: 'Required fields completeness' },
    ],
    warnings: missingSteps.length > 3 ? ['Critical: Multiple SOP steps missing — experiment may not be reproducible'] : [],
    recommendations: missingSteps.length > 0
      ? ['Complete all missing SOP fields before submission', ...missingSteps.slice(0, 3)]
      : ['All protocol steps documented — verify values are within validated ranges'],
  }
}

function generateStatisticsOutput(entry: EntryContext): ELNAgentOutput {
  const def = ELN_AGENT_DEFINITIONS.find(a => a.id === 'statistics')!
  const technique = entry.template
  const statsAdvice = getStatisticsAdvice(technique)

  return {
    agentId: 'statistics', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Statistical assessment for ${technique}: ${statsAdvice.recommendedTest} recommended with ${statsAdvice.minReplicates} minimum replicates.`,
    sections: [
      { heading: 'Recommended Statistical Tests', content: `For ${technique} experiments:`, items: statsAdvice.tests },
      { heading: 'Sample Size & Replicates', content: statsAdvice.sampleSizeNote, items: [`Minimum biological replicates: ${statsAdvice.minReplicates}`, `Recommended technical replicates: ${statsAdvice.techReplicates}`, `Power analysis: 80% power at α=0.05 typically requires n≥${statsAdvice.minN}`] },
      { heading: 'Common Statistical Pitfalls', content: 'Avoid these statistical errors:', items: statsAdvice.pitfalls },
    ],
    timestamp: now(), durationMs: score(500, 1500),
    scores: [
      { value: score(65, 90), label: 'Statistical Rigor', details: 'Adequate statistical planning' },
      { value: score(60, 85), label: 'Power Assessment', details: 'Sufficient sample size for conclusions' },
    ],
    warnings: [],
    recommendations: [
      `Use ${statsAdvice.recommendedTest} for primary analysis`,
      `Minimum ${statsAdvice.minReplicates} biological replicates needed`,
      'Report effect sizes with confidence intervals, not just p-values',
      'Pre-register analysis plan before data collection',
    ],
  }
}

function generateBiosafetyOutput(entry: EntryContext): ELNAgentOutput {
  const def = ELN_AGENT_DEFINITIONS.find(a => a.id === 'biosafety')!
  const risks = getBiosafetyRisks(entry.template, entry.data)

  return {
    agentId: 'biosafety', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Biosafety assessment: ${risks.level} risk. ${risks.ppe.length} PPE items required.`,
    sections: [
      { heading: 'Risk Assessment', content: `Overall biosafety risk level: ${risks.level.toUpperCase()}`, items: risks.hazards, severity: risks.level === 'high' ? 'critical' : risks.level === 'medium' ? 'warning' : 'info' },
      { heading: 'PPE Requirements', content: 'Required personal protective equipment:', items: risks.ppe },
      { heading: 'Waste Disposal', content: 'Proper waste disposal procedures:', items: risks.waste },
      { heading: 'Emergency Procedures', content: 'Know the location of:', items: ['Emergency eyewash station', 'Safety shower', 'Spill kit', 'Fire extinguisher', 'First aid kit', 'Emergency contact numbers'] },
    ],
    timestamp: now(), durationMs: score(500, 1400),
    scores: [
      { value: score(risks.level === 'low' ? 85 : 60, risks.level === 'low' ? 98 : 80), label: 'Safety Score', details: 'Overall biosafety compliance' },
      { value: score(70, 95), label: 'PPE Compliance', details: 'Adequate protective equipment' },
    ],
    warnings: risks.level === 'high' ? ['High biosafety risk — ensure BSL-2+ containment procedures are followed'] : [],
    recommendations: [
      'Review SDS for all chemicals before starting',
      'Verify biosafety cabinet certification is current',
      ...risks.recommendations.slice(0, 3),
    ],
  }
}

function generateLiteratureOutput(entry: EntryContext): ELNAgentOutput {
  const def = ELN_AGENT_DEFINITIONS.find(a => a.id === 'literature')!
  const refs = generateMockLiterature(entry)

  return {
    agentId: 'literature', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Found ${refs.length} relevant publications supporting this experimental approach.`,
    sections: [
      { heading: 'Related Publications', content: `Literature search for "${entry.title}" identified ${refs.length} relevant papers:`, items: refs.map(r => `${r.authors} (${r.year}). "${r.title}" — ${r.journal}. Relevance: ${r.relevanceScore}%`) },
      { heading: 'Key Methodological References', content: `Standard methodology references for ${entry.template}:`, items: getMethodReferences(entry.template) },
      { heading: 'Recent Advances', content: 'Consider incorporating these recent methodological improvements:', items: getRecentAdvances(entry.template) },
    ],
    timestamp: now(), durationMs: score(800, 2000),
    scores: [
      { value: score(70, 92), label: 'Literature Support', details: 'Method supported by published evidence' },
      { value: score(65, 88), label: 'Currency', details: 'Using up-to-date methodology' },
    ],
    warnings: [],
    recommendations: [
      'Cite methodological references in your lab notebook',
      'Check for conflicting findings in recent publications',
      'Consider newer protocols that may improve efficiency',
    ],
  }
}

function generateReproducibilityOutput(entry: EntryContext): ELNAgentOutput {
  const def = ELN_AGENT_DEFINITIONS.find(a => a.id === 'reproducibility')!
  const filledFields = Object.values(entry.data).filter(v => v.trim().length > 0).length
  const totalFields = Object.keys(entry.data).length
  const hasFAIR = entry.tags.length > 0
  const hasNotes = entry.notes.length > 100
  const detailScore = Math.round(((filledFields / Math.max(totalFields, 1)) * 50) + (hasFAIR ? 20 : 0) + (hasNotes ? 30 : 0))

  const missingMetadata: string[] = []
  if (!hasFAIR) missingMetadata.push('No tags/keywords — add for FAIR discoverability')
  if (!hasNotes) missingMetadata.push('Insufficient notes — document observations and deviations')
  if (entry.template === 'pcr' && !entry.data.annealing_temp) missingMetadata.push('Annealing temperature missing — critical for reproducibility')
  if (entry.template === 'western' && !entry.data.exposure_time) missingMetadata.push('Exposure time missing — critical for quantification')

  return {
    agentId: 'reproducibility', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Reproducibility score: ${Math.min(detailScore + score(0, 15), 100)}/100. ${missingMetadata.length} metadata gaps found.`,
    sections: [
      { heading: 'Metadata Completeness', content: `FAIR data assessment: ${filledFields}/${totalFields} fields documented.`, items: [`Tags: ${entry.tags.length > 0 ? entry.tags.join(', ') : 'None'}`, `Notes length: ${entry.notes.length} characters`, `Template completeness: ${Math.round((filledFields / Math.max(totalFields, 1)) * 100)}%`] },
      { heading: 'Missing Metadata', content: missingMetadata.length > 0 ? 'Required metadata not recorded:' : 'All critical metadata captured.', items: missingMetadata, severity: missingMetadata.length > 2 ? 'warning' : 'info' },
      { heading: 'FAIR Principles Assessment', content: 'Assessment against FAIR data principles:', items: ['Findable: ' + (entry.tags.length > 0 ? '✓ Tagged and searchable' : '✗ Add tags'), 'Accessible: ✓ Stored in ELN system', 'Interoperable: ' + (entry.template !== 'custom' ? '✓ Structured template' : '⚠ Custom format — consider structured template'), 'Reusable: ' + (hasNotes ? '✓ Sufficient documentation' : '✗ Add detailed notes')] },
    ],
    timestamp: now(), durationMs: score(500, 1500),
    scores: [
      { value: Math.min(detailScore + score(0, 15), 100), label: 'Reproducibility', details: 'Can another researcher reproduce this?' },
      { value: score(hasFAIR ? 70 : 40, hasFAIR ? 95 : 60), label: 'FAIR Compliance', details: 'Findable, Accessible, Interoperable, Reusable' },
    ],
    warnings: detailScore < 40 ? ['Low reproducibility score — significant metadata gaps'] : [],
    recommendations: missingMetadata.length > 0
      ? ['Complete all missing metadata fields', ...missingMetadata.slice(0, 2)]
      : ['Good documentation — consider adding equipment serial numbers and lot numbers'],
  }
}

function generateOptimizationOutput(entry: EntryContext): ELNAgentOutput {
  const def = ELN_AGENT_DEFINITIONS.find(a => a.id === 'optimization')!
  const opts = getOptimizationSuggestions(entry.template)

  return {
    agentId: 'optimization', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `${opts.suggestions.length} optimization opportunities identified for ${entry.template}.`,
    sections: [
      { heading: 'Time Optimization', content: 'Potential time savings:', items: opts.time },
      { heading: 'Cost Reduction', content: 'Potential cost savings:', items: opts.cost },
      { heading: 'Quality Improvements', content: 'Suggested quality improvements:', items: opts.quality },
      { heading: 'Alternative Methods', content: 'Consider these alternative approaches:', items: opts.alternatives },
    ],
    timestamp: now(), durationMs: score(500, 1400),
    scores: [
      { value: score(60, 85), label: 'Optimization Potential', details: 'Room for protocol improvement' },
      { value: score(65, 90), label: 'Efficiency', details: 'Current workflow efficiency' },
    ],
    warnings: [],
    recommendations: opts.suggestions.slice(0, 4),
  }
}

function generateResearchMemoryOutput(entry: EntryContext): ELNAgentOutput {
  const def = ELN_AGENT_DEFINITIONS.find(a => a.id === 'research-memory')!

  return {
    agentId: 'research-memory', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Research memory analysis: compared against historical experiments in ${entry.template} category.`,
    sections: [
      { heading: 'Related Historical Experiments', content: `Searching lab history for experiments similar to "${entry.title}":`, items: [`Similar ${entry.template} experiments found in lab records`, 'Cross-referencing with project-level experiment history', 'Checking for previously optimized conditions'] },
      { heading: 'Common Failure Patterns', content: `Typical issues observed in ${entry.template} experiments:`, items: getCommonFailures(entry.template) },
      { heading: 'Lessons Learned', content: 'Key insights from previous experiments:', items: ['Always verify reagent lot consistency between experiments', 'Document environmental conditions (temperature, humidity)', 'Note any equipment maintenance or calibration changes', 'Record operator experience level for training purposes'] },
    ],
    timestamp: now(), durationMs: score(600, 1600),
    scores: [
      { value: score(65, 88), label: 'Similarity Match', details: 'Relevance to historical experiments' },
      { value: score(60, 85), label: 'Learning Extraction', details: 'Actionable insights from history' },
    ],
    warnings: [],
    recommendations: [
      'Compare results with previous experiments using the same conditions',
      'Document any variations from previous successful runs',
      'Track cumulative data across related experiments',
      'Note environmental factors that may affect reproducibility',
    ],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

export interface ELNSwarmCallbacks {
  onAgentStart?: (agentId: ELNAgentId, agentName: string) => void
  onAgentComplete?: (output: ELNAgentOutput, idx: number, total: number) => void
  shouldCancel?: () => boolean
}

const AGENT_GENERATORS: Record<ELNAgentId, (entry: EntryContext) => ELNAgentOutput> = {
  'scientific-reviewer': generateScientificReviewerOutput,
  'protocol-compliance': generateProtocolComplianceOutput,
  'statistics': generateStatisticsOutput,
  'biosafety': generateBiosafetyOutput,
  'literature': generateLiteratureOutput,
  'reproducibility': generateReproducibilityOutput,
  'optimization': generateOptimizationOutput,
  'research-memory': generateResearchMemoryOutput,
}

export async function runELNSwarmReview(
  entry: EntryContext,
  callbacks?: ELNSwarmCallbacks,
): Promise<ELNSwarmReview> {
  const { onAgentStart, onAgentComplete, shouldCancel } = callbacks || {}

  const review: ELNSwarmReview = {
    id: uid(),
    entryId: 0,
    entryTitle: entry.title,
    template: entry.template,
    startedAt: now(),
    status: 'running',
    agents: [],
    consensus: emptyConsensus(),
  }

  const agentOrder: ELNAgentId[] = [
    'scientific-reviewer', 'protocol-compliance', 'statistics',
    'biosafety', 'literature', 'reproducibility', 'optimization', 'research-memory',
  ]

  for (let i = 0; i < agentOrder.length; i++) {
    if (shouldCancel?.()) break
    const agentId = agentOrder[i]
    const def = ELN_AGENT_DEFINITIONS.find(a => a.id === agentId)!
    onAgentStart?.(agentId, def.name)

    await delay(350 + Math.random() * 700)
    if (shouldCancel?.()) break

    const output = AGENT_GENERATORS[agentId](entry)
    review.agents.push(output)
    onAgentComplete?.(output, i, agentOrder.length)
  }

  review.consensus = computeELNConsensus(review.agents)
  review.completedAt = now()
  review.status = 'complete'
  return review
}

function emptyConsensus(): ELNConsensus {
  return { overallScore: 0, scientificScore: 0, complianceScore: 0, safetyScore: 0, reproducibilityScore: 0, optimizationScore: 0, confidenceScore: 0, riskLevel: 'low', agentAgreement: 0, topFindings: [], criticalIssues: [] }
}

function computeELNConsensus(agents: ELNAgentOutput[]): ELNConsensus {
  const allScores = agents.flatMap(a => a.scores.map(s => s.value))
  const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 70

  const findScore = (id: ELNAgentId, idx = 0) => agents.find(a => a.agentId === id)?.scores[idx]?.value ?? 75

  const scientificScore = findScore('scientific-reviewer', 0)
  const complianceScore = findScore('protocol-compliance', 0)
  const safetyScore = findScore('biosafety', 0)
  const reproducibilityScore = findScore('reproducibility', 0)
  const optimizationScore = findScore('optimization', 0)

  const allRecs = agents.flatMap(a => a.recommendations)
  const allWarnings = agents.flatMap(a => a.warnings)

  const riskLevel: ELNConsensus['riskLevel'] = safetyScore < 60 ? 'critical' : safetyScore < 75 ? 'high' : safetyScore < 85 ? 'medium' : 'low'

  return {
    overallScore: avg,
    scientificScore,
    complianceScore,
    safetyScore,
    reproducibilityScore,
    optimizationScore,
    confidenceScore: score(68, 92),
    riskLevel,
    agentAgreement: score(76, 96),
    topFindings: allRecs.slice(0, 6),
    criticalIssues: allWarnings,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPERIMENT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

export async function generateExperiment(input: ExperimentGeneratorInput): Promise<GeneratedExperiment> {
  await delay(1500 + Math.random() * 1500)

  const technique = input.technique
  const gene = input.gene || 'target gene'
  const cellLine = input.cellLine || 'appropriate cell line'
  const disease = input.disease || 'disease model'

  return {
    title: `${technique} Analysis of ${gene} in ${cellLine}`,
    hypothesis: `We hypothesize that ${gene} expression/activity is altered in ${disease}-associated ${cellLine} cells, and that ${technique} analysis will reveal quantifiable differences compared to control conditions.`,
    controls: {
      positive: [`Known ${gene}-expressing cell line or recombinant ${gene} protein`, `Previously validated positive sample from lab records`],
      negative: [`${gene}-knockout or siRNA-depleted cells`, `No-template control (NTC) / isotype control`, `Vehicle-only treated cells`],
      internal: [`Housekeeping gene (GAPDH, ACTB, or 18S rRNA) for normalization`, `Loading control (β-actin or total protein stain)`],
    },
    experimentalDesign: `1. Prepare ${cellLine} cells under standard culture conditions\n2. Apply experimental treatment vs. vehicle control\n3. Harvest at predetermined time points (e.g., 24h, 48h, 72h)\n4. Process samples for ${technique} analysis\n5. Acquire data with appropriate instrument settings\n6. Analyze using pre-registered statistical plan`,
    replicates: `Minimum 3 biological replicates (independent cell passages) with 3 technical replicates each. N = 9 total data points per condition.`,
    expectedResults: `If hypothesis is correct: Significant difference (p < 0.05) in ${gene} levels between experimental and control groups, with effect size > 1.5-fold change.`,
    statisticalPlan: `Primary analysis: Two-tailed Student's t-test (two groups) or one-way ANOVA with post-hoc Tukey (multiple groups). Report means ± SEM, 95% confidence intervals, and exact p-values. Power analysis: 80% power to detect 1.5-fold change at α = 0.05.`,
    requiredReagents: getReagentsForTechnique(technique),
    requiredEquipment: getEquipmentForTechnique(technique),
    potentialPitfalls: getPitfallsForTechnique(technique),
    estimatedTime: getTimeEstimate(technique),
    biosafetyConsiderations: `BSL-2 containment for human cell line work. Wear lab coat, nitrile gloves, and safety glasses. Work in certified biosafety cabinet. Dispose of biological waste in biohazard containers.`,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART TEMPLATE SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function getSmartSuggestions(template: string): TemplateSuggestions {
  const suggestions: SmartSuggestion[] = []

  if (template === 'pcr') {
    suggestions.push(
      { field: 'gene_target', category: 'Housekeeping Genes', icon: '🧬', items: [
        { label: 'GAPDH', detail: 'Glyceraldehyde-3-phosphate dehydrogenase — most common reference' },
        { label: 'ACTB (β-actin)', detail: 'Cytoskeletal protein — stable across many conditions' },
        { label: '18S rRNA', detail: 'Ribosomal RNA — abundant, very stable' },
        { label: 'HPRT1', detail: 'Hypoxanthine phosphoribosyltransferase — low expression housekeeping' },
        { label: 'B2M', detail: 'Beta-2-microglobulin — useful for immune cell work' },
      ]},
      { field: 'primer_forward', category: 'Primer Design Guidance', icon: '🎯', items: [
        { label: 'Length: 18-25 bp', detail: 'Optimal primer length for specificity' },
        { label: 'Tm: 58-62°C', detail: 'Melting temperature within 2°C between primers' },
        { label: 'GC content: 40-60%', detail: 'Balanced base composition' },
        { label: 'Avoid 3\' complementarity', detail: 'Prevents primer-dimer formation' },
        { label: 'Span exon junctions', detail: 'Prevents genomic DNA amplification (for cDNA)' },
      ]},
      { field: 'results', category: 'Expected Ct Ranges', icon: '📊', items: [
        { label: 'Housekeeping: Ct 15-20', detail: 'GAPDH, ACTB typically in this range' },
        { label: 'Moderate expression: Ct 20-25', detail: 'Most expressed genes' },
        { label: 'Low expression: Ct 25-30', detail: 'May need more input cDNA' },
        { label: 'Very low: Ct 30-35', detail: 'Near detection limit — validate carefully' },
        { label: 'Ct > 35: Unreliable', detail: 'Below reliable quantification — consider enrichment' },
      ]},
      { field: 'troubleshooting', category: 'Common Issues', icon: '🔧', items: [
        { label: 'No amplification', detail: 'Check template quality, primer design, and polymerase activity' },
        { label: 'Multiple bands', detail: 'Increase annealing temp, redesign primers, reduce cycles' },
        { label: 'High Ct variation', detail: 'Improve pipetting consistency, use master mix' },
        { label: 'Primer dimers', detail: 'Redesign primers, increase annealing temp, reduce primer conc' },
      ]},
    )
  } else if (template === 'western') {
    suggestions.push(
      { field: 'antibody_primary', category: 'Loading Controls', icon: '🔬', items: [
        { label: 'β-actin (42 kDa)', detail: 'Most common — avoid if studying cytoskeletal changes' },
        { label: 'GAPDH (36 kDa)', detail: 'Glycolytic enzyme — may vary in metabolic studies' },
        { label: 'α-tubulin (50 kDa)', detail: 'Cytoskeletal protein — stable in most conditions' },
        { label: 'Histone H3 (15 kDa)', detail: 'Nuclear loading control' },
        { label: 'Total protein stain', detail: 'Ponceau S or stain-free — most unbiased' },
      ]},
      { field: 'dilution_primary', category: 'Antibody Dilutions', icon: '💉', items: [
        { label: 'Start at 1:1000', detail: 'Standard starting dilution for most antibodies' },
        { label: 'High-affinity: 1:5000-1:10000', detail: 'For well-validated, high-titer antibodies' },
        { label: 'Low signal: 1:500', detail: 'For low-abundance targets or weak antibodies' },
        { label: 'Optimize: titrate 1:500-1:5000', detail: 'Always titrate new antibodies' },
      ]},
      { field: 'blocking', category: 'Transfer Conditions', icon: '⚡', items: [
        { label: 'Wet transfer: 100V, 1hr', detail: 'Standard for most proteins 20-150 kDa' },
        { label: 'Semi-dry: 25V, 30min', detail: 'Faster, good for proteins < 100 kDa' },
        { label: 'High MW (>150 kDa)', detail: 'Add 0.1% SDS, increase transfer time, use 0.45μm PVDF' },
        { label: 'Low MW (<20 kDa)', detail: 'Use 0.2μm membrane, reduce methanol to 10%' },
      ]},
    )
  } else if (template === 'cell_culture') {
    suggestions.push(
      { field: 'cell_line', category: 'Confluency Targets', icon: '🦠', items: [
        { label: 'Passage at 70-80%', detail: 'Standard passage point for most adherent cells' },
        { label: 'Experiment at 60-70%', detail: 'Optimal for drug treatment and transfection' },
        { label: 'Never exceed 100%', detail: 'Contact inhibition alters gene expression' },
        { label: 'HEK293: passage at 80%', detail: 'Loosely adherent — handle gently' },
      ]},
      { field: 'media', category: 'Common Media', icon: '🧪', items: [
        { label: 'DMEM + 10% FBS', detail: 'Most common for adherent cell lines (HeLa, HEK293)' },
        { label: 'RPMI-1640 + 10% FBS', detail: 'Suspension cells, lymphocytes, leukemia lines' },
        { label: 'MEM + 10% FBS', detail: 'Primary cells, slower-growing lines' },
        { label: 'Serum-free media', detail: 'For defined conditions — supplement with growth factors' },
      ]},
      { field: 'viability', category: 'Authentication Notes', icon: '✅', items: [
        { label: 'STR profile every 6 months', detail: 'ATCC recommends routine authentication' },
        { label: 'Mycoplasma test monthly', detail: 'Use PCR-based detection kit' },
        { label: 'Max passage: P20-30', detail: 'Higher passages may show genetic drift' },
        { label: 'Freeze master stocks', detail: 'Cryopreserve validated early-passage cells' },
      ]},
    )
  } else if (template === 'flow_cytometry') {
    suggestions.push(
      { field: 'markers', category: 'Common Panels', icon: '💧', items: [
        { label: 'T cell: CD3/CD4/CD8', detail: 'Basic T cell phenotyping panel' },
        { label: 'B cell: CD19/CD20/IgD/CD27', detail: 'B cell maturation and memory' },
        { label: 'Myeloid: CD14/CD16/CD11b', detail: 'Monocyte/macrophage identification' },
        { label: 'Viability: Live/Dead Aqua', detail: 'Always include viability dye' },
      ]},
      { field: 'gating', category: 'Gating Strategy', icon: '🎯', items: [
        { label: 'FSC-A vs SSC-A', detail: 'First gate: remove debris' },
        { label: 'FSC-H vs FSC-A', detail: 'Singlet discrimination — essential' },
        { label: 'Viability gate', detail: 'Exclude dead cells before phenotyping' },
        { label: 'FMO controls', detail: 'Fluorescence-minus-one for accurate gating' },
      ]},
    )
  } else if (template === 'elisa') {
    suggestions.push(
      { field: 'standard_curve', category: 'Standard Curve Tips', icon: '📈', items: [
        { label: '7-point curve + blank', detail: 'Minimum for accurate quantification' },
        { label: '2-fold serial dilution', detail: 'Standard dilution scheme' },
        { label: 'R² > 0.99', detail: 'Minimum acceptable curve fit' },
        { label: 'Run in duplicate', detail: 'Standards in duplicate, samples in triplicate' },
      ]},
    )
  }

  // Add universal suggestions for all templates
  suggestions.push(
    { field: '_general', category: 'Documentation Best Practices', icon: '📝', items: [
      { label: 'Record reagent lot numbers', detail: 'Critical for troubleshooting batch effects' },
      { label: 'Note equipment calibration dates', detail: 'Ensures data validity' },
      { label: 'Document deviations', detail: 'Any changes from standard protocol' },
      { label: 'Include raw data reference', detail: 'Link to raw data file location' },
    ]},
  )

  return { template, suggestions }
}

// ═══════════════════════════════════════════════════════════════════════════
// MANUSCRIPT & GRANT GENERATION
// ═══════════════════════════════════════════════════════════════════════════

export async function generateManuscriptSection(
  entry: EntryContext,
  sectionType: ManuscriptSection['type'],
): Promise<ManuscriptSection> {
  await delay(800 + Math.random() * 1200)

  const templateLabel = entry.template.replace(/_/g, ' ')

  const sections: Record<ManuscriptSection['type'], ManuscriptSection> = {
    methods: {
      type: 'methods', title: 'Methods',
      content: `${templateLabel.charAt(0).toUpperCase() + templateLabel.slice(1)}\n\n${Object.entries(entry.data).filter(([, v]) => v.trim()).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v}`).join('. ')}. All experiments were performed in accordance with institutional protocols and approved SOPs. ${entry.notes ? `Additional observations: ${entry.notes.replace(/<[^>]*>/g, '').slice(0, 200)}` : ''}`,
    },
    results: {
      type: 'results', title: 'Results',
      content: `${entry.data.results || entry.data.observations || 'Results were collected and analyzed as described in the Methods section. [Insert quantitative data, statistical analysis, and figure references here.]'}`,
    },
    'figure-legend': {
      type: 'figure-legend', title: 'Figure Legend',
      content: `Figure X. ${entry.title}. ${templateLabel.charAt(0).toUpperCase() + templateLabel.slice(1)} was performed as described in Methods. ${entry.data.results ? `Key findings: ${entry.data.results.slice(0, 150)}` : '[Describe what the figure shows, including sample conditions, controls, and key observations.]'} Data represent mean ± SEM from n = 3 biological replicates. Statistical significance: *p < 0.05, **p < 0.01, ***p < 0.001.`,
    },
    supplementary: {
      type: 'supplementary', title: 'Supplementary Methods',
      content: `Detailed ${templateLabel} Protocol\n\n${Object.entries(entry.data).filter(([, v]) => v.trim()).map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n${v}`).join('\n\n')}${entry.notes ? `\n\nAdditional Notes\n${entry.notes.replace(/<[^>]*>/g, '')}` : ''}`,
    },
    materials: {
      type: 'materials', title: 'Materials',
      content: `The following materials were used: ${Object.entries(entry.data).filter(([k]) => k.includes('antibody') || k.includes('kit') || k.includes('media') || k.includes('reagent') || k.includes('instrument')).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join('; ') || '[List all reagents with catalog numbers, suppliers, and lot numbers.]'}`,
    },
  }

  return sections[sectionType]
}

export async function generateGrantSection(
  entry: EntryContext,
  sectionType: GrantSection['type'],
): Promise<GrantSection> {
  await delay(800 + Math.random() * 1200)

  const sections: Record<GrantSection['type'], GrantSection> = {
    'preliminary-data': {
      type: 'preliminary-data', title: 'Preliminary Data',
      content: `Our preliminary studies using ${entry.template.replace(/_/g, ' ')} have established the foundation for the proposed research. In the experiment "${entry.title}", we observed ${entry.data.results || entry.data.observations || '[insert key preliminary finding]'}. These initial results demonstrate the feasibility of our approach and support the proposed specific aims.`,
    },
    significance: {
      type: 'significance', title: 'Significance',
      content: `This research addresses a critical gap in our understanding of ${entry.tags.join(', ') || '[research area]'}. The experiments described herein, including "${entry.title}", demonstrate the potential to advance the field by providing new insights through ${entry.template.replace(/_/g, ' ')} analysis.`,
    },
    innovation: {
      type: 'innovation', title: 'Innovation',
      content: `The proposed research is innovative in its application of ${entry.template.replace(/_/g, ' ')} to address ${entry.tags[0] || '[research question]'}. Our approach combines established methodology with novel experimental design, as demonstrated in our preliminary work "${entry.title}".`,
    },
    strategy: {
      type: 'strategy', title: 'Research Strategy',
      content: `Our research strategy employs ${entry.template.replace(/_/g, ' ')} as a primary analytical method. Based on our preliminary data from "${entry.title}", we will systematically investigate ${entry.tags.join(' and ') || '[research objectives]'} using the following approach: [Describe specific aims and experimental timeline].`,
    },
    progress: {
      type: 'progress', title: 'Progress Report',
      content: `During the reporting period, we conducted ${entry.template.replace(/_/g, ' ')} experiments including "${entry.title}". Key accomplishments: ${entry.data.results || entry.data.observations || '[Summarize key results and milestones achieved]'}. These findings support continued investigation and are consistent with the proposed timeline.`,
    },
  }

  return sections[sectionType]
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════════════════

export async function askELNSwarm(
  question: string,
  context: { entryTitle?: string; template?: string },
): Promise<ELNSwarmMessage> {
  await delay(500 + Math.random() * 1000)

  const q = question.toLowerCase()
  let agentId: ELNAgentId = 'scientific-reviewer'
  let content = ''

  if (q.includes('control') || q.includes('positive') || q.includes('negative')) {
    agentId = 'scientific-reviewer'
    content = `🔬 **Controls Recommendation for ${context.template || 'your experiment'}**\n\n• **Positive Control**: Use a validated reference sample known to produce expected results.\n• **Negative Control**: No-template/vehicle-only control to detect contamination or non-specific effects.\n• **Internal Control**: Housekeeping gene/protein for normalization (GAPDH, β-actin).\n\nAlways run controls with every batch. Never skip controls to save reagents.`
  } else if (q.includes('statistic') || q.includes('sample size') || q.includes('replicate') || q.includes('p-value')) {
    agentId = 'statistics'
    content = `📊 **Statistical Guidance**\n\n• **Minimum replicates**: 3 biological replicates with 3 technical replicates each\n• **Test selection**: t-test (2 groups) or ANOVA (>2 groups)\n• **Power**: 80% power to detect 1.5-fold change at α = 0.05\n• **Reporting**: Always report exact p-values, effect sizes, and confidence intervals\n\nAvoid pseudo-replication — technical replicates are not independent observations.`
  } else if (q.includes('safety') || q.includes('ppe') || q.includes('hazard') || q.includes('biosafety')) {
    agentId = 'biosafety'
    content = `☣️ **Biosafety Assessment**\n\n• **PPE**: Lab coat, nitrile gloves, safety glasses (minimum)\n• **BSC**: Use certified biosafety cabinet for all cell work\n• **Waste**: Autoclave biological waste, collect chemical waste separately\n• **Emergency**: Know location of eyewash, safety shower, and spill kit\n\nConsult your institutional biosafety officer for site-specific requirements.`
  } else if (q.includes('troubleshoot') || q.includes('fail') || q.includes('problem') || q.includes('not working')) {
    agentId = 'optimization'
    content = `⚡ **Troubleshooting Guide**\n\n1. **Verify reagents**: Check expiry dates, lot numbers, and storage conditions\n2. **Check equipment**: Confirm calibration and maintenance records\n3. **Review protocol**: Compare step-by-step against validated SOP\n4. **Systematic approach**: Change one variable at a time\n5. **Document everything**: Record all troubleshooting attempts\n\nRoot cause analysis: Ask "why" 5 times to find the true cause.`
  } else if (q.includes('literature') || q.includes('paper') || q.includes('reference') || q.includes('publish')) {
    agentId = 'literature'
    content = `📚 **Literature Intelligence**\n\nFor "${context.entryTitle || 'your experiment'}":\n\n• Search PubMed for recent methodological papers\n• Check for conflicting findings in the literature\n• Cite the original method paper and any modifications\n• Look for recent reviews that summarize best practices\n\nTip: Set up PubMed alerts for your research keywords.`
  } else if (q.includes('manuscript') || q.includes('methods section') || q.includes('write')) {
    agentId = 'scientific-reviewer'
    content = `🔬 **Manuscript Writing Support**\n\nI can generate the following sections from your experiment data:\n\n• **Methods Section**: Formatted experimental procedures\n• **Results Section**: Quantitative results summary\n• **Figure Legends**: Publication-ready figure descriptions\n• **Supplementary Methods**: Detailed protocols\n• **Materials List**: Reagents with catalog numbers\n\nUse the Manuscript tab in the AI Review panel to generate these sections.`
  } else {
    content = `🔬 **Research Intelligence**\n\nRegarding "${context.entryTitle || 'your experiment'}":\n\nThe AI Swarm can help with:\n• Scientific review and methodology assessment\n• Statistical planning and power analysis\n• Biosafety risk assessment\n• Literature search and reference suggestions\n• Protocol compliance checking\n• Reproducibility analysis\n• Optimization recommendations\n\nTry asking about: controls, statistics, safety, troubleshooting, literature, or manuscript writing.`
  }

  return {
    id: uid(), role: 'swarm', agentId, content, timestamp: now(),
    suggestions: ['What controls should I use?', 'Is my sample size adequate?', 'What are the safety requirements?', 'Help troubleshoot my experiment'].filter(() => Math.random() > 0.4).slice(0, 3),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER DATA
// ═══════════════════════════════════════════════════════════════════════════

function getMethodologyTips(template: string): string[] {
  const tips: Record<string, string[]> = {
    pcr: ['Validate primer specificity with melt curve or gel', 'Use no-template controls every run', 'Include reference gene for normalization', 'Ensure R² > 0.98 for standard curves', 'Report amplification efficiency (90-110%)'],
    western: ['Validate antibodies before use (positive control)', 'Include molecular weight markers', 'Use total protein stain instead of single-protein loading control', 'Document exposure times for quantification', 'Include biological replicates, not just technical'],
    elisa: ['Run standard curve on every plate', 'Use duplicate standards, triplicate samples', 'Check R² > 0.99 for standard curve', 'Validate kit specificity and cross-reactivity', 'Record incubation temperatures and times'],
    cell_culture: ['Verify cell line identity by STR profiling', 'Test for mycoplasma monthly', 'Record passage number for every experiment', 'Document media lot numbers', 'Monitor morphology before experiments'],
    flow_cytometry: ['Use compensation beads for every experiment', 'Include FMO controls for accurate gating', 'Acquire minimum 10,000 events in gate of interest', 'Document laser configuration and filter sets', 'Include viability dye to exclude dead cells'],
    sequencing: ['Verify library quality by Bioanalyzer/TapeStation', 'Include positive and negative controls', 'Document index sequences for demultiplexing', 'Record PhiX spike-in percentage', 'Validate bioinformatics pipeline with known samples'],
    custom: ['Document all parameters systematically', 'Include appropriate controls', 'Record environmental conditions', 'Note any deviations from planned protocol'],
  }
  return tips[template] || tips.custom
}

function getStatisticsAdvice(template: string): { recommendedTest: string; minReplicates: number; techReplicates: number; minN: number; sampleSizeNote: string; tests: string[]; pitfalls: string[] } {
  const base = {
    pitfalls: ['Confusing technical with biological replicates', 'Multiple comparisons without correction', 'Reporting only significant results (p-hacking)', 'Using parametric tests on non-normal data', 'Ignoring batch effects'],
  }
  const advice: Record<string, Partial<typeof base & { recommendedTest: string; minReplicates: number; techReplicates: number; minN: number; sampleSizeNote: string; tests: string[] }>> = {
    pcr: { recommendedTest: 'Paired t-test (ΔΔCt method)', minReplicates: 3, techReplicates: 3, minN: 9, sampleSizeNote: 'For qPCR, 3 biological replicates with 3 technical replicates is standard.', tests: ['ΔΔCt method for relative quantification', 'Paired t-test for two-group comparison', 'One-way ANOVA for multiple groups', 'Wilcoxon signed-rank if data is non-normal'] },
    western: { recommendedTest: 'Densitometry with paired t-test', minReplicates: 3, techReplicates: 1, minN: 3, sampleSizeNote: 'Western blots require minimum 3 independent biological replicates for quantification.', tests: ['Densitometry analysis (ImageJ/Image Lab)', 'Paired t-test normalized to loading control', 'One-way ANOVA for dose-response', 'Kruskal-Wallis for non-parametric data'] },
    flow_cytometry: { recommendedTest: 'Mann-Whitney U test', minReplicates: 3, techReplicates: 1, minN: 5, sampleSizeNote: 'Flow cytometry: minimum 3 biological replicates, 10K+ events per sample.', tests: ['Mann-Whitney U (non-parametric two-group)', 'Kruskal-Wallis (multiple groups)', 'Chi-square for proportions', 'Log-transform for MFI data'] },
  }
  const spec = advice[template] || {}
  return {
    recommendedTest: spec.recommendedTest || 'Student\'s t-test or Mann-Whitney U',
    minReplicates: spec.minReplicates || 3, techReplicates: spec.techReplicates || 3, minN: spec.minN || 6,
    sampleSizeNote: spec.sampleSizeNote || 'Minimum 3 biological replicates recommended for most experiments.',
    tests: spec.tests || ['Student\'s t-test (parametric, two groups)', 'One-way ANOVA (parametric, >2 groups)', 'Mann-Whitney U (non-parametric, two groups)', 'Kruskal-Wallis (non-parametric, >2 groups)'],
    pitfalls: base.pitfalls,
  }
}

function getBiosafetyRisks(template: string, data: Record<string, string>): { level: 'low' | 'medium' | 'high'; hazards: string[]; ppe: string[]; waste: string[]; recommendations: string[] } {
  const hasCells = template === 'cell_culture' || template === 'flow_cytometry'
  const hasChemicals = template === 'western' || template === 'elisa'

  return {
    level: hasCells ? 'medium' : hasChemicals ? 'medium' : 'low',
    hazards: [
      ...(hasCells ? ['Human cell lines — potential biohazard (BSL-2)', 'Mycoplasma contamination risk'] : []),
      ...(hasChemicals ? ['Chemical reagents — review SDS for all chemicals', 'Acrylamide (western) — potential carcinogen'] : []),
      ...(template === 'pcr' ? ['Ethidium bromide (if used) — mutagen', 'UV exposure during gel imaging'] : []),
      'Sharps — needles, broken glass, scalpel blades',
    ],
    ppe: ['Nitrile gloves', 'Lab coat', 'Safety glasses', ...(hasCells ? ['Face shield (if splash risk)', 'Biosafety cabinet use required'] : [])],
    waste: [
      ...(hasCells ? ['Autoclave all biological waste', 'Bleach-treat liquid biological waste (10% final)'] : []),
      ...(hasChemicals ? ['Collect chemical waste in labeled containers', 'Do not mix incompatible waste streams'] : []),
      'Dispose of sharps in puncture-resistant containers',
    ],
    recommendations: [
      'Review SDS for all reagents before starting',
      'Ensure biosafety cabinet is certified and operational',
      'Know emergency procedures for your lab space',
      ...(hasCells ? ['Handle human cell lines at BSL-2 minimum'] : []),
    ],
  }
}

function getOptimizationSuggestions(template: string): { suggestions: string[]; time: string[]; cost: string[]; quality: string[]; alternatives: string[] } {
  const opts: Record<string, { time: string[]; cost: string[]; quality: string[]; alternatives: string[] }> = {
    pcr: {
      time: ['Use fast polymerases to reduce run time by 50%', 'Prepare master mixes in advance', 'Combine gradient PCR for optimization runs'],
      cost: ['Optimize reaction volumes (10-15 μL instead of 50 μL)', 'Use universal primers where possible', 'Bulk-purchase commonly used reagents'],
      quality: ['Use hot-start polymerases to reduce non-specific amplification', 'Include melt curve analysis for SYBR Green assays', 'Validate with gel electrophoresis for new primers'],
      alternatives: ['Consider ddPCR for absolute quantification', 'Use multiplex panels to reduce reactions', 'Digital PCR for rare variant detection'],
    },
    western: {
      time: ['Use stain-free gels to eliminate transfer verification', 'Semi-dry transfer saves 1+ hours', 'Fluorescent detection eliminates development time'],
      cost: ['Strip and reprobe membranes for multiple targets', 'Use 0.45mm mini-gels to reduce reagent volumes', 'Validate with dot blot before full western'],
      quality: ['Use total protein staining over single loading controls', 'Quantify with digital imaging, not film', 'Include molecular weight markers on every gel'],
      alternatives: ['Capillary western (Wes/Jess) for automation', 'Simple Western for high throughput', 'Mass spec for unbiased protein detection'],
    },
  }
  const spec = opts[template] || { time: ['Parallelize preparation steps', 'Pre-make common solutions'], cost: ['Optimize reagent volumes', 'Source from multiple suppliers'], quality: ['Implement QC checkpoints', 'Document all parameters'], alternatives: ['Review recent literature for improved methods'] }

  return { suggestions: [...spec.time.slice(0, 1), ...spec.cost.slice(0, 1), ...spec.quality.slice(0, 1), ...spec.alternatives.slice(0, 1)], ...spec }
}

function getCommonFailures(template: string): string[] {
  const failures: Record<string, string[]> = {
    pcr: ['No amplification — primer design or template quality issue', 'Multiple bands — non-specific amplification, reduce primer concentration', 'High Ct values — low template input or degraded RNA', 'Primer dimers dominating at low template concentrations'],
    western: ['No bands — antibody doesn\'t work, wrong conditions', 'High background — insufficient blocking or washing', 'Multiple bands — non-specific antibody binding', 'Uneven transfer — air bubbles or insufficient contact'],
    cell_culture: ['Mycoplasma contamination — test regularly', 'Slow growth — check media, passage number, CO2 levels', 'Cell death after treatment — optimize drug concentration range', 'Cross-contamination — authenticate cell lines regularly'],
    flow_cytometry: ['Poor compensation — use single-stained controls', 'Dead cell artifacts — always use viability dye', 'Low signal — optimize antibody titration', 'Clogged instrument — filter all samples through 40μm strainer'],
    elisa: ['No signal — check antibody pair compatibility', 'High background — improve blocking and washing', 'Poor standard curve — prepare fresh standards', 'Edge effects on plate — ensure consistent incubation temperature'],
  }
  return failures[template] || ['Reagent degradation — check expiry dates', 'Equipment calibration drift', 'Environmental variability affecting results', 'Operator technique variation']
}

function generateMockLiterature(entry: EntryContext): LiteratureResult[] {
  const templateLabel = entry.template.replace(/_/g, ' ')
  return [
    { title: `Optimized ${templateLabel} protocols for reproducible results`, authors: 'Smith et al.', journal: 'Nature Methods', year: 2024, relevanceScore: 92, summary: `Comprehensive optimization of ${templateLabel} workflow with validated parameters.`, keyFindings: ['Improved sensitivity', 'Reduced variability'] },
    { title: `Best practices in ${templateLabel}: a systematic review`, authors: 'Johnson et al.', journal: 'Methods', year: 2023, relevanceScore: 88, summary: 'Systematic comparison of protocol variations across laboratories.', keyFindings: ['Standardized conditions improve reproducibility', 'Key critical parameters identified'] },
    { title: `Quality control standards for ${templateLabel} in biomedical research`, authors: 'Williams et al.', journal: 'PLoS ONE', year: 2024, relevanceScore: 85, summary: 'Established minimum reporting standards and QC metrics.', keyFindings: ['Minimum replicate requirements', 'Required controls for publication'] },
  ]
}

function getMethodReferences(template: string): string[] {
  const refs: Record<string, string[]> = {
    pcr: ['Bustin SA et al. (2009). The MIQE guidelines. Clinical Chemistry.', 'Livak KJ & Schmittgen TD (2001). Analysis using 2(-ΔΔCt) method. Methods.'],
    western: ['Mahmood T & Yang PC (2012). Western blot technique. N Am J Med Sci.', 'Bass JJ et al. (2017). Overrepresentation of loading controls. J Proteomics.'],
    flow_cytometry: ['Cossarizza A et al. (2019). Flow cytometry guidelines. Eur J Immunol.', 'Maecker HT et al. (2012). Standardizing immunophenotyping. Nat Rev Immunol.'],
    cell_culture: ['ATCC Cell Culture Guide (2024). Primary reference for cell maintenance.', 'Drexler HG et al. (2017). Cross-contamination of cell lines. Int J Cancer.'],
  }
  return refs[template] || ['Consult PubMed for methodology-specific references.', 'Review recent Nature Methods papers for current best practices.']
}

function getRecentAdvances(template: string): string[] {
  const advances: Record<string, string[]> = {
    pcr: ['Digital PCR for absolute quantification without standard curves', 'Isothermal amplification alternatives (LAMP, RPA)', 'CRISPR-based detection (SHERLOCK, DETECTR)'],
    western: ['Capillary electrophoresis western systems (Wes, Jess)', 'Total protein staining replacing single-protein loading controls', 'Multiplexed fluorescent detection (up to 4 targets)'],
    flow_cytometry: ['Spectral flow cytometry (40+ parameters)', 'Mass cytometry (CyTOF, 50+ markers)', 'Imaging flow cytometry (ImageStream)'],
    cell_culture: ['3D organoid and spheroid culture systems', 'Organ-on-chip microfluidic devices', 'CRISPR-based cell line engineering'],
  }
  return advances[template] || ['Check recent publications for methodological improvements.', 'Consider automation for improved reproducibility.']
}

function getReagentsForTechnique(technique: string): string[] {
  if (technique.toLowerCase().includes('pcr')) return ['Polymerase (Taq/high-fidelity)', 'dNTPs', 'Primers (forward/reverse)', 'Buffer', 'MgCl2', 'SYBR Green or TaqMan probes', 'Nuclease-free water', 'cDNA synthesis kit']
  if (technique.toLowerCase().includes('western')) return ['SDS-PAGE gel', 'Transfer membrane (PVDF/nitrocellulose)', 'Running buffer', 'Transfer buffer', 'Primary antibody', 'Secondary antibody (HRP/fluorescent)', 'ECL substrate', 'Blocking reagent', 'Protein ladder']
  if (technique.toLowerCase().includes('flow')) return ['Fluorescent antibodies', 'Viability dye', 'FACS buffer', 'Fc block', 'Compensation beads', 'Fixation buffer', 'Permeabilization buffer']
  return ['Refer to technique-specific reagent list', 'Check lab inventory for available reagents']
}

function getEquipmentForTechnique(technique: string): string[] {
  if (technique.toLowerCase().includes('pcr')) return ['Real-time PCR machine', 'Thermal cycler', 'NanoDrop/spectrophotometer', 'Centrifuge', 'Vortex mixer']
  if (technique.toLowerCase().includes('western')) return ['SDS-PAGE apparatus', 'Transfer unit', 'Power supply', 'Imaging system', 'Rocker/shaker']
  if (technique.toLowerCase().includes('flow')) return ['Flow cytometer', 'Centrifuge', 'Vortex', 'Cell counter', 'Biosafety cabinet']
  return ['Refer to technique-specific equipment list']
}

function getPitfallsForTechnique(technique: string): string[] {
  if (technique.toLowerCase().includes('pcr')) return ['RNA degradation during extraction', 'Primer design issues causing non-specific amplification', 'Inadequate template concentration', 'Cross-contamination between samples']
  if (technique.toLowerCase().includes('western')) return ['Antibody not validated for your application', 'Protein degradation during extraction', 'Uneven gel loading', 'Over/under-exposure affecting quantification']
  if (technique.toLowerCase().includes('flow')) return ['Poor compensation leading to false positives', 'Dead cells creating artifacts', 'Antibody aggregation causing non-specific staining', 'Insufficient events for statistical analysis']
  return ['Reagent quality issues', 'Equipment calibration drift', 'Environmental variability', 'Operator technique variation']
}

function getTimeEstimate(technique: string): string {
  if (technique.toLowerCase().includes('pcr')) return '4-6 hours (RNA extraction to analysis)'
  if (technique.toLowerCase().includes('western')) return '2-3 days (sample prep, run, transfer, immunodetection)'
  if (technique.toLowerCase().includes('flow')) return '4-8 hours (sample prep to acquisition)'
  if (technique.toLowerCase().includes('cell')) return '1-2 weeks (culture setup to experiment completion)'
  return '1-3 days (varies by specific protocol)'
}
