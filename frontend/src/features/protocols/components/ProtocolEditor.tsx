import React, { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import type { Protocol } from '../types/protocol.types'
import { v4 as uuidv4 } from 'uuid'

const TEMPLATE_CONTENT: Record<string, string> = {
  sop: `<h1>Standard Operating Procedure</h1>
<h2>1. Objective</h2><p>Describe the purpose of this protocol.</p>
<h2>2. Scope</h2><p>Applicable sample types, instruments, personnel.</p>
<h2>3. Safety &amp; PPE</h2><ul><li>Gloves</li><li>Lab coat</li><li>Eye protection</li></ul>
<h2>4. Materials &amp; Reagents</h2>
<table><tbody><tr><th>Item</th><th>Supplier</th><th>Catalog #</th><th>Amount</th></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>
<h2>5. Equipment</h2><ul><li>Item 1</li></ul>
<h2>6. Procedure</h2>
<ol><li><p><strong>Step 1:</strong> Description</p></li><li><p><strong>Step 2:</strong> Description</p></li></ol>
<h2>7. QC Acceptance Criteria</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">QC check 1</li><li data-type="taskItem" data-checked="false">QC check 2</li></ul>
<h2>8. Troubleshooting</h2>
<table><tbody><tr><th>Problem</th><th>Possible Cause</th><th>Solution</th></tr><tr><td></td><td></td><td></td></tr></tbody></table>
<h2>9. References</h2><ol><li></li></ol>`,
  cellCulture: `<h1>Cell Culture Maintenance Protocol</h1>
<h2>Cell Line Information</h2>
<table><tbody><tr><th>Cell Line</th><th>Source</th><th>Passage #</th><th>BSL</th></tr><tr><td></td><td></td><td></td><td>BSL-1</td></tr></tbody></table>
<h2>Growth Conditions</h2><ul><li>Media: DMEM + 10% FBS + 1% Pen/Strep</li><li>Temperature: 37°C</li><li>CO₂: 5%</li><li>Humidity: 95%</li></ul>
<h2>Passaging Procedure</h2>
<ol><li><p>Aspirate spent media</p></li><li><p>Wash with 1× PBS</p></li><li><p>Add 2 mL Trypsin-EDTA (0.25%), incubate 3–5 min at 37°C</p></li><li><p>Neutralise with complete media, transfer to 15 mL tube</p></li><li><p>Centrifuge 300× g for 5 min</p></li><li><p>Resuspend in fresh media, seed at 1:5 ratio</p></li></ol>
<h2>QC Checklist</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">Mycoplasma test negative (monthly)</li><li data-type="taskItem" data-checked="false">Cell morphology normal</li><li data-type="taskItem" data-checked="false">Passage number recorded</li></ul>`,
  qpcr: `<h1>qPCR Assay Protocol</h1>
<h2>Primer Information</h2>
<table><tbody><tr><th>Gene</th><th>Forward Primer</th><th>Reverse Primer</th><th>Amplicon (bp)</th><th>Efficiency</th></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>
<h2>Reaction Setup (per well)</h2>
<table><tbody><tr><th>Component</th><th>Volume (µL)</th><th>Final Conc.</th></tr><tr><td>SYBR Green Master Mix (2×)</td><td>10</td><td>1×</td></tr><tr><td>Forward primer (10 µM)</td><td>0.8</td><td>400 nM</td></tr><tr><td>Reverse primer (10 µM)</td><td>0.8</td><td>400 nM</td></tr><tr><td>cDNA template</td><td>1</td><td>—</td></tr><tr><td>Nuclease-free water</td><td>7.4</td><td>—</td></tr><tr><td><strong>Total</strong></td><td><strong>20</strong></td><td></td></tr></tbody></table>
<h2>Thermocycler Programme</h2>
<table><tbody><tr><th>Stage</th><th>Temperature</th><th>Time</th><th>Cycles</th></tr><tr><td>Polymerase activation</td><td>95°C</td><td>2 min</td><td>1</td></tr><tr><td>Denaturation</td><td>95°C</td><td>15 s</td><td>40</td></tr><tr><td>Annealing/Extension</td><td>60°C</td><td>60 s</td><td>40</td></tr><tr><td>Melt curve</td><td>60–95°C</td><td>+0.3°C steps</td><td>1</td></tr></tbody></table>
<h2>QC Criteria</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">Primer efficiency 90–110%</li><li data-type="taskItem" data-checked="false">R² ≥ 0.99 in standard curve</li><li data-type="taskItem" data-checked="false">NTC Ct &gt; 35 or undetermined</li><li data-type="taskItem" data-checked="false">Single melt curve peak</li></ul>`,
  westernBlot: `<h1>Western Blot Protocol</h1>
<h2>Sample Preparation</h2>
<ol><li><p>Lyse cells in RIPA buffer + protease inhibitor cocktail on ice for 30 min</p></li><li><p>Centrifuge 14,000× g, 15 min, 4°C. Collect supernatant.</p></li><li><p>Quantify protein (BCA assay). Normalise to 20–50 µg per lane.</p></li><li><p>Add 4× Laemmli sample buffer, boil 95°C for 5 min.</p></li></ol>
<h2>SDS-PAGE</h2>
<table><tbody><tr><th>Parameter</th><th>Value</th></tr><tr><td>Gel percentage</td><td>10% (or gradient 4–20%)</td></tr><tr><td>Running buffer</td><td>1× Tris-Glycine-SDS</td></tr><tr><td>Stacking voltage</td><td>80V, 20 min</td></tr><tr><td>Resolving voltage</td><td>120V, 60–90 min</td></tr></tbody></table>
<h2>Antibody Conditions</h2>
<table><tbody><tr><th>Antibody</th><th>Dilution</th><th>Buffer</th><th>Incubation</th></tr><tr><td>Primary (target)</td><td>1:1000</td><td>5% BSA in TBST</td><td>4°C overnight</td></tr><tr><td>Primary (loading ctrl)</td><td>1:5000</td><td>5% milk in TBST</td><td>4°C overnight</td></tr><tr><td>Secondary (HRP)</td><td>1:5000</td><td>5% milk in TBST</td><td>RT, 1 hour</td></tr></tbody></table>
<h2>QC Checklist</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false">Expected band size confirmed</li><li data-type="taskItem" data-checked="false">Loading control (β-actin/GAPDH) uniform</li><li data-type="taskItem" data-checked="false">Positive control band present</li><li data-type="taskItem" data-checked="false">No non-specific bands</li></ul>`,
  biosafety: `<h1>Biosafety SOP</h1>
<h2>Biosafety Level</h2><p><strong>BSL-2</strong> — Work with agents associated with human disease.</p>
<h2>Required PPE</h2>
<ul><li>Gloves (double-glove recommended)</li><li>Lab coat (dedicated, not worn outside lab)</li><li>Eye protection (safety glasses or goggles)</li><li>Closed-toe shoes</li></ul>
<h2>Decontamination Procedures</h2>
<ol><li><p>All liquid waste: Add 10% bleach, contact 30 min before drain disposal</p></li><li><p>Solid biohazardous waste: Autoclave in red biohazard bags at 121°C, 30 min</p></li><li><p>Sharps: Dispose in puncture-resistant sharps container</p></li><li><p>Spills: Alert personnel, apply 10% bleach, absorb, autoclave materials</p></li></ol>
<h2>Emergency Procedures</h2>
<ul><li>Needlestick: Wash with soap/water 10 min, report to supervisor, seek medical attention</li><li>Aerosol release: Evacuate, alert BSO, ventilate 30 min before re-entry</li><li>Emergency contacts: <em>[Insert lab emergency numbers]</em></li></ul>`,
}

interface Props {
  protocol?: Partial<Protocol>
  onSave: (data: Partial<Protocol>) => void
  onCancel: () => void
}

function ToolbarBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 8px', border: 'none', borderRadius: 5,
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 13,
      }}
    >
      {children}
    </button>
  )
}

