import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { errText } from '../../lib/errors';
import { PROTOCOL_CATEGORIES } from './data/categories';
import { templateDraft } from './services/protocolAiService';
import type { Protocol } from './types/protocol.types';

interface ExternalProtocol {
  id: string; title: string; source: string; sourceColor: string; sourceUrl: string;
  category: string; description: string; duration: string; difficulty: string;
  steps: string[];
}

const EXTERNAL_PROTOCOLS: ExternalProtocol[] = [
  // Cold Spring Harbor Protocols
  { id: 'cshl-001', title: 'Western Blotting', source: 'Cold Spring Harbor', sourceColor: '#c2410c', sourceUrl: 'https://cshprotocols.cshlp.org/content/2006/1/pdb.prot3942', category: 'Protein Analysis', description: 'Standard Western blot protocol for protein detection using antibodies.', duration: '4–6 hrs', difficulty: 'Intermediate', steps: ['Prepare SDS-PAGE gel and run electrophoresis', 'Transfer proteins to PVDF membrane', 'Block membrane with 5% milk in TBST', 'Incubate with primary antibody overnight at 4°C', 'Wash 3× with TBST', 'Incubate with HRP-secondary antibody 1 hr', 'Develop with ECL reagent and image'] },
  { id: 'cshl-002', title: 'Chromatin Immunoprecipitation (ChIP)', source: 'Cold Spring Harbor', sourceColor: '#c2410c', sourceUrl: 'https://cshprotocols.cshlp.org/content/2009/9/pdb.prot5279', category: 'Genomics', description: 'ChIP for mapping protein–DNA interactions genome-wide.', duration: '2 days', difficulty: 'Advanced', steps: ['Cross-link cells with 1% formaldehyde', 'Lyse cells and sonicate chromatin', 'Immunoprecipitate with target antibody', 'Reverse cross-links at 65°C overnight', 'Purify DNA', 'Analyze by qPCR or sequencing'] },
  { id: 'cshl-003', title: 'RNA Extraction (TRIzol)', source: 'Cold Spring Harbor', sourceColor: '#c2410c', sourceUrl: 'https://cshprotocols.cshlp.org/content/2010/6/pdb.prot5445', category: 'Molecular Biology', description: 'Total RNA isolation from cells and tissues using TRIzol reagent.', duration: '1–2 hrs', difficulty: 'Beginner', steps: ['Lyse sample in TRIzol', 'Add chloroform and phase-separate', 'Precipitate RNA with isopropanol', 'Wash pellet with 75% ethanol', 'Resuspend in RNase-free water', 'Quantify by NanoDrop'] },
  { id: 'cshl-004', title: 'Agarose Gel Electrophoresis', source: 'Cold Spring Harbor', sourceColor: '#c2410c', sourceUrl: 'https://cshprotocols.cshlp.org/content/2012/1/pdb.prot067694', category: 'Molecular Biology', description: 'Standard DNA separation by agarose gel electrophoresis.', duration: '45 min', difficulty: 'Beginner', steps: ['Prepare 1% agarose in TAE buffer', 'Add ethidium bromide or SYBR safe', 'Load DNA samples with loading dye', 'Run at 100V for 30 min', 'Image under UV light'] },
  { id: 'cshl-005', title: 'Immunofluorescence Staining', source: 'Cold Spring Harbor', sourceColor: '#c2410c', sourceUrl: 'https://cshprotocols.cshlp.org/content/2015/1/pdb.prot083295', category: 'Imaging', description: 'Fluorescent antibody staining of cells for confocal microscopy.', duration: '3–4 hrs', difficulty: 'Intermediate', steps: ['Fix cells with 4% paraformaldehyde', 'Permeabilize with 0.1% Triton X-100', 'Block with 5% BSA', 'Incubate primary antibody 1 hr at RT', 'Wash 3× with PBS', 'Incubate fluorescent secondary antibody', 'Mount with DAPI and image'] },

  // Springer Nature Experiments
  { id: 'spr-001', title: 'CRISPR-Cas9 Gene Editing', source: 'Springer Protocols', sourceColor: '#0891b2', sourceUrl: 'https://experiments.springernature.com/articles/10.1038/nprot.2013.143', category: 'Genomics', description: 'CRISPR-Cas9 guide RNA design and delivery for gene knockout in mammalian cells.', duration: '2–3 weeks', difficulty: 'Advanced', steps: ['Design sgRNA targeting sequence', 'Clone sgRNA into expression vector', 'Transfect cells with Cas9 + sgRNA', 'Select with puromycin 48 hrs', 'Extract DNA and verify editing by sequencing', 'Screen clones by PCR and Western blot'] },
  { id: 'spr-002', title: 'Flow Cytometry Panel Design', source: 'Springer Protocols', sourceColor: '#0891b2', sourceUrl: 'https://experiments.springernature.com/articles/10.1038/nmeth.2698', category: 'Cell Analysis', description: 'Multi-color flow cytometry panel design and cell surface staining.', duration: '3 hrs', difficulty: 'Intermediate', steps: ['Design panel using spectral overlap matrix', 'Prepare single-color compensation controls', 'Block Fc receptors with FcR blocking reagent', 'Stain with primary antibody cocktail 30 min', 'Wash twice with FACS buffer', 'Acquire on flow cytometer', 'Analyze with FlowJo or FCS Express'] },
  { id: 'spr-003', title: 'Co-Immunoprecipitation (Co-IP)', source: 'Springer Protocols', sourceColor: '#0891b2', sourceUrl: 'https://experiments.springernature.com/articles/10.1038/nprot.2015.146', category: 'Protein Analysis', description: 'Co-IP for identifying protein–protein interactions from cell lysates.', duration: '2 days', difficulty: 'Intermediate', steps: ['Lyse cells in IP lysis buffer with protease inhibitors', 'Pre-clear lysate with protein A/G beads', 'Incubate with antibody 2 hrs at 4°C', 'Add protein A/G beads overnight', 'Wash beads 4× with lysis buffer', 'Elute and run on SDS-PAGE', 'Detect by Western blot'] },
  { id: 'spr-004', title: 'Single-Cell RNA Sequencing (scRNA-seq)', source: 'Springer Protocols', sourceColor: '#0891b2', sourceUrl: 'https://experiments.springernature.com/articles/10.1038/nprot.2017.149', category: 'Genomics', description: 'Droplet-based single-cell RNA sequencing library preparation (10x Genomics compatible).', duration: '2 days', difficulty: 'Advanced', steps: ['Prepare single-cell suspension', 'Check viability with trypan blue', 'Load cells into 10x Chromium controller', 'Perform GEM generation and barcoding', 'cDNA amplification and library prep', 'Quality control with Bioanalyzer', 'Sequence and analyze data'] },
  { id: 'spr-005', title: 'Protein Purification (His-tag)', source: 'Springer Protocols', sourceColor: '#0891b2', sourceUrl: 'https://experiments.springernature.com/articles/10.1007/978-1-59745-439-7_7', category: 'Biochemistry', description: 'Recombinant His-tagged protein purification using Ni-NTA affinity chromatography.', duration: '1 day', difficulty: 'Intermediate', steps: ['Induce protein expression with IPTG', 'Harvest cells by centrifugation', 'Lyse cells by sonication', 'Load lysate on Ni-NTA column', 'Wash with 20 mM imidazole', 'Elute with 250 mM imidazole', 'Dialyze and assess purity by SDS-PAGE'] },

  // Bio-Protocol
  { id: 'bio-001', title: 'MTT Cell Viability Assay', source: 'Bio-Protocol', sourceColor: '#059669', sourceUrl: 'https://bio-protocol.org/e1174', category: 'Cell Biology', description: 'Colorimetric MTT assay to measure cell proliferation and cytotoxicity.', duration: '4 hrs', difficulty: 'Beginner', steps: ['Seed cells at 5×10³/well in 96-well plate', 'Treat with compounds for 24–72 hrs', 'Add MTT solution (0.5 mg/mL) for 4 hrs', 'Remove medium; add DMSO to dissolve formazan', 'Read absorbance at 570 nm', 'Calculate % viability vs control'] },
  { id: 'bio-002', title: 'ELISA for Cytokine Quantification', source: 'Bio-Protocol', sourceColor: '#059669', sourceUrl: 'https://bio-protocol.org/e2095', category: 'Immunology', description: 'Sandwich ELISA for measuring secreted cytokine levels in conditioned media.', duration: '5 hrs', difficulty: 'Beginner', steps: ['Coat plate with capture antibody overnight', 'Block with 1% BSA 1 hr', 'Add samples and standards 2 hrs', 'Wash and add detection antibody 1 hr', 'Add streptavidin-HRP 30 min', 'Add TMB substrate, stop with H₂SO₄', 'Read at 450 nm'] },
  { id: 'bio-003', title: 'Lentiviral Transduction', source: 'Bio-Protocol', sourceColor: '#059669', sourceUrl: 'https://bio-protocol.org/e3473', category: 'Molecular Biology', description: 'Lentiviral vector production and transduction for stable gene expression.', duration: '1 week', difficulty: 'Advanced', steps: ['Transfect HEK293T with transfer + packaging plasmids', 'Collect viral supernatant at 48 and 72 hrs', 'Concentrate by ultracentrifugation', 'Titer virus by qPCR', 'Transduce target cells with polybrene', 'Select stable integrants with antibiotic'] },
  { id: 'bio-004', title: 'Wound Healing Migration Assay', source: 'Bio-Protocol', sourceColor: '#059669', sourceUrl: 'https://bio-protocol.org/e1wound', category: 'Cell Biology', description: 'Simple scratch assay to measure cell migration in vitro.', duration: '24–48 hrs', difficulty: 'Beginner', steps: ['Seed cells to confluency in 6-well plate', 'Scratch monolayer with sterile pipette tip', 'Wash to remove debris', 'Image at 0, 12, 24 and 48 hrs', 'Measure wound closure area with ImageJ', 'Calculate migration rate'] },

  // OpenWetWare
  { id: 'oww-001', title: 'Miniprep Plasmid Isolation', source: 'OpenWetWare', sourceColor: '#7c3aed', sourceUrl: 'https://openwetware.org/wiki/Miniprep', category: 'Molecular Biology', description: 'Alkaline lysis miniprep for plasmid DNA isolation from E. coli.', duration: '30 min', difficulty: 'Beginner', steps: ['Pellet 1.5 mL overnight culture', 'Resuspend in buffer P1', 'Lyse with buffer P2, 5 min', 'Neutralize with buffer N3', 'Centrifuge 10 min at 13,000 rpm', 'Bind to spin column, wash, elute', 'Quantify by NanoDrop'] },
  { id: 'oww-002', title: 'Bacterial Transformation (Chemical)', source: 'OpenWetWare', sourceColor: '#7c3aed', sourceUrl: 'https://openwetware.org/wiki/Bacterial_transformation', category: 'Molecular Biology', description: 'Chemical transformation of competent E. coli with plasmid DNA.', duration: '2 hrs', difficulty: 'Beginner', steps: ['Thaw competent cells on ice', 'Add 1–5 ng plasmid DNA', 'Incubate on ice 30 min', 'Heat shock at 42°C for 45 sec', 'Return to ice 2 min', 'Add SOC medium, shake 1 hr at 37°C', 'Plate on selective agar'] },
  { id: 'oww-003', title: 'SDS-PAGE Protein Gel', source: 'OpenWetWare', sourceColor: '#7c3aed', sourceUrl: 'https://openwetware.org/wiki/SDS-PAGE', category: 'Protein Analysis', description: 'Denaturing polyacrylamide gel electrophoresis for protein size separation.', duration: '2 hrs', difficulty: 'Beginner', steps: ['Prepare resolving and stacking gels', 'Boil samples with loading buffer 5 min', 'Load protein ladder and samples', 'Run at 150V for 1 hr', 'Stain with Coomassie or transfer for WB'] },
  { id: 'oww-004', title: 'Yeast Two-Hybrid Assay', source: 'OpenWetWare', sourceColor: '#7c3aed', sourceUrl: 'https://openwetware.org/wiki/Yeast_two-hybrid', category: 'Biochemistry', description: 'Y2H assay for detecting protein–protein interactions in yeast.', duration: '1 week', difficulty: 'Advanced', steps: ['Clone bait and prey into Y2H vectors', 'Transform yeast strain AH109', 'Plate on double dropout medium', 'Verify growth on triple dropout', 'Confirm with β-galactosidase assay'] },

  // JoVE
  { id: 'jove-001', title: 'Confocal Microscopy – Live Cell Imaging', source: 'JoVE', sourceColor: '#dc2626', sourceUrl: 'https://www.jove.com/t/51047', category: 'Imaging', description: 'Live-cell fluorescence imaging on a laser scanning confocal microscope.', duration: '2 hrs', difficulty: 'Intermediate', steps: ['Seed cells on glass-bottom dish', 'Transfect with fluorescent reporter', 'Pre-warm microscope stage to 37°C', 'Set CO₂ and humidity control', 'Find field of interest in widefield', 'Switch to confocal mode, optimize settings', 'Capture time-lapse series'] },
  { id: 'jove-002', title: 'In Vivo Tumor Xenograft Model', source: 'JoVE', sourceColor: '#dc2626', sourceUrl: 'https://www.jove.com/t/1556', category: 'Animal Studies', description: 'Subcutaneous tumor xenograft implantation in immunocompromised mice.', duration: '3–5 weeks', difficulty: 'Advanced', steps: ['Culture tumor cells and verify viability', 'Resuspend in Matrigel (50:50) on ice', 'Anesthetize mice with isoflurane', 'Inject 1–5×10⁶ cells subcutaneously', 'Monitor tumor growth with calipers', 'Calculate tumor volume (L × W² / 2)', 'Euthanize per IACUC protocol'] },
  { id: 'jove-003', title: 'Patch-Clamp Electrophysiology', source: 'JoVE', sourceColor: '#dc2626', sourceUrl: 'https://www.jove.com/t/2173', category: 'Biochemistry', description: 'Whole-cell patch-clamp recording of ion channel activity in neurons.', duration: '4 hrs', difficulty: 'Advanced', steps: ['Pull borosilicate glass pipettes (3–5 MΩ)', 'Fill pipette with intracellular solution', 'Position pipette near cell under DIC optics', 'Form GΩ seal by gentle suction', 'Break in by brief suction/voltage pulse', 'Record in whole-cell configuration', 'Apply voltage or current protocols'] },

  // Protocol Online
  { id: 'po-001', title: 'qPCR Gene Expression Analysis', source: 'Protocol Online', sourceColor: '#b45309', sourceUrl: 'https://www.protocol-online.org/prot/Molecular_Biology/PCR/qPCR_gene_expression_analysis.html', category: 'Molecular Biology', description: 'SYBR Green qPCR for relative gene expression quantification using ΔΔCt method.', duration: '3 hrs', difficulty: 'Intermediate', steps: ['Prepare cDNA from RNA using reverse transcriptase', 'Design primers with 80–150 bp amplicon', 'Prepare master mix with SYBR Green', 'Set up 10 µL reactions in triplicate', 'Run: 95°C 10 min, 40× (95°C 15s, 60°C 1 min)', 'Analyze melt curve for specificity', 'Calculate 2^-ΔΔCt relative expression'] },
  { id: 'po-002', title: 'Subcellular Fractionation', source: 'Protocol Online', sourceColor: '#b45309', sourceUrl: 'https://www.protocol-online.org/prot/Cell_Biology/subcellular_fractionation.html', category: 'Cell Biology', description: 'Sequential centrifugation to isolate nuclear, cytoplasmic, and membrane fractions.', duration: '3 hrs', difficulty: 'Intermediate', steps: ['Lyse cells in hypotonic buffer', 'Centrifuge 300 × g to pellet nuclei', 'Collect cytoplasmic supernatant', 'Centrifuge 10,000 × g for mitochondria', 'Centrifuge 100,000 × g for microsomes', 'Verify fractions by marker proteins on WB'] },

  // Addgene
  { id: 'add-001', title: 'Lipofectamine Transfection', source: 'Addgene', sourceColor: '#1d4ed8', sourceUrl: 'https://www.addgene.org/protocols/transfection/', category: 'Cell Biology', description: 'Lipid-based transient transfection of mammalian cells for plasmid delivery.', duration: '2 hrs + 24–48 hrs expression', difficulty: 'Beginner', steps: ['Seed cells 24 hrs before transfection (60–80% confluent)', 'Dilute Lipofectamine in Opti-MEM', 'Dilute DNA in Opti-MEM', 'Mix DNA + Lipofectamine, incubate 15 min', 'Add complex dropwise to cells', 'Change medium after 4–6 hrs', 'Harvest after 24–72 hrs'] },
  { id: 'add-002', title: 'Luciferase Reporter Assay', source: 'Addgene', sourceColor: '#1d4ed8', sourceUrl: 'https://www.addgene.org/protocols/luciferase-assay/', category: 'Molecular Biology', description: 'Dual luciferase reporter assay for measuring transcriptional activity.', duration: '3 hrs', difficulty: 'Beginner', steps: ['Transfect cells with firefly + Renilla reporter', 'Lyse cells in passive lysis buffer', 'Measure firefly luciferase activity', 'Add Stop & Glo reagent', 'Measure Renilla luciferase activity', 'Normalize firefly to Renilla', 'Compare experimental vs control'] },
];

