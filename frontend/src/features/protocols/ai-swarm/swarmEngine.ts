// ═══════════════════════════════════════════════════════════════════════════
// AI SWARM ENGINE — Orchestrates multi-agent protocol analysis
// ═══════════════════════════════════════════════════════════════════════════
// Architecture: Ready for LangChain/LlamaIndex/Claude API integration.
// Currently uses intelligent mock generation with realistic biomedical output.
// To connect a real LLM, replace the generate* functions with API calls.

import type {
  AgentId, AgentOutput, AgentSection, AgentScore, SwarmConsensus,
  SwarmSession, GeneratedSOP, SOPGeneratorInput, SOPStep, SOPReagent,
  SOPEquipment, SOPMaterial, SOPCheckpoint, SOPTroubleshooting, SOPRiskItem,
  SwarmChatMessage,
} from './swarmTypes'
import { AGENT_DEFINITIONS } from './swarmTypes'

// ── Utility ───────────────────────────────────────────────────────────────
const uid = () => `sw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const now = () => new Date().toISOString()
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const score = (min: number, max: number) => Math.round(min + Math.random() * (max - min))

// ═══════════════════════════════════════════════════════════════════════════
// AGENT OUTPUT GENERATORS
// Each function produces a realistic AgentOutput for the given protocol input.
// These are designed to be replaced with real LLM calls.
// ═══════════════════════════════════════════════════════════════════════════

function generateArchitectOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'architect')!
  const steps = buildProcedureSteps(input)
  return {
    agentId: 'architect', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Generated ${steps.length}-step SOP structure for "${input.experimentName}" with workflow mapping, quality gates, and execution timeline.`,
    sections: [
      { heading: 'SOP Structure', content: `Complete ${steps.length}-step procedure designed for ${input.technique} in ${input.researchArea}.`, items: steps.map(s => `Step ${s.number}: ${s.title}`) },
      { heading: 'Workflow Design', content: 'Linear execution flow with 3 decision gates and 4 QC checkpoints integrated at critical steps.' },
      { heading: 'Time Estimate', content: `Total estimated time: ${steps.reduce((a, s) => a + (parseInt(s.duration || '30') || 30), 0)} minutes for primary procedure.` },
      { heading: 'Execution Flow', content: `Sample Prep → ${input.technique} Setup → Primary Procedure → Data Collection → Analysis → Documentation`, items: ['Pre-check: verify all materials and equipment', 'Decision gate 1: sample quality assessment', 'Decision gate 2: mid-procedure QC', 'Decision gate 3: final result validation'] },
    ],
    scores: [
      { value: score(82, 95), label: 'Structure Completeness', details: 'All required SOP sections are present' },
      { value: score(78, 92), label: 'Workflow Clarity', details: 'Steps are logically ordered with clear transitions' },
      { value: score(85, 98), label: 'Detail Level', details: 'Sufficient detail for reproducible execution' },
    ],
    warnings: input.biosafetyLevel === 'BSL-3' || input.biosafetyLevel === 'BSL-4' ? ['High biosafety level requires additional containment procedures'] : [],
    recommendations: [
      'Add pause points between critical steps for safe stopping',
      'Include instrument warm-up time in total estimate',
      `Consider parallel preparation of ${input.reagents.split(',')[0]?.trim() || 'reagents'} to reduce total time`,
    ],
    timestamp: now(), durationMs: score(1200, 2800),
  }
}

function generateReviewerOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'reviewer')!
  return {
    agentId: 'reviewer', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Scientific review of ${input.technique} protocol for ${input.organism || 'target organism'}: methodology is sound with ${score(2, 4)} minor recommendations.`,
    sections: [
      { heading: 'Scientific Accuracy', content: `The proposed ${input.technique} methodology follows established best practices for ${input.researchArea}. Key parameters align with published literature.` },
      { heading: 'Methodology Assessment', content: `The ${input.technique} approach is appropriate for ${input.sampleType} samples. Controls are adequate for the experimental design.`, items: ['Positive control: validated reference sample recommended', 'Negative control: no-template/no-sample control required', 'Internal control: housekeeping gene/protein for normalization'] },
      { heading: 'Experimental Design', content: `Sample size and replication strategy should follow power analysis. Minimum n=3 biological replicates recommended for ${input.researchArea} studies.` },
      { heading: 'Controls Verification', content: 'Essential controls identified and mapped to procedure steps.', items: ['Process control at Step 1: input material quality', 'Reaction control at primary step: enzyme/reagent activity', 'Output control: expected result range verification'] },
    ],
    scores: [
      { value: score(80, 96), label: 'Scientific Validity', details: 'Methodology follows published best practices' },
      { value: score(75, 90), label: 'Methodology Score', details: 'Approach is appropriate for sample type and goal' },
      { value: score(70, 88), label: 'Reproducibility Estimate', details: 'Protocol detail sufficient for independent replication' },
    ],
    warnings: [],
    recommendations: [
      'Include positive and negative controls at each critical step',
      `Validate ${input.technique} parameters with pilot experiment before full-scale execution`,
      'Document all deviations from protocol in lab notebook',
      'Consider inter-operator variability — include training requirements',
    ],
    timestamp: now(), durationMs: score(1500, 3200),
  }
}

function generateBiosafetyOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'biosafety')!
  const bsl = input.biosafetyLevel || 'BSL-1'
  const isHighRisk = bsl === 'BSL-3' || bsl === 'BSL-4'
  return {
    agentId: 'biosafety', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `${bsl} risk assessment complete. ${isHighRisk ? '⚠️ Enhanced containment required.' : 'Standard precautions apply.'} PPE and waste disposal requirements specified.`,
    sections: [
      { heading: 'Risk Assessment', content: `Biosafety Level: ${bsl}. ${isHighRisk ? 'Enhanced containment and engineering controls required.' : 'Standard laboratory practices with appropriate PPE.'}`, severity: isHighRisk ? 'critical' : 'info' },
      { heading: 'PPE Requirements', content: 'Personal protective equipment for this procedure:', items: ['Laboratory coat (disposable for BSL-2+)', 'Nitrile gloves (double-glove for BSL-2+)', 'Safety glasses or face shield', ...(isHighRisk ? ['N95 respirator or PAPR', 'Fluid-resistant coveralls', 'Shoe covers'] : []), 'Closed-toe shoes'] },
      { heading: 'Chemical Hazards', content: `Reagents used in this protocol require the following precautions:`, items: input.reagents.split(',').filter(Boolean).map(r => `${r.trim()}: Consult SDS before handling`), severity: 'warning' },
      { heading: 'Waste Disposal', content: 'All waste must be segregated and disposed according to institutional guidelines.', items: ['Solid waste: autoclave before disposal in biohazard bags', 'Liquid waste: collect in designated containers, autoclave or chemical treatment', 'Sharps: dispose in puncture-resistant sharps containers', ...(isHighRisk ? ['BSL-3+ waste: double-bag and autoclave with biological indicator'] : [])] },
      { heading: 'Emergency Procedures', content: 'In case of spill or exposure:', items: ['Spill: contain with absorbent, apply disinfectant, notify supervisor', 'Skin exposure: wash immediately with soap and water for 15 minutes', 'Eye exposure: flush with eyewash for 15 minutes, seek medical attention', 'Ingestion: do not induce vomiting, seek immediate medical attention'] },
    ],
    scores: [
      { value: isHighRisk ? score(60, 75) : score(85, 98), label: 'Safety Compliance', details: `${bsl} requirements ${isHighRisk ? 'need verification' : 'are met'}` },
      { value: score(80, 95), label: 'PPE Adequacy', details: 'Required PPE is specified for all hazardous steps' },
      { value: score(75, 92), label: 'Waste Management', details: 'Disposal procedures align with regulations' },
    ],
    warnings: isHighRisk ? [`${bsl} operations require institutional biosafety committee approval`, 'Ensure all personnel have current ${bsl} training certification'] : [],
    recommendations: [
      'Post SDS summaries for all hazardous reagents at the workstation',
      'Verify emergency eyewash and shower stations are accessible',
      `Review institutional ${bsl} guidelines before first execution`,
    ],
    timestamp: now(), durationMs: score(1000, 2500),
  }
}

function generateQAQCOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'qaqc')!
  return {
    agentId: 'qaqc', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `QA/QC framework established with ${score(4, 7)} quality checkpoints, acceptance criteria, and validation requirements for ${input.technique}.`,
    sections: [
      { heading: 'Quality Checkpoints', content: 'Critical quality control points identified:', items: ['QC-1: Input material quality verification (purity, concentration, integrity)', 'QC-2: Reagent preparation verification (concentration, pH, expiry)', 'QC-3: Instrument calibration check before use', 'QC-4: Mid-procedure checkpoint (expected intermediate result)', 'QC-5: Final result validation against acceptance criteria'] },
      { heading: 'Acceptance Criteria', content: 'Quantitative criteria for pass/fail determination:', items: ['Input sample meets minimum quality threshold', 'All controls perform within expected ranges', 'Signal-to-noise ratio meets minimum specification', 'Results are within published reference ranges', 'Inter-replicate CV < 15% for quantitative measurements'] },
      { heading: 'Validation Requirements', content: `Protocol validation for ${input.technique} should include:`, items: ['Accuracy: compare to reference standard or validated method', 'Precision: ≥3 independent runs with CV < 10%', 'Linearity: demonstrate linear response across working range', 'Specificity: confirm absence of cross-reactivity', 'Robustness: test with deliberate parameter variation'] },
      { heading: 'Documentation Requirements', content: 'All QC results must be documented:', items: ['Record raw data in lab notebook or LIMS', 'Document any deviations with corrective actions', 'Maintain equipment calibration records', 'Archive QC data for minimum 5 years'] },
    ],
    scores: [
      { value: score(82, 96), label: 'QC Coverage', details: 'All critical steps have quality checkpoints' },
      { value: score(78, 93), label: 'Reproducibility', details: 'Protocol detail supports consistent results' },
      { value: score(80, 95), label: 'Validation Readiness', details: 'Framework for method validation is defined' },
    ],
    warnings: [],
    recommendations: [
      'Establish control charts for trending QC results over time',
      'Define out-of-specification (OOS) investigation procedures',
      'Include QC acceptance criteria in the protocol header',
    ],
    timestamp: now(), durationMs: score(1100, 2600),
  }
}

function generateTroubleshooterOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'troubleshooter')!
  return {
    agentId: 'troubleshooter', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Identified ${score(6, 10)} potential failure modes for ${input.technique}. Troubleshooting guide and prevention strategies generated.`,
    sections: [
      { heading: 'Common Failure Modes', content: `Analysis of typical issues in ${input.technique}:`, items: ['No signal/no result — reagent degradation, incorrect parameters', 'Low signal — insufficient sample input, suboptimal conditions', 'High background — contamination, non-specific binding', 'Inconsistent results — pipetting errors, temperature fluctuation', 'Equipment malfunction — calibration drift, sensor failure'] },
      { heading: 'Preventive Measures', content: 'Proactive steps to minimize failures:', items: ['Use fresh reagents and check expiry dates before each run', 'Calibrate instruments according to manufacturer schedule', 'Include positive and negative controls in every run', 'Standardize sample preparation across operators', 'Document all environmental conditions (temperature, humidity)'] },
      { heading: 'Root Cause Analysis Framework', content: 'When troubleshooting, apply the 5-Why method:', items: ['1. What exactly failed? (Specific observation)', '2. When did it fail? (During which step)', '3. What changed? (New reagent lot, operator, equipment)', '4. Can it be reproduced? (Repeat under same conditions)', '5. What is the root cause? (Systematic investigation)'] },
      { heading: 'Optimization Opportunities', content: `${input.technique} can be optimized by:`, items: ['Titrate critical reagent concentrations', 'Optimize incubation times and temperatures', 'Test alternative suppliers for key reagents', 'Automate repetitive liquid handling steps'] },
    ],
    scores: [
      { value: score(80, 94), label: 'Failure Coverage', details: 'Major failure modes are addressed' },
      { value: score(75, 90), label: 'Solution Quality', details: 'Troubleshooting steps are actionable' },
      { value: score(82, 96), label: 'Prevention Score', details: 'Preventive measures reduce failure risk' },
    ],
    warnings: [],
    recommendations: [
      'Create a troubleshooting decision tree for common issues',
      'Maintain a failure log to track recurring problems',
      'Schedule periodic protocol review based on failure trends',
    ],
    timestamp: now(), durationMs: score(1300, 2900),
  }
}

function generateEquipmentOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'equipment')!
  const equipList = input.equipment.split(',').filter(Boolean).map(e => e.trim())
  return {
    agentId: 'equipment', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Equipment validation report for ${equipList.length || 3} instruments. Calibration and maintenance requirements specified.`,
    sections: [
      { heading: 'Required Equipment', content: 'Instruments and equipment for this protocol:', items: equipList.length > 0 ? equipList.map(e => `${e} — verify calibration status before use`) : ['Primary instrument (specify model)', 'Pipettes (P20, P200, P1000) — calibrated within 6 months', 'Centrifuge — RPM verified with tachometer', 'Incubator — temperature validated with calibrated thermometer'] },
      { heading: 'Calibration Requirements', content: 'All instruments must be within calibration:', items: ['Pipettes: calibrate every 6 months or per manufacturer', 'Thermometers: verify annually against NIST-traceable reference', 'Centrifuge: verify RPM and temperature annually', 'Spectrophotometer: run standards at each wavelength monthly', 'pH meter: calibrate with 2-point buffer before each use'] },
      { heading: 'Pre-Use Checklist', content: 'Before starting the protocol, verify:', items: ['Instrument is powered on and warmed up (minimum 15 min)', 'Calibration sticker is current (not expired)', 'Previous user log shows no issues', 'Consumables (tips, cuvettes, plates) are available', 'Waste containers are not full'] },
    ],
    scores: [
      { value: score(82, 96), label: 'Equipment Readiness', details: 'All required instruments are specified' },
      { value: score(78, 94), label: 'Calibration Coverage', details: 'Calibration requirements defined for critical instruments' },
    ],
    warnings: equipList.some(e => e.toLowerCase().includes('laser') || e.toLowerCase().includes('uv')) ? ['Laser/UV equipment requires additional safety training'] : [],
    recommendations: [
      'Maintain equipment logs for all instruments used in this protocol',
      'Schedule preventive maintenance to avoid unexpected downtime',
    ],
    timestamp: now(), durationMs: score(800, 2000),
  }
}

function generateReagentOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'reagent')!
  const reagentList = input.reagents.split(',').filter(Boolean).map(r => r.trim())
  return {
    agentId: 'reagent', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Reagent analysis for ${reagentList.length || 5} compounds. Storage conditions, alternatives, and stability data provided.`,
    sections: [
      { heading: 'Reagent Verification', content: 'All reagents verified for this protocol:', items: reagentList.length > 0 ? reagentList.map(r => `${r} — verify lot number, expiry, and storage conditions`) : ['Primary buffer — prepare fresh on day of use', 'Enzyme/antibody — aliquot to avoid freeze-thaw cycles', 'Standards — use certified reference materials'] },
      { heading: 'Storage Conditions', content: 'Critical storage requirements:', items: ['Room temperature (15-25°C): buffers, common salts', '-20°C: enzymes, antibodies, primers', '-80°C: RNA, sensitive biologicals', '4°C: prepared solutions, media with supplements', 'Desiccated: hygroscopic reagents and powders'] },
      { heading: 'Alternative Reagents', content: 'Validated alternatives from multiple suppliers:', items: reagentList.slice(0, 3).map(r => `${r}: check Sigma-Aldrich, Thermo Fisher, Bio-Rad catalogs for equivalent grade`) },
      { heading: 'Preparation Notes', content: 'Reagent preparation guidelines:', items: ['Use molecular biology grade water for all solutions', 'Filter-sterilize heat-labile solutions through 0.22 µm', 'Label all prepared reagents with date, concentration, and initials', 'Discard reagents showing color change, precipitation, or turbidity'] },
    ],
    scores: [
      { value: score(82, 96), label: 'Reagent Completeness', details: 'All required reagents are listed with specifications' },
      { value: score(75, 92), label: 'Alternative Coverage', details: 'Alternative suppliers identified for critical reagents' },
    ],
    warnings: reagentList.some(r => r.toLowerCase().includes('ethidium') || r.toLowerCase().includes('formaldehyde') || r.toLowerCase().includes('phenol')) ? ['Contains hazardous reagents — review SDS and wear appropriate PPE'] : [],
    recommendations: [
      'Maintain reagent inventory with lot tracking',
      'Test new reagent lots against previous lot before routine use',
    ],
    timestamp: now(), durationMs: score(900, 2200),
  }
}

function generateLiteratureOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'literature')!
  return {
    agentId: 'literature', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Literature scan identified ${score(8, 15)} relevant publications for ${input.technique} in ${input.researchArea}. Evidence level: moderate-to-high.`,
    sections: [
      { heading: 'Key Publications', content: 'Most relevant published methods:', items: [`"Optimized ${input.technique} protocol for ${input.sampleType}" — Nature Methods (2024)`, `"Best practices in ${input.researchArea}: a comprehensive review" — Nature Protocols (2023)`, `"Standardization of ${input.technique} across laboratories" — PLOS ONE (2023)`, `"Troubleshooting guide for ${input.technique}" — Bio-Protocol (2024)`] },
      { heading: 'Methodology Comparison', content: `Current protocol aligns with ${score(75, 95)}% of published methodology standards for ${input.technique}.`, items: ['Sample preparation: consistent with major publications', 'Reaction conditions: within recommended parameter ranges', 'Quality control: follows minimum reporting standards'] },
      { heading: 'Open Access Resources', content: 'Freely available protocol references:', items: ['Protocols.io — search for validated community protocols', 'Bio-Protocol — peer-reviewed step-by-step methods', 'OpenWetWare — community-contributed laboratory protocols', 'NCBI Bookshelf — comprehensive methodology manuals'] },
      { heading: 'Evidence Assessment', content: `Evidence level for ${input.technique} methodology:`, items: ['Validated in ≥3 independent laboratories: YES', 'Published in peer-reviewed journal: YES', 'Standardized by professional organization: PARTIAL', 'Included in regulatory guidance: CHECK APPLICABLE REGULATIONS'] },
    ],
    scores: [
      { value: score(78, 95), label: 'Evidence Score', details: 'Published literature supports methodology' },
      { value: score(72, 90), label: 'Citation Coverage', details: 'Key references are identified and current' },
    ],
    warnings: [],
    recommendations: [
      'Monitor PubMed alerts for new publications on this methodology',
      'Compare protocol parameters to most-cited methods in the field',
      'Include DOIs for all referenced publications in the SOP',
    ],
    timestamp: now(), durationMs: score(1400, 3000),
  }
}

function generateOptimizerOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'optimizer')!
  return {
    agentId: 'optimizer', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Optimization analysis complete. Potential for ${score(15, 35)}% time reduction and ${score(10, 25)}% cost reduction identified.`,
    sections: [
      { heading: 'Time Optimization', content: `Opportunities to reduce protocol duration:`, items: ['Parallelize sample and reagent preparation steps', 'Reduce unnecessary incubation times based on literature', 'Use pre-made solutions where validated', 'Implement batch processing for multiple samples'] },
      { heading: 'Cost Optimization', content: 'Cost reduction strategies:', items: ['Source reagents from multiple suppliers for best pricing', 'Optimize reaction volumes — many protocols use excess', 'Implement reagent sharing across protocols', 'Use bulk purchasing for high-volume consumables'] },
      { heading: 'Reproducibility Improvements', content: 'Steps to improve protocol consistency:', items: ['Standardize pipetting technique with calibrated instruments', 'Use master mixes to reduce pipetting steps', 'Document critical parameters with tolerance ranges', 'Implement electronic data capture to reduce transcription errors'] },
      { heading: 'Automation Potential', content: `Automation assessment for ${input.technique}:`, items: ['Liquid handling: HIGH potential for automated pipetting', 'Plate reading: automated data collection recommended', 'Data analysis: scripted analysis pipeline recommended', 'Sample tracking: barcode/LIMS integration recommended'] },
    ],
    scores: [
      { value: score(75, 92), label: 'Efficiency Score', details: 'Protocol efficiency relative to published methods' },
      { value: score(70, 88), label: 'Cost Efficiency', details: 'Reagent and consumable cost optimization' },
      { value: score(80, 95), label: 'Automation Readiness', details: 'Protocol suitability for automation' },
    ],
    warnings: [],
    recommendations: [
      'Validate any optimization changes with side-by-side comparison',
      'Document all optimized parameters with rationale',
      'Re-validate protocol after any significant changes',
    ],
    timestamp: now(), durationMs: score(1000, 2400),
  }
}

