// ═══════════════════════════════════════════════════════════════════════════
// SOP GENERATOR FORM — Input form for AI Swarm protocol analysis
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import type { SOPGeneratorInput } from './swarmTypes'

interface Props {
  onSubmit: (input: SOPGeneratorInput) => void
  isRunning: boolean
}

const RESEARCH_AREAS = [
  'Molecular Biology', 'Cell Biology', 'Biochemistry', 'Microbiology',
  'Immunology', 'Virology', 'Genetics', 'Genomics', 'Proteomics',
  'Metabolomics', 'Neuroscience', 'Pharmacology', 'Cancer Biology',
  'Stem Cell Biology', 'Structural Biology', 'Bioinformatics',
  'Clinical Research', 'Pathology', 'Biobanking', 'Organoids',
]

const TECHNIQUES = [
  'PCR / qPCR / RT-PCR', 'Western Blot', 'Flow Cytometry (FACS)',
  'Cell Culture', 'Cloning & Transformation', 'CRISPR-Cas9 Gene Editing',
  'Immunohistochemistry (IHC)', 'ELISA', 'Mass Spectrometry',
  'Next-Gen Sequencing (NGS)', 'Microscopy (Confocal/Fluorescence)',
  'Chromatography (HPLC/GC)', 'Electrophoresis', 'Centrifugation & Fractionation',
  'Transfection / Transduction', 'Protein Purification', 'RNA Extraction',
  'DNA Extraction', 'Tissue Processing', 'Animal Handling',
  'Spectrophotometry', 'Crystallography', 'NMR Spectroscopy',
  'Biobanking & Sample Storage', 'Clinical Sample Processing',
]

const BSL_LEVELS = ['BSL-1', 'BSL-2', 'BSL-3', 'BSL-4']

const TEMPLATES: { label: string; input: Partial<SOPGeneratorInput> }[] = [
  {
    label: '🧬 RT-qPCR Gene Expression',
    input: {
      experimentName: 'RT-qPCR Gene Expression Analysis',
      researchArea: 'Molecular Biology',
      technique: 'PCR / qPCR / RT-PCR',
      sampleType: 'Total RNA from cell lysates',
      organism: 'Human (Homo sapiens)',
      equipment: 'Thermal cycler, real-time PCR machine, nanodrop, centrifuge',
      reagents: 'TRIzol, chloroform, isopropanol, DEPC-treated water, reverse transcriptase, SYBR Green master mix, primers',
      biosafetyLevel: 'BSL-2',
      goal: 'Quantify relative gene expression of target genes using RT-qPCR with GAPDH normalization',
      additionalNotes: 'Include no-template controls and no-RT controls. Use biological triplicates.',
    },
  },
  {
    label: '🔬 Western Blot Protein Detection',
    input: {
      experimentName: 'Western Blot Analysis of Protein Expression',
      researchArea: 'Biochemistry',
      technique: 'Western Blot',
      sampleType: 'Cell lysates from adherent cell lines',
      organism: 'Human (HeLa, HEK293)',
      equipment: 'SDS-PAGE apparatus, transfer unit, power supply, imaging system, centrifuge, sonicator',
      reagents: 'RIPA buffer, protease inhibitors, Laemmli buffer, PVDF membrane, blocking buffer, primary antibodies, HRP-secondary antibodies, ECL substrate',
      biosafetyLevel: 'BSL-2',
      goal: 'Detect and semi-quantify target protein expression in cell lysates following drug treatment',
      additionalNotes: 'Use beta-actin as loading control. Include positive and negative controls.',
    },
  },
  {
    label: '🧪 CRISPR-Cas9 Gene Knockout',
    input: {
      experimentName: 'CRISPR-Cas9 Gene Knockout in Cell Lines',
      researchArea: 'Genetics',
      technique: 'CRISPR-Cas9 Gene Editing',
      sampleType: 'Adherent mammalian cell lines',
      organism: 'Human (HEK293T)',
      equipment: 'Cell culture hood, CO2 incubator, electroporator, fluorescence microscope, flow cytometer, PCR machine',
      reagents: 'Cas9 protein, sgRNA, electroporation buffer, puromycin, T7 endonuclease, genomic DNA extraction kit',
      biosafetyLevel: 'BSL-2',
      goal: 'Generate stable gene knockout cell lines using CRISPR-Cas9 RNP delivery',
      additionalNotes: 'Design 3 sgRNAs per target gene. Validate with T7E1 assay and Sanger sequencing.',
    },
  },
  {
    label: '💉 Flow Cytometry Immunophenotyping',
    input: {
      experimentName: 'Multi-Color Flow Cytometry Immunophenotyping',
      researchArea: 'Immunology',
      technique: 'Flow Cytometry (FACS)',
      sampleType: 'Peripheral blood mononuclear cells (PBMCs)',
      organism: 'Human',
      equipment: 'Flow cytometer (BD FACSCanto II), centrifuge, vortex, cell counter, biosafety cabinet',
      reagents: 'FACS buffer, Fc block, fluorescent antibodies (CD3-FITC, CD4-PE, CD8-APC, CD19-BV421), viability dye, compensation beads, fixation buffer',
      biosafetyLevel: 'BSL-2',
      goal: 'Characterize T cell and B cell populations in PBMC samples from clinical study participants',
      additionalNotes: 'Use FMO controls for gating. Acquire minimum 50,000 events in lymphocyte gate.',
    },
  },
]