export default function ProtocolEditor({ protocol, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(protocol?.title || '')
  const [category, setCategory] = useState(protocol?.category || 'molecular-biology')
  const [bsl, setBsl] = useState<'BSL-1' | 'BSL-2' | 'BSL-3' | 'BSL-4'>((protocol?.biosafetyLevel as any) || 'BSL-1')
  const [status, setStatus] = useState<'draft' | 'under_review' | 'approved'>(
    (protocol?.approvalStatus as any) || 'draft'
  )
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [saving, setSaving] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Underline,
      Highlight,
    ],
    content: protocol?.abstract || '<p>Begin writing your protocol here...</p>',
  })

  const loadTemplate = (key: string) => {
    if (!key || !editor) return
    editor.commands.setContent(TEMPLATE_CONTENT[key])
    setSelectedTemplate(key)
  }

  const handleSave = async (submitForReview = false) => {
    if (!editor) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 400))
    const content = editor.getHTML()
    onSave({
      id: protocol?.id || `proto-${uuidv4().slice(0, 8)}`,
      title,
      category,
      biosafetyLevel: bsl as any,
      approvalStatus: submitForReview ? 'under_review' : status,
      abstract: content,
      summary: content.replace(/<[^>]+>/g, '').slice(0, 200),
      version: protocol?.version || '1.0',
      updatedAt: new Date().toISOString(),
      createdAt: protocol?.createdAt || new Date().toISOString(),
    })
    setSaving(false)
  }

  const fieldStyle: React.CSSProperties = {
    padding: '9px 12px', background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text)', fontSize: 14, width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Meta fields */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Protocol Title *"
          style={{ ...fieldStyle, fontSize: 18, fontWeight: 600 }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...fieldStyle, width: 'auto', flex: 1 }}>
            {[
              'microbiology', 'cell-biology', 'cancer-biology', 'molecular-biology',
              'immunology', 'histology-pathology', 'genomics', 'rna-seq',
              'protein-biology', 'flow-cytometry', 'organoid', 'crispr',
              'pcr-qpcr-ddpcr', 'western-blot-elisa-ihc', 'biobanking',
              'biosafety', 'reagent-prep', 'equipment-sop', 'troubleshooting', 'qc-checklists',
            ].map(c => <option key={c} value={c}>{c.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
          </select>
          <select value={bsl} onChange={e => setBsl(e.target.value as any)} style={{ ...fieldStyle, width: 'auto' }}>
            {['BSL-1', 'BSL-2', 'BSL-3', 'BSL-4'].map(b => <option key={b}>{b}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ ...fieldStyle, width: 'auto' }}>
            <option value="draft">Draft</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
          </select>
          <select value={selectedTemplate} onChange={e => loadTemplate(e.target.value)} style={{ ...fieldStyle, width: 'auto' }}>
            <option value="">— Load Template —</option>
            <option value="sop">Standard SOP</option>
            <option value="cellCulture">Cell Culture</option>
            <option value="qpcr">qPCR / ddPCR</option>
            <option value="westernBlot">Western Blot</option>
            <option value="biosafety">Biosafety SOP</option>
          </select>
        </div>
      </div>

      {/* Toolbar */}
      {editor && (
        <div style={{ display: 'flex', gap: 2, padding: '8px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', background: 'var(--surface2)' }}>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><b>B</b></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><i>I</i></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><u>U</u></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">H</ToolbarBtn>
          <span style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1">H1</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">H2</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3">H3</ToolbarBtn>
          <span style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">•</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1.</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist">☑</ToolbarBtn>
          <span style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
          <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">⊞</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Note/Warning">❝</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">&lt;/&gt;</ToolbarBtn>
          <span style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">↩</ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">↪</ToolbarBtn>
        </div>
      )}

      {/* Editor content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <EditorContent
          editor={editor}
          style={{
            minHeight: 400,
            outline: 'none',
          }}
        />
        <style>{`
          .ProseMirror { outline: none; min-height: 380px; font-size: 14px; line-height: 1.7; color: var(--text); }
          .ProseMirror h1 { font-size: 22px; margin: 20px 0 10px; border-bottom: 2px solid var(--border); padding-bottom: 8px; }
          .ProseMirror h2 { font-size: 17px; margin: 16px 0 8px; color: var(--accent); }
          .ProseMirror h3 { font-size: 14px; margin: 12px 0 6px; font-weight: 700; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 24px; margin: 8px 0; }
          .ProseMirror li { margin: 4px 0; }
          .ProseMirror blockquote { border-left: 4px solid var(--accent); padding: 10px 16px; background: var(--surface2); border-radius: 0 8px 8px 0; margin: 12px 0; }
          .ProseMirror code { background: var(--surface2); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
          .ProseMirror pre { background: var(--surface2); padding: 14px; border-radius: 8px; overflow-x: auto; }
          .ProseMirror table { border-collapse: collapse; width: 100%; margin: 12px 0; }
          .ProseMirror th, .ProseMirror td { border: 1px solid var(--border); padding: 8px 12px; font-size: 13px; }
          .ProseMirror th { background: var(--surface2); font-weight: 600; }
          .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
          .ProseMirror li[data-type="taskItem"] { display: flex; gap: 8px; align-items: flex-start; }
          .ProseMirror li[data-type="taskItem"] > label { cursor: pointer; }
          mark { background: rgba(251,191,36,0.3); padding: 1px 2px; border-radius: 2px; }
        `}</style>
      </div>

      {/* Footer actions */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--surface)' }}>
        <button onClick={onCancel} style={{ padding: '9px 18px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', cursor: 'pointer', fontSize: 14 }}>
          Cancel
        </button>
        <button onClick={() => handleSave(false)} disabled={saving} style={{ padding: '9px 18px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          {saving ? 'Saving...' : '💾 Save Draft'}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving} style={{ padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          {saving ? 'Submitting...' : '✓ Submit for Review'}
        </button>
      </div>
    </div>
  )
}