/** Published protocols from open sources (Cold Spring Harbor, Springer, JoVE, protocols.io …): read the steps, open the source, or import into your protocols. */
export default function ExternalLibrary() {
  const { token } = useAuth();
  const library = useQuery(api.protocolLibrary.list, token ? { token } : 'skip');
  const save = useMutation(api.protocolLibrary.save);
  const [libSearch, setLibSearch] = useState('');
  const [libCategory, setLibCategory] = useState('all');
  const [viewLibProtocol, setViewLibProtocol] = useState<ExternalProtocol | null>(null);

  const importLibProtocol = async (ep: ExternalProtocol) => {
    if (!token) return;
    const id = `ext-${ep.id}`;
    if (library?.some(r => r.key === id)) { toast.error('Already in your Protocols library'); return; }
    const cat = PROTOCOL_CATEGORIES.find(c => c.name.toLowerCase() === ep.category.toLowerCase()) ?? PROTOCOL_CATEGORIES.find(c => ep.category.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()))
    const base = templateDraft({ title: ep.title, category: cat?.id ?? '', subcategory: '', sampleType: '', organism: '', goal: ep.description, platform: '', difficulty: 'intermediate', safetyLevel: 'BSL-1', notes: '' });
    const level = ep.difficulty.toLowerCase();
    const p: Protocol = {
      ...base, id, slug: id, title: ep.title, summary: ep.description, abstract: ep.description,
      protocolType: 'imported', approvalStatus: 'draft', sourceType: 'manual', sourceName: ep.source, sourceUrl: ep.sourceUrl,
      authors: [ep.source], tags: ['imported', ep.source], field: ep.category, estimatedTime: ep.duration,
      difficulty: (['beginner', 'intermediate', 'advanced', 'expert'].includes(level) ? level : 'intermediate') as Protocol['difficulty'],
      steps: ep.steps.map((s, i) => ({ stepNumber: i + 1, title: `Step ${i + 1}`, instruction: s })),
      reagents: [], equipment: [], prerequisites: [], safetyNotes: ['Imported from a public source: review before use.'], qcChecklist: [], troubleshooting: [],
      references: [{ id: `${id}-ref`, title: ep.title, url: ep.sourceUrl, source: 'manual', citationText: `${ep.source}: ${ep.sourceUrl}`, openAccess: true }],
      aiGenerated: false, aiModel: undefined, confidenceScore: undefined, reviewNotes: `Imported from ${ep.source}.`, createdBy: 'Import', owner: 'Pending Assignment', version: '1.0',
    };
    try { await save({ token, key: id, data: JSON.stringify(p) }); toast.success(`"${ep.title}" added to your Protocols library (Draft)`); setViewLibProtocol(null); }
    catch (e) { toast.error(errText(e)); }
  };

  return (
    <>
      {(() => {
        const libCategories = ['all', ...Array.from(new Set(EXTERNAL_PROTOCOLS.map(p => p.category)))];
        const filtered = EXTERNAL_PROTOCOLS.filter(p => {
          const q = libSearch.toLowerCase();
          const matchQ = !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.source.toLowerCase().includes(q);
          const matchCat = libCategory === 'all' || p.category === libCategory;
          return matchQ && matchCat;
        });
        const sources = Array.from(new Set(EXTERNAL_PROTOCOLS.map(p => p.source)));
        return (
          <div>
            {/* Source badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {sources.map(src => {
                const ep = EXTERNAL_PROTOCOLS.find(p => p.source === src)!;
                return (
                  <span key={src} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: ep.sourceColor + '22', color: ep.sourceColor, border: `1px solid ${ep.sourceColor}44` }}>
                    {src} ({EXTERNAL_PROTOCOLS.filter(p => p.source === src).length})
                  </span>
                );
              })}
            </div>

            {/* Feature 3: search + category filter */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="🔍 Search protocols, sources, categories..."
                className="form-input"
                style={{ flex: 1, minWidth: 220 }}
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
              />
              <select className="form-select" style={{ width: 180 }} value={libCategory} onChange={e => setLibCategory(e.target.value)}>
                {libCategories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
              </select>
              <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} protocols</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {filtered.map(ep => (
                <div key={ep.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: ep.sourceColor + '22', color: ep.sourceColor }}>{ep.source}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{ep.category}</span>
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{ep.title}</h3>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{ep.description}</p>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>⏱ {ep.duration}</span>
                    <span>📊 {ep.difficulty}</span>
                    <span>📝 {ep.steps.length} steps</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setViewLibProtocol(ep)}
                    >
                      👁 View Steps
                    </button>
                    <a href={ep.sourceUrl} target="_blank" rel="noopener noreferrer"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--border)' }}>
                      🔗 Source
                    </a>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => importLibProtocol(ep)}
                    >
                      ↓ Import
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No protocols match your search. Try a different keyword or category.
              </div>
            )}
          </div>
        );
      })()}

      {/* Feature 2: Step-by-step external protocol viewer */}
      {viewLibProtocol && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '85vh', overflow: 'auto', padding: 28, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: viewLibProtocol.sourceColor + '22', color: viewLibProtocol.sourceColor, marginBottom: 8, display: 'inline-block' }}>{viewLibProtocol.source}</span>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '4px 0' }}>{viewLibProtocol.title}</h2>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>📂 {viewLibProtocol.category}</span>
                  <span>⏱ {viewLibProtocol.duration}</span>
                  <span>📊 {viewLibProtocol.difficulty}</span>
                </div>
              </div>
              <button onClick={() => setViewLibProtocol(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>{viewLibProtocol.description}</p>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Step-by-Step Procedure</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {viewLibProtocol.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ minWidth: 26, height: 26, borderRadius: '50%', background: viewLibProtocol.sourceColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <a href={viewLibProtocol.sourceUrl} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--border)' }}>
                🔗 Open Full Source
              </a>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => importLibProtocol(viewLibProtocol)}>
                ↓ Import to My Protocols
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
