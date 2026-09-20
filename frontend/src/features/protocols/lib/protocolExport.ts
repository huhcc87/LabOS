import { saveAs } from 'file-saver'
import type { Protocol } from '../types/protocol.types'

// ── PDF Export ────────────────────────────────────────────────────────────────
export async function exportProtocolPDF(protocol: Protocol) {
  const jspdfModule = await import('jspdf')
  const jsPDF = jspdfModule.default || (jspdfModule as any).jsPDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const margin = 18
  const pageW = 210
  const contentW = pageW - margin * 2
  let y = margin

  const addText = (text: string, size = 10, bold = false, color = '#1a1a1a') => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(color)
    const lines = doc.splitTextToSize(text, contentW)
    lines.forEach((line: string) => {
      if (y > 275) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += size * 0.45
    })
    y += 2
  }

  const addSection = (title: string) => {
    y += 4
    if (y > 265) { doc.addPage(); y = margin }
    doc.setFillColor(37, 99, 235)
    doc.rect(margin, y - 4, contentW, 8, 'F')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#ffffff')
    doc.text(title.toUpperCase(), margin + 3, y + 1)
    doc.setTextColor('#1a1a1a')
    y += 8
  }

  // Header
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageW, 38, 'F')
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#ffffff')
  doc.text(protocol.title, margin, 18, { maxWidth: contentW })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#94a3b8')
  doc.text(`ID: ${protocol.id}  |  Version: ${protocol.version}  |  Status: ${protocol.approvalStatus}  |  BSL: ${protocol.biosafetyLevel || 'N/A'}`, margin, 30)
  y = 46

  // Meta
  addText(`Author: ${protocol.authors.join(', ')}`, 9)
  addText(`Category: ${protocol.category} › ${protocol.subcategory}`, 9)
  addText(`Last Updated: ${new Date(protocol.updatedAt).toLocaleDateString()}`, 9)

  // Objective
  addSection('Objective / Summary')
  addText(protocol.summary, 10)

  // Safety
  if (protocol.safetyNotes?.length) {
    addSection('Safety & PPE')
    protocol.safetyNotes.forEach(s => addText(`• ${s}`, 9))
  }

  // Materials
  if (protocol.reagents?.length) {
    addSection('Reagents & Materials')
    protocol.reagents.forEach(r => addText(`• ${r}`, 9))
  }
  if (protocol.equipment?.length) {
    addSection('Equipment')
    protocol.equipment.forEach(e => addText(`• ${e}`, 9))
  }

  // Steps
  addSection('Protocol Steps')
  protocol.steps.forEach(step => {
    addText(`Step ${step.stepNumber}: ${step.title}`, 10, true)
    addText(step.instruction, 9)
    if (step.duration) addText(`  Duration: ${step.duration}`, 9, false, '#64748b')
    if (step.temperature) addText(`  Temperature: ${step.temperature}`, 9, false, '#64748b')
    if (step.caution) addText(`  ⚠ Caution: ${step.caution}`, 9, false, '#b45309')
    if (step.notes) addText(`  Note: ${step.notes}`, 9, false, '#64748b')
    y += 2
  })

  // QC Checklist
  if (protocol.qcChecklist?.length) {
    addSection('QC Checklist')
    protocol.qcChecklist.forEach(q => addText(`☐  ${q}`, 9))
  }

  // Troubleshooting
  if (protocol.troubleshooting?.length) {
    addSection('Troubleshooting')
    protocol.troubleshooting.forEach(t => {
      addText(`Problem: ${t.problem}`, 9, true)
      addText(`Solution: ${t.solution}`, 9)
      y += 2
    })
  }

  // References
  if (protocol.references?.length) {
    addSection('References')
    protocol.references.forEach((r, i) => addText(`${i + 1}. ${r.citationText}`, 8))
  }

  // Footer
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#94a3b8')
    doc.text(`LabOS Protocol Library | ${protocol.title} | Page ${i} of ${totalPages}`, margin, 292)
  }

  doc.save(`protocol-${protocol.id}-v${protocol.version}.pdf`)
}