export default function SOPGeneratorForm({ onSubmit, isRunning }: Props) {
  const [form, setForm] = useState<SOPGeneratorInput>({
    experimentName: '',
    researchArea: '',
    technique: '',
    sampleType: '',
    organism: '',
    equipment: '',
    reagents: '',
    biosafetyLevel: 'BSL-2',
    goal: '',
    additionalNotes: '',
  })

  const update = (field: keyof SOPGeneratorInput, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const loadTemplate = (template: Partial<SOPGeneratorInput>) =>
    setForm(prev => ({ ...prev, ...template }))

  const isValid = form.experimentName.trim() && form.researchArea && form.technique && form.goal.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid) onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Quick Templates */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
          Quick Templates
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TEMPLATES.map(t => (
            <button key={t.label} type="button" onClick={() => loadTemplate(t.input)} style={{
              padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text)',
              transition: 'border-color 0.15s',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label="Experiment / Protocol Name *" required>
          <input
            value={form.experimentName}
            onChange={e => update('experimentName', e.target.value)}
            placeholder="e.g. RT-qPCR Analysis of BRCA1 Expression"
            style={inputStyle}
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Research Area *" required>
            <select value={form.researchArea} onChange={e => update('researchArea', e.target.value)} style={inputStyle}>
              <option value="">Select area...</option>
              {RESEARCH_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </FormField>
          <FormField label="Technique *" required>
            <select value={form.technique} onChange={e => update('technique', e.target.value)} style={inputStyle}>
              <option value="">Select technique...</option>
              {TECHNIQUES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Sample Type">
            <input
              value={form.sampleType}
              onChange={e => update('sampleType', e.target.value)}
              placeholder="e.g. Cell lysates, tissue sections, blood"
              style={inputStyle}
            />
          </FormField>
          <FormField label="Organism">
            <input
              value={form.organism}
              onChange={e => update('organism', e.target.value)}
              placeholder="e.g. Human, Mouse (C57BL/6), E. coli"
              style={inputStyle}
            />
          </FormField>
        </div>

        <FormField label="Equipment">
          <textarea
            value={form.equipment}
            onChange={e => update('equipment', e.target.value)}
            placeholder="List major equipment needed (comma-separated)"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </FormField>

        <FormField label="Reagents">
          <textarea
            value={form.reagents}
            onChange={e => update('reagents', e.target.value)}
            placeholder="List key reagents, buffers, kits (comma-separated)"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </FormField>

        <FormField label="Biosafety Level">
          <div style={{ display: 'flex', gap: 8 }}>
            {BSL_LEVELS.map(bsl => (
              <button key={bsl} type="button" onClick={() => update('biosafetyLevel', bsl)} style={{
                padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: form.biosafetyLevel === bsl ? bslColor(bsl) : 'var(--surface)',
                border: `1px solid ${form.biosafetyLevel === bsl ? bslColor(bsl) : 'var(--border)'}`,
                color: form.biosafetyLevel === bsl ? '#fff' : 'var(--text)',
              }}>
                {bsl}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Goal / Objective *" required>
          <textarea
            value={form.goal}
            onChange={e => update('goal', e.target.value)}
            placeholder="What is the primary goal of this protocol? What outcome should it produce?"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </FormField>

        <FormField label="Additional Notes">
          <textarea
            value={form.additionalNotes}
            onChange={e => update('additionalNotes', e.target.value)}
            placeholder="Any special considerations, constraints, or requirements"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </FormField>
      </div>

      {/* Submit */}
      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button type="submit" disabled={!isValid || isRunning} style={{
          background: isValid ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--surface2)',
          border: 'none', borderRadius: 10, color: isValid ? '#fff' : 'var(--text-muted)',
          padding: '14px 32px', fontSize: 14, fontWeight: 600, cursor: isValid ? 'pointer' : 'not-allowed',
          opacity: isRunning ? 0.6 : 1,
        }}>
          {isRunning ? '⏳ Running...' : '🚀 Launch 10-Agent Swarm Analysis'}
        </button>
      </div>
    </form>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────
function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--surface)',
  border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--text)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
}

function bslColor(bsl: string): string {
  switch (bsl) {
    case 'BSL-1': return '#10b981'
    case 'BSL-2': return '#f59e0b'
    case 'BSL-3': return '#f97316'
    case 'BSL-4': return '#dc2626'
    default: return 'var(--border)'
  }
}