function generateTrainerOutput(input: SOPGeneratorInput): AgentOutput {
  const def = AGENT_DEFINITIONS.find(a => a.id === 'trainer')!
  return {
    agentId: 'trainer', status: 'complete', title: def.name, icon: def.icon, color: def.color,
    summary: `Training package generated: ${score(8, 12)} learning objectives, competency assessment, and certification requirements for ${input.technique}.`,
    sections: [
      { heading: 'Learning Objectives', content: `After training, operators should be able to:`, items: [`Explain the scientific principle behind ${input.technique}`, 'Prepare all required reagents and materials', 'Execute each protocol step within specified parameters', 'Identify and respond to QC failures', 'Apply appropriate safety precautions', 'Document results according to institutional requirements'] },
      { heading: 'Competency Assessment', content: 'Competency verification includes:', items: ['Written knowledge assessment (minimum 80% pass rate)', 'Observed practical demonstration with supervisor sign-off', 'Independent execution with documented results review', 'Annual competency reassessment requirement'] },
      { heading: 'Training Materials', content: 'Generated training resources:', items: ['Step-by-step visual guide with annotated images', 'Quick reference card for critical parameters', 'Common mistakes and how to avoid them', 'Safety briefing specific to this protocol'] },
      { heading: 'Certification Requirements', content: 'Operator certification pathway:', items: ['Prerequisite: general laboratory safety training', `Prerequisite: ${input.biosafetyLevel || 'BSL-1'} certification`, 'Complete SOP reading and acknowledgment', 'Pass written assessment', 'Demonstrate competency under observation', 'Annual renewal with refresher training'] },
    ],
    scores: [
      { value: score(82, 96), label: 'Training Coverage', details: 'All critical skills are addressed in training' },
      { value: score(78, 94), label: 'Assessment Quality', details: 'Assessment methods are appropriate and measurable' },
    ],
    warnings: [],
    recommendations: [
      'Track training completion in LIMS or training management system',
      'Require re-training after any significant protocol revision',
      'Include hands-on practice with non-critical samples before live runs',
    ],
    timestamp: now(), durationMs: score(900, 2100),
  }
}

// ── Procedure Step Builder ────────────────────────────────────────────────
function buildProcedureSteps(input: SOPGeneratorInput): SOPStep[] {
  const tech = input.technique.toLowerCase()
  const steps: SOPStep[] = [
    { number: 1, title: 'Workspace Preparation', instruction: `Clean and prepare the workspace for ${input.technique}. Verify BSC certification (if applicable), lay out materials, and check equipment calibration status.`, duration: '15 min', safetyNote: 'Don appropriate PPE before handling any samples or reagents.', qcPoint: false },
    { number: 2, title: 'Reagent Preparation', instruction: `Prepare all required reagents for ${input.technique}. Verify concentrations, pH (if applicable), and expiry dates. Prepare working solutions fresh when indicated.`, duration: '20 min', tip: 'Prepare a master mix when possible to reduce pipetting variability.', qcPoint: true, expectedOutput: 'All reagents at correct concentration and volume' },
    { number: 3, title: 'Sample Preparation', instruction: `Prepare ${input.sampleType || 'samples'} according to standard procedures for ${input.technique}. Assess sample quality and quantity before proceeding.`, duration: '30 min', criticalParams: ['Sample concentration', 'Sample integrity', 'Sample volume'], qcPoint: true, expectedOutput: 'Samples meet minimum quality requirements' },
    { number: 4, title: `${input.technique} Setup`, instruction: `Set up the ${input.technique} procedure. Program instrument parameters, prepare reaction components, and arrange samples in the correct order.`, duration: '20 min', temperature: 'As specified for the technique', tip: 'Include positive and negative controls in every run.' },
    { number: 5, title: 'Primary Procedure Execution', instruction: `Execute the primary ${input.technique} procedure according to established parameters. Monitor critical conditions throughout.`, duration: '60 min', criticalParams: ['Temperature', 'Time', 'Reagent concentrations'], qcPoint: true, safetyNote: 'Monitor for any unexpected reactions or equipment warnings.' },
    { number: 6, title: 'Data Collection', instruction: `Collect data from ${input.equipment.split(',')[0]?.trim() || 'the primary instrument'}. Export raw data files and verify data completeness.`, duration: '20 min', qcPoint: true, expectedOutput: 'Complete dataset with all samples and controls' },
    { number: 7, title: 'Quality Control Review', instruction: 'Review QC results: verify controls are within acceptable ranges, check for outliers, and assess overall data quality.', duration: '15 min', qcPoint: true, expectedOutput: 'All controls within specification, no critical deviations' },
    { number: 8, title: 'Data Analysis', instruction: `Analyze ${input.technique} data using appropriate statistical methods. Compare results to expected values and historical data.`, duration: '30 min', expectedOutput: 'Analyzed results with statistical summary' },
    { number: 9, title: 'Documentation & Cleanup', instruction: 'Record all results in lab notebook/LIMS. Document any deviations. Clean and decontaminate workspace. Dispose of waste according to protocol.', duration: '20 min', safetyNote: 'Dispose of all biological and chemical waste according to institutional guidelines.' },
  ]

  // Add technique-specific steps
  if (tech.includes('pcr') || tech.includes('qpcr') || tech.includes('ddpcr')) {
    steps.splice(4, 0, { number: 4.5 as any, title: 'Thermal Cycling Setup', instruction: 'Program thermal cycler with optimized cycling conditions. Verify lid temperature and ramp rates.', duration: '5 min', temperature: '95°C denature, 55-65°C anneal, 72°C extend', criticalParams: ['Annealing temperature', 'Extension time', 'Cycle number'] })
  }
  if (tech.includes('western') || tech.includes('blot')) {
    steps.splice(5, 0, { number: 5.5 as any, title: 'Transfer & Blocking', instruction: 'Transfer proteins to membrane. Block with appropriate blocking buffer (BSA or milk).', duration: '90 min', temperature: 'Transfer at 4°C, blocking at RT', criticalParams: ['Transfer efficiency', 'Blocking buffer composition'] })
  }
  if (tech.includes('flow') || tech.includes('cytometry')) {
    steps.splice(3, 0, { number: 3.5 as any, title: 'Antibody Panel Preparation', instruction: 'Prepare antibody cocktail with pre-titrated volumes. Include viability dye and FMO controls.', duration: '15 min', tip: 'Titrate each antibody to optimal concentration before use in panels.' })
  }

  // Renumber
  return steps.map((s, i) => ({ ...s, number: i + 1 }))
}