// ── DOCX Export ───────────────────────────────────────────────────────────────
export async function exportProtocolDOCX(protocol: Protocol) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = await import('docx') as any

  const heading = (text: string, level = HeadingLevel.HEADING_2) =>
    new Paragraph({ heading: level, children: [new TextRun({ text, bold: true })] })

  const bullet = (text: string) =>
    new Paragraph({ bullet: { level: 0 }, children: [new TextRun(text)] })

  const para = (text: string) =>
    new Paragraph({ children: [new TextRun(text)] })

  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' }
  const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: cellBorders, children: [para(`ID: ${protocol.id}`)] }),
        new TableCell({ borders: cellBorders, children: [para(`Version: ${protocol.version}`)] }),
        new TableCell({ borders: cellBorders, children: [para(`Status: ${protocol.approvalStatus}`)] }),
        new TableCell({ borders: cellBorders, children: [para(`BSL: ${protocol.biosafetyLevel || 'N/A'}`)] }),
      ]}),
    ],
  })

  const stepParagraphs = protocol.steps.flatMap(step => [
    heading(`Step ${step.stepNumber}: ${step.title}`, HeadingLevel.HEADING_3),
    para(step.instruction),
    ...(step.duration ? [para(`Duration: ${step.duration}`)] : []),
    ...(step.temperature ? [para(`Temperature: ${step.temperature}`)] : []),
    ...(step.caution ? [new Paragraph({ children: [new TextRun({ text: `⚠ Caution: ${step.caution}`, bold: true, color: 'B45309' })] })] : []),
    new Paragraph({}),
  ])

  const doc = new Document({
    sections: [{
      children: [
        heading(protocol.title, HeadingLevel.HEADING_1),
        metaTable,
        new Paragraph({}),
        heading('Authors'),
        para(protocol.authors.join(', ')),
        heading('Summary'),
        para(protocol.summary),
        ...(protocol.safetyNotes?.length ? [heading('Safety Notes'), ...protocol.safetyNotes.map(bullet)] : []),
        ...(protocol.reagents?.length ? [heading('Reagents'), ...protocol.reagents.map(bullet)] : []),
        ...(protocol.equipment?.length ? [heading('Equipment'), ...protocol.equipment.map(bullet)] : []),
        heading('Protocol Steps'),
        ...stepParagraphs,
        ...(protocol.qcChecklist?.length ? [heading('QC Checklist'), ...protocol.qcChecklist.map(q => bullet(`☐ ${q}`))] : []),
        ...(protocol.troubleshooting?.length ? [
          heading('Troubleshooting'),
          ...protocol.troubleshooting.flatMap(t => [
            new Paragraph({ children: [new TextRun({ text: `Problem: ${t.problem}`, bold: true })] }),
            para(`Solution: ${t.solution}`),
            new Paragraph({}),
          ]),
        ] : []),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `protocol-${protocol.id}-v${protocol.version}.docx`)
}

// ── XLSX Export ───────────────────────────────────────────────────────────────
export async function exportProtocolXLSX(protocol: Protocol) {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  // Steps sheet
  const stepsData = protocol.steps.map(s => ({
    'Step #': s.stepNumber,
    'Title': s.title,
    'Instruction': s.instruction,
    'Duration': s.duration || '',
    'Temperature': s.temperature || '',
    'RPM': s.rpm || '',
    'Notes': s.notes || '',
    'Caution': s.caution || '',
    'Expected Output': s.expectedOutput || '',
    'QC Point': s.qcPoint ? 'Yes' : '',
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stepsData), 'Steps')

  // Reagents sheet
  const reagentsData = protocol.reagents.map(r => ({ 'Reagent': r, 'Amount': '', 'Lot #': '', 'Expiry': '', 'Supplier': '', 'Notes': '' }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reagentsData), 'Reagents')

  // Equipment sheet
  const equipData = protocol.equipment.map(e => ({ 'Equipment': e, 'Model': '', 'Location': '', 'Calibrated': '', 'Notes': '' }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equipData), 'Equipment')

  // QC Checklist sheet
  const qcData = protocol.qcChecklist.map(q => ({ 'QC Check': q, 'Result': '', 'Pass/Fail': '', 'Operator': '', 'Date': '' }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qcData), 'QC Checklist')

  XLSX.writeFile(wb, `protocol-${protocol.id}-v${protocol.version}.xlsx`)
}

// ── CSV Export ────────────────────────────────────────────────────────────────
export function exportProtocolCSV(protocol: Protocol) {
  const rows = [
    ['Field', 'Value'],
    ['Protocol ID', protocol.id],
    ['Title', protocol.title],
    ['Category', protocol.category],
    ['Subcategory', protocol.subcategory],
    ['Version', protocol.version],
    ['Status', protocol.approvalStatus],
    ['Biosafety Level', protocol.biosafetyLevel || ''],
    ['Authors', protocol.authors.join('; ')],
    ['Summary', protocol.summary],
    ['Estimated Time', protocol.estimatedTime || ''],
    ['Difficulty', protocol.difficulty || ''],
    ['Sample Type', protocol.sampleType || ''],
    ['Tags', protocol.tags.join('; ')],
    ['Keywords', protocol.keywords.join('; ')],
    ['Last Updated', protocol.updatedAt],
    [],
    ['Step #', 'Title', 'Instruction', 'Duration', 'Temperature', 'Caution'],
    ...protocol.steps.map(s => [s.stepNumber, s.title, s.instruction, s.duration || '', s.temperature || '', s.caution || '']),
  ]

  const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `protocol-${protocol.id}-checklist.csv`)
}
