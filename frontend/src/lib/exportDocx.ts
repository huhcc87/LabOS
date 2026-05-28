// All docx imports are dynamic so they never enter the eager bundle,
// avoiding the duplicate-React module-graph issue Vite v5 / docx v9 produce.

function saveBlob(buf: Blob, filename: string) {
  const url = URL.createObjectURL(buf);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Grant Composer export ────────────────────────────────────────────────────

export interface GrantExportOptions {
  title: string;
  grantType: string;
  disease: string;
  sections: Record<string, string>;
  sectionDefs: { key: string; label: string; icon: string }[];
}

export async function exportGrantDocx(opts: GrantExportOptions) {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, BorderStyle, Header, Footer, PageNumber, NumberFormat,
  } = await import('docx');

  const { title, grantType, disease, sections, sectionDefs } = opts;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  function body(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, size: 24 })],
      spacing: { after: 160 },
      alignment: AlignmentType.JUSTIFIED,
    });
  }

  function h2(text: string) {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 160 },
    });
  }

  function divider() {
    return new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
      spacing: { before: 80, after: 80 },
      text: '',
    });
  }

  function splitText(text: string) {
    return text.split('\n').map(line =>
      line.trim() === ''
        ? new Paragraph({ text: '', spacing: { after: 60 } })
        : body(line)
    );
  }

  const children: any[] = [
    new Paragraph({
      children: [new TextRun({ text: title || 'Untitled Grant', bold: true, size: 52, color: '1A365D' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${grantType} — ${disease}`, size: 26, color: '2C5282', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${date}`, size: 20, color: '888888' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    }),
    divider(),
  ];

  for (const def of sectionDefs) {
    const content = sections[def.key];
    if (!content?.trim()) continue;
    children.push(h2(`${def.icon} ${def.label}`));
    children.push(...splitText(content));
    children.push(divider());
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'num',
        levels: [{ level: 0, format: NumberFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: title || 'Grant Application', size: 18, color: '888888' }),
              new TextRun({ text: `  |  ${grantType}`, size: 18, color: 'AAAAAA' }),
            ],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'Page ', size: 18, color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' }),
              new TextRun({ text: ' of ', size: 18, color: '888888' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '888888' }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children,
    }],
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 24 } },
        heading1: { run: { bold: true, size: 36, color: '1A365D' } },
        heading2: { run: { bold: true, size: 28, color: '2C5282' } },
      },
    },
  });

  const buf = await Packer.toBlob(doc);
  const safe = (title || 'grant').slice(0, 40).replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_');
  saveBlob(buf, `${safe}-${new Date().toISOString().slice(0, 10)}.docx`);
}

// ─── Research AI Swarm export ─────────────────────────────────────────────────

export interface SwarmExportOptions {
  topic: string;
  grantType: string;
  disease: string;
  fieldOverview: string;
  webContext: string;
  researchGaps: string[];
  paperSummaries: { filename: string; key_findings: string; methodology: string; main_conclusion: string; relevance: string }[];
  novelHypotheses: { hypothesis: string; rationale: string; novelty_score: number; supporting_evidence: string; testability: string }[];
  specificAims: string[];
  objectives: string[];
  grantSections: Record<string, string>;
}

export async function exportSwarmDocx(opts: SwarmExportOptions) {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, BorderStyle, ShadingType, Header, Footer, PageNumber, NumberFormat,
  } = await import('docx');

  const {
    topic, grantType, disease, fieldOverview, webContext,
    researchGaps, paperSummaries, novelHypotheses,
    specificAims, objectives, grantSections,
  } = opts;

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  function body(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, size: 24 })],
      spacing: { after: 140 },
      alignment: AlignmentType.JUSTIFIED,
    });
  }

  function h1(text: string) {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 160 } });
  }

  function h2(text: string) {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } });
  }

  function h3(text: string) {
    return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 } });
  }

  function bullet(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, size: 24 })],
      bullet: { level: 0 },
      spacing: { after: 80 },
    });
  }

  function meta(label: string, value: string) {
    return new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 22 }),
        new TextRun({ text: value, size: 22, color: '555555' }),
      ],
      spacing: { after: 80 },
    });
  }

  function highlight(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, size: 22, italics: true })],
      shading: { type: ShadingType.CLEAR, fill: 'EBF5FF' },
      indent: { left: 360, right: 360 },
      spacing: { before: 80, after: 80 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: '0071BC' } },
    });
  }

  function divider() {
    return new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
      spacing: { before: 80, after: 80 },
      text: '',
    });
  }

  function splitText(text: string) {
    return text.split('\n').map(line =>
      line.trim() === ''
        ? new Paragraph({ text: '', spacing: { after: 60 } })
        : body(line)
    );
  }

  const children: any[] = [
    // Cover
    new Paragraph({
      children: [new TextRun({ text: 'Research AI Swarm', bold: true, size: 20, color: '6366F1' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 320, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Literature Synthesis Report', bold: true, size: 52, color: '1A365D' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    meta('Topic', topic),
    meta('Grant Type', grantType || 'NIH R01'),
    meta('Disease / Condition', disease || 'General'),
    meta('Papers Analysed', String(paperSummaries.length)),
    meta('Generated', date),
    divider(),

    h1('1. Field Overview'),
    ...splitText(fieldOverview),
    divider(),

    h1('2. Research Gaps'),
    ...researchGaps.map((g, i) => bullet(`G${i + 1}. ${g}`)),
    divider(),

    h1('3. Latest Field Intelligence (2023–2025)'),
    ...splitText(webContext),
    divider(),

    h1('4. Novel Hypotheses'),
    ...novelHypotheses.flatMap((h, i) => [
      h3(`Hypothesis ${i + 1}  [Novelty Score: ${h.novelty_score}/10]`),
      highlight(h.hypothesis),
      meta('Rationale', h.rationale),
      meta('Evidence', h.supporting_evidence),
      meta('Testability', h.testability),
      new Paragraph({ text: '', spacing: { after: 80 } }),
    ]),
    divider(),

    h1('5. Specific Aims'),
    ...specificAims.map((a, i) => bullet(`Aim ${i + 1}: ${a}`)),
    divider(),

    h1('6. Objectives'),
    ...objectives.map(o => bullet(o)),
    divider(),

    h1('7. Draft Grant Sections'),
    ...Object.entries(grantSections).flatMap(([key, val]) => [
      h2(key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())),
      ...splitText(val as string),
      divider(),
    ]),

    h1('Appendix — Individual Paper Summaries'),
    ...paperSummaries.flatMap((p, i) => [
      h3(`${i + 1}. ${p.filename}`),
      meta('Key Findings', p.key_findings),
      meta('Methodology', p.methodology),
      meta('Conclusion', p.main_conclusion),
      meta('Relevance', p.relevance),
      new Paragraph({ text: '', spacing: { after: 80 } }),
    ]),
  ];

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'num',
        levels: [{ level: 0, format: NumberFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: `Research AI Swarm — ${topic.slice(0, 50)}`, size: 18, color: '888888' })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'Page ', size: 18, color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' }),
              new TextRun({ text: ' of ', size: 18, color: '888888' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '888888' }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children,
    }],
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 24 } },
        heading1: { run: { bold: true, size: 36, color: '1A365D' } },
        heading2: { run: { bold: true, size: 28, color: '2C5282' } },
        heading3: { run: { bold: true, size: 24, color: '444444' } },
      },
    },
  });

  const buf = await Packer.toBlob(doc);
  const safe = topic.slice(0, 40).replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'research_synthesis';
  saveBlob(buf, `${safe}_swarm_${new Date().toISOString().slice(0, 10)}.docx`);
}