// ═══════════════════════════════════════════════════════════════════════════
// SWARM ORCHESTRATOR
// Coordinates all agents, computes consensus, generates final SOP
// ═══════════════════════════════════════════════════════════════════════════

const AGENT_GENERATORS: Record<AgentId, (input: SOPGeneratorInput) => AgentOutput> = {
  architect: generateArchitectOutput,
  reviewer: generateReviewerOutput,
  biosafety: generateBiosafetyOutput,
  qaqc: generateQAQCOutput,
  troubleshooter: generateTroubleshooterOutput,
  equipment: generateEquipmentOutput,
  reagent: generateReagentOutput,
  literature: generateLiteratureOutput,
  optimizer: generateOptimizerOutput,
  trainer: generateTrainerOutput,
}

export interface SwarmCallbacks {
  onAgentStart?: (agentId: AgentId, agentName: string) => void
  onAgentComplete?: (output: AgentOutput, idx: number, total: number) => void
  shouldCancel?: () => boolean
}

export async function runSwarmAnalysis(
  input: SOPGeneratorInput,
  callbacks?: SwarmCallbacks,
): Promise<SwarmSession> {
  const { onAgentStart, onAgentComplete, shouldCancel } = callbacks || {}

  const session: SwarmSession = {
    id: uid(),
    protocolTitle: input.experimentName,
    protocolCategory: input.researchArea,
    startedAt: now(),
    status: 'running',
    agents: [],
    consensus: { overallScore: 0, scientificValidity: 0, safetyCompliance: 0, reproducibility: 0, optimizationPotential: 0, riskLevel: 'low', confidenceScore: 0, agentAgreement: 0, topRecommendations: [], conflicts: [] },
  }

  // Run agents sequentially with staggered timing (simulates parallel with visible progress)
  const agentOrder: AgentId[] = ['architect', 'reviewer', 'biosafety', 'qaqc', 'troubleshooter', 'equipment', 'reagent', 'literature', 'optimizer', 'trainer']

  for (let i = 0; i < agentOrder.length; i++) {
    if (shouldCancel?.()) break

    const agentId = agentOrder[i]
    const def = AGENT_DEFINITIONS.find(a => a.id === agentId)!
    onAgentStart?.(agentId, def.name)

    await delay(400 + Math.random() * 800)

    if (shouldCancel?.()) break

    const output = AGENT_GENERATORS[agentId](input)
    session.agents.push(output)
    onAgentComplete?.(output, i, agentOrder.length)
  }

  // Compute consensus
  session.consensus = computeConsensus(session.agents)

  // Generate final SOP
  session.generatedSOP = buildGeneratedSOP(input, session.agents)

  session.completedAt = now()
  session.status = 'complete'
  return session
}

function computeConsensus(agents: AgentOutput[]): SwarmConsensus {
  const allScores = agents.flatMap(a => a.scores.map(s => s.value))
  const avg = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 80

  const safetyAgent = agents.find(a => a.agentId === 'biosafety')
  const safetyScore = safetyAgent?.scores[0]?.value ?? 85
  const reviewAgent = agents.find(a => a.agentId === 'reviewer')
  const scienceScore = reviewAgent?.scores[0]?.value ?? 82
  const qcAgent = agents.find(a => a.agentId === 'qaqc')
  const reproScore = qcAgent?.scores[1]?.value ?? 80
  const optAgent = agents.find(a => a.agentId === 'optimizer')
  const optScore = optAgent?.scores[0]?.value ?? 78

  const allRecs = agents.flatMap(a => a.recommendations)
  const topRecs = allRecs.slice(0, 8)

  const riskLevel: SwarmConsensus['riskLevel'] = safetyScore < 60 ? 'critical' : safetyScore < 75 ? 'high' : safetyScore < 85 ? 'medium' : 'low'

  return {
    overallScore: avg,
    scientificValidity: scienceScore,
    safetyCompliance: safetyScore,
    reproducibility: reproScore,
    optimizationPotential: optScore,
    riskLevel,
    confidenceScore: score(72, 92),
    agentAgreement: score(78, 96),
    topRecommendations: topRecs,
    conflicts: [],
  }
}

function buildGeneratedSOP(input: SOPGeneratorInput, _agents: AgentOutput[]): GeneratedSOP {
  return {
    purpose: `This SOP describes the standardized procedure for ${input.experimentName} using ${input.technique} in the context of ${input.researchArea} research. It ensures consistent, reproducible, and safe execution by trained personnel.`,
    scope: `This procedure applies to all ${input.sampleType || 'biological'} samples processed using ${input.technique} within the ${input.researchArea} research program. It covers sample preparation through data analysis and reporting.`,
    responsibilities: [
      'Principal Investigator: approves protocol, ensures compliance, reviews results',
      'Laboratory Manager: maintains equipment, manages reagent inventory, ensures training',
      'Research Staff: executes protocol, documents deviations, maintains lab notebook',
      'Safety Officer: reviews risk assessment, conducts safety audits',
    ],
    materials: [
      { name: 'Microcentrifuge tubes (1.5 mL)', quantity: '50/run', specification: 'DNase/RNase-free, low-binding' },
      { name: 'Pipette tips (filtered)', quantity: 'As needed', specification: 'Sterile, aerosol-barrier' },
      { name: 'Gloves (nitrile)', quantity: 'Multiple pairs', specification: 'Powder-free, examination grade' },
    ],
    reagents: input.reagents.split(',').filter(Boolean).map(r => ({
      name: r.trim(), concentration: 'As specified', volume: 'Per protocol', storage: 'See SDS', alternatives: [],
    })),
    equipment: input.equipment.split(',').filter(Boolean).map(e => ({
      name: e.trim(), specification: 'See instrument manual', calibration: 'Current calibration required',
    })),
    procedure: buildProcedureSteps(input),
    qcCheckpoints: [
      { step: 2, description: 'Reagent quality verification', acceptanceCriteria: 'All reagents within expiry, correct concentration', action: 'Do not proceed if criteria not met' },
      { step: 3, description: 'Sample quality assessment', acceptanceCriteria: 'Meets minimum concentration and purity requirements', action: 'Re-extract or re-process samples that fail' },
      { step: 5, description: 'Mid-procedure checkpoint', acceptanceCriteria: 'Intermediate results within expected range', action: 'Investigate and document any anomalies' },
      { step: 7, description: 'Final QC review', acceptanceCriteria: 'All controls within specification', action: 'Reject run if controls fail — investigate root cause' },
    ],
    expectedResults: `Successful execution of ${input.technique} should yield results consistent with the experimental hypothesis. All quality control parameters should be within established acceptance criteria. Results should be reproducible across independent runs (CV < 15%).`,
    troubleshooting: [
      { problem: 'No result / no signal', possibleCauses: ['Reagent degradation', 'Incorrect parameters', 'Sample quality issue'], solutions: ['Check reagent expiry and storage', 'Verify instrument settings', 'Re-assess sample quality'], prevention: 'Include positive controls in every run' },
      { problem: 'High background / noise', possibleCauses: ['Contamination', 'Non-specific binding', 'Insufficient washing'], solutions: ['Clean workspace', 'Optimize blocking conditions', 'Increase wash stringency'], prevention: 'Use filtered tips, clean bench regularly' },
      { problem: 'Inconsistent results', possibleCauses: ['Pipetting errors', 'Temperature variation', 'Timing inconsistency'], solutions: ['Calibrate pipettes', 'Use temperature monitoring', 'Use timers for all incubations'], prevention: 'Standardize technique across all operators' },
    ],
    safetyNotes: [
      `This protocol requires ${input.biosafetyLevel || 'BSL-1'} containment`,
      'Wear appropriate PPE at all times when handling samples and reagents',
      'Consult SDS for all reagents before use',
      'Follow institutional biosafety guidelines',
    ],
    wasteDisposal: [
      'Biological waste: autoclave before disposal in biohazard bags',
      'Chemical waste: collect in appropriate containers, label clearly',
      'Sharps: dispose in puncture-resistant containers',
      'Contaminated consumables: autoclave or treat with 10% bleach',
    ],
    references: [
      `Standard methods for ${input.technique} — see institutional protocol library`,
      'Equipment manufacturer manuals — available in instrument room',
      'Institutional Biosafety Manual — available on intranet',
    ],
    trainingRequirements: [
      'General laboratory safety training (current)',
      `${input.biosafetyLevel || 'BSL-1'} certification (current)`,
      `${input.technique} technique training (documented)`,
      'Equipment-specific training for all instruments used',
    ],
    approvalRequirements: [
      'Protocol review by PI or designee',
      'Safety review by institutional biosafety officer',
      'Quality review by QA/QC coordinator (if applicable)',
    ],
    riskAssessment: [
      { hazard: 'Biological materials', risk: input.biosafetyLevel === 'BSL-3' ? 'high' : 'medium', control: 'BSC use, appropriate containment', ppe: ['Gloves', 'Lab coat', 'Eye protection'] },
      { hazard: 'Chemical reagents', risk: 'medium', control: 'Fume hood for volatile chemicals, SDS review', ppe: ['Chemical-resistant gloves', 'Lab coat', 'Safety glasses'] },
      { hazard: 'Equipment hazards', risk: 'low', control: 'Training, proper use, maintenance', ppe: ['As specified by instrument'] },
    ],
    optimizationNotes: [
      'This is an AI-generated SOP — validate all parameters experimentally before routine use',
      'Optimization of critical parameters may improve results for specific sample types',
      'Consider automation for high-throughput applications',
    ],
    revisionHistory: [
      { version: '1.0-draft', date: new Date().toISOString().slice(0, 10), author: 'AI Swarm Generator', changes: 'Initial AI-generated draft' },
    ],
    complianceNotes: [
      'This SOP must be reviewed and approved before use',
      'All deviations must be documented and reviewed',
      'Protocol is subject to institutional review and audit',
    ],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SWARM CHAT — Protocol Q&A with multi-agent responses
// ═══════════════════════════════════════════════════════════════════════════

export async function askSwarm(
  question: string,
  context: { protocolTitle?: string; technique?: string; category?: string },
): Promise<SwarmChatMessage> {
  await delay(600 + Math.random() * 1200)

  const q = question.toLowerCase()
  let agentId: AgentId = 'reviewer'
  let content = ''

  if (q.includes('safety') || q.includes('ppe') || q.includes('hazard') || q.includes('biosafety')) {
    agentId = 'biosafety'
    content = `☣️ **Biosafety Assessment**\n\nFor ${context.protocolTitle || 'this protocol'}:\n\n• **PPE Required**: Lab coat, nitrile gloves, safety glasses. For BSL-2+, add face shield and disposable gown.\n• **Key Hazards**: Review SDS for all reagents. Biological materials require appropriate containment.\n• **Waste Disposal**: Autoclave all biological waste. Collect chemical waste separately.\n• **Emergency**: Know location of eyewash, safety shower, and spill kit.\n\nAlways consult your institutional biosafety officer for site-specific requirements.`
  } else if (q.includes('control') || q.includes('positive') || q.includes('negative')) {
    agentId = 'reviewer'
    content = `🔬 **Controls Recommendation**\n\nFor ${context.technique || 'this technique'}:\n\n• **Positive Control**: Use a validated reference sample known to produce expected results. This confirms the assay is working.\n• **Negative Control**: No-template/no-sample control to detect contamination.\n• **Internal Control**: Housekeeping gene/protein (e.g., GAPDH, β-actin) for normalization.\n• **Process Control**: Include at each critical step to identify where failures occur.\n\nAlways run controls with every batch — never skip controls to save reagents.`
  } else if (q.includes('troubleshoot') || q.includes('fail') || q.includes('problem') || q.includes('not working')) {
    agentId = 'troubleshooter'
    content = `🔧 **Troubleshooting Guide**\n\nCommon issues with ${context.technique || 'laboratory procedures'}:\n\n1. **No result**: Check reagent quality, verify parameters, assess sample input quality.\n2. **Low signal**: Increase sample input, optimize incubation time, check instrument sensitivity.\n3. **High background**: Improve washing, optimize blocking, reduce non-specific binding.\n4. **Variability**: Calibrate pipettes, use master mixes, standardize timing.\n\n**Root Cause Analysis**: Apply the 5-Why method — ask "why" iteratively until you reach the root cause, then address it systematically.`
  } else if (q.includes('cost') || q.includes('time') || q.includes('faster') || q.includes('cheaper') || q.includes('optimize')) {
    agentId = 'optimizer'
    content = `⚡ **Optimization Recommendations**\n\nFor ${context.protocolTitle || 'this protocol'}:\n\n• **Time Reduction**: Parallelize preparation steps, reduce unnecessary incubation times, use pre-made solutions.\n• **Cost Reduction**: Optimize reaction volumes, source from multiple suppliers, implement bulk purchasing.\n• **Reproducibility**: Use master mixes, standardize pipetting, implement electronic data capture.\n• **Automation**: Consider liquid handling robots for repetitive steps, automated plate readers for data collection.\n\n⚠️ Validate any optimizations with side-by-side comparison before routine use.`
  } else if (q.includes('reagent') || q.includes('substitute') || q.includes('alternative')) {
    agentId = 'reagent'
    content = `🧪 **Reagent Information**\n\nFor ${context.technique || 'this protocol'}:\n\n• **Supplier Options**: Check Sigma-Aldrich, Thermo Fisher, Bio-Rad, and NEB for equivalent grades.\n• **Storage**: Follow SDS recommendations. Aliquot enzymes and antibodies to avoid freeze-thaw.\n• **Quality**: Use molecular biology grade for nucleic acid work, analytical grade for general use.\n• **Substitution**: Always validate alternative reagents before routine use — lot-to-lot variation can affect results.\n\nMaintain a reagent log with lot numbers, receipt dates, and expiry dates.`
  } else if (q.includes('train') || q.includes('learn') || q.includes('competency') || q.includes('quiz')) {
    agentId = 'trainer'
    content = `🎓 **Training Guidance**\n\nFor ${context.technique || 'this technique'}:\n\n• **Prerequisites**: General lab safety, biosafety level certification, basic technique training.\n• **Learning Path**: 1) Read SOP thoroughly, 2) Observe experienced operator, 3) Practice with non-critical samples, 4) Independent execution under supervision, 5) Competency sign-off.\n• **Assessment**: Written quiz (80% minimum) + observed practical demonstration.\n• **Renewal**: Annual competency reassessment required.\n\nDocument all training in your institutional training management system.`
  } else {
    agentId = 'reviewer'
    content = `🔬 **Scientific Guidance**\n\nRegarding your question about ${context.protocolTitle || context.technique || 'this protocol'}:\n\nThe AI Swarm has analyzed your question across all specialized agents. Here is a consolidated response:\n\n• The methodology follows established best practices in ${context.category || 'biomedical research'}.\n• Ensure all critical parameters are documented and controlled.\n• Include appropriate controls in every experiment.\n• Document any deviations from the standard protocol.\n\nFor specific guidance, try asking about: safety, controls, troubleshooting, optimization, reagents, equipment, or training.`
  }

  const suggestions = [
    'What controls should I use?',
    'How can I reduce cost?',
    'What are the safety requirements?',
    'Generate a troubleshooting guide',
    'Suggest alternative reagents',
    'Create training materials',
  ].filter(() => Math.random() > 0.4).slice(0, 3)

  return {
    id: uid(),
    role: 'swarm',
    agentId,
    content,
    timestamp: now(),
    suggestions,
  }
}
