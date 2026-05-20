import { useState, useRef, useCallback, useEffect } from 'react';
import { grantsApi } from '../lib/api';
import type { SwarmExportOptions } from '../lib/exportDocx';

// ─── Disease / Condition list ─────────────────────────────────────────────────

const DISEASES: { group: string; items: string[] }[] = [
  { group: '🔴 Cancer — CNS / Brain', items: ['Glioblastoma (GBM)', 'Diffuse Intrinsic Pontine Glioma (DIPG)', 'Glioma (Low-Grade)', 'Meningioma', 'Medulloblastoma', 'Ependymoma', 'Primary CNS Lymphoma', 'Brain Metastases'] },
  { group: '🔴 Cancer — Hematologic', items: ['Acute Myeloid Leukemia (AML)', 'Acute Lymphoblastic Leukemia (ALL)', 'Chronic Myeloid Leukemia (CML)', 'Chronic Lymphocytic Leukemia (CLL)', 'Multiple Myeloma', 'Hodgkin Lymphoma', 'Diffuse Large B-Cell Lymphoma (DLBCL)', 'Follicular Lymphoma', 'T-Cell Lymphoma', 'Myelodysplastic Syndrome (MDS)', 'Myeloproliferative Neoplasms'] },
  { group: '🔴 Cancer — Solid Tumors', items: ['Breast Cancer (HR+)', 'Breast Cancer (HER2+)', 'Triple-Negative Breast Cancer (TNBC)', 'Non-Small Cell Lung Cancer (NSCLC)', 'Small Cell Lung Cancer (SCLC)', 'Colorectal Cancer', 'Pancreatic Ductal Adenocarcinoma', 'Hepatocellular Carcinoma', 'Cholangiocarcinoma', 'Gastric / Gastroesophageal Cancer', 'Esophageal Cancer', 'Ovarian Cancer', 'Cervical Cancer', 'Endometrial Cancer', 'Prostate Cancer', 'Bladder Cancer', 'Renal Cell Carcinoma', 'Thyroid Cancer', 'Head & Neck Squamous Cell Carcinoma', 'Melanoma', 'Merkel Cell Carcinoma', 'Sarcoma (Soft Tissue)', 'Osteosarcoma', 'Ewing Sarcoma', 'Neuroblastoma', 'Wilms Tumor', 'Retinoblastoma', 'Mesothelioma', 'Adrenocortical Carcinoma', 'Pheochromocytoma / Paraganglioma'] },
  { group: '🧠 Neurological & Psychiatric', items: ["Alzheimer's Disease", "Parkinson's Disease", 'Amyotrophic Lateral Sclerosis (ALS)', 'Multiple Sclerosis', "Huntington's Disease", 'Frontotemporal Dementia (FTD)', 'Lewy Body Dementia', 'Traumatic Brain Injury (TBI)', 'Spinal Cord Injury', 'Epilepsy', 'Stroke / Ischemic Stroke', 'Neuropathic Pain', 'Migraine', 'Major Depressive Disorder', 'Bipolar Disorder', 'Schizophrenia', 'Post-Traumatic Stress Disorder (PTSD)', 'Autism Spectrum Disorder (ASD)', 'Attention-Deficit/Hyperactivity Disorder (ADHD)', 'Anxiety Disorders'] },
  { group: '❤️ Cardiovascular', items: ['Heart Failure (HFrEF)', 'Heart Failure (HFpEF)', 'Coronary Artery Disease', 'Myocardial Infarction', 'Atrial Fibrillation', 'Hypertension', 'Pulmonary Arterial Hypertension', 'Aortic Stenosis', 'Dilated Cardiomyopathy', 'Hypertrophic Cardiomyopathy', 'Peripheral Artery Disease', 'Venous Thromboembolism (VTE)'] },
  { group: '🔵 Metabolic & Endocrine', items: ['Type 1 Diabetes', 'Type 2 Diabetes', 'Obesity', 'NASH / NAFLD', 'Metabolic Syndrome', 'Hypothyroidism / Hyperthyroidism', "Cushing's Disease", 'Acromegaly', 'Polycystic Ovary Syndrome (PCOS)', 'Osteoporosis'] },
  { group: '🦠 Infectious Disease', items: ['HIV/AIDS', 'Tuberculosis (TB)', 'Malaria', 'COVID-19 / SARS-CoV-2', 'Influenza', 'Hepatitis B', 'Hepatitis C', 'Clostridioides difficile Infection', 'Sepsis', 'Antimicrobial Resistance (AMR)', 'Dengue Fever', 'Ebola', 'Zika Virus', 'Leishmaniasis', 'Chagas Disease'] },
  { group: '🟠 Autoimmune & Inflammatory', items: ['Rheumatoid Arthritis', 'Systemic Lupus Erythematosus (SLE)', "Crohn's Disease", 'Ulcerative Colitis', 'Psoriasis / Psoriatic Arthritis', 'Ankylosing Spondylitis', "Sjögren's Syndrome", 'Systemic Sclerosis / Scleroderma', 'Vasculitis', 'Celiac Disease'] },
  { group: '🫁 Pulmonary & Respiratory', items: ['Chronic Obstructive Pulmonary Disease (COPD)', 'Asthma', 'Idiopathic Pulmonary Fibrosis (IPF)', 'Sarcoidosis', 'Cystic Fibrosis', 'Pulmonary Embolism', 'Obstructive Sleep Apnea', 'Interstitial Lung Disease (ILD)'] },
  { group: '🧬 Rare & Genetic Diseases', items: ['Sickle Cell Disease', 'Hemophilia A / B', 'Duchenne Muscular Dystrophy', 'Spinal Muscular Atrophy (SMA)', 'Phenylketonuria (PKU)', "Gaucher's Disease", "Fabry's Disease", 'Marfan Syndrome', 'Neurofibromatosis', 'Tuberous Sclerosis', 'Fragile X Syndrome', "Tay-Sachs Disease", "Wilson's Disease", 'Hereditary Transthyretin Amyloidosis (hATTR)'] },
  { group: '🩺 Renal & Urological', items: ['Chronic Kidney Disease (CKD)', 'Acute Kidney Injury (AKI)', 'IgA Nephropathy', 'Focal Segmental Glomerulosclerosis (FSGS)', 'Lupus Nephritis', 'Diabetic Nephropathy', 'Polycystic Kidney Disease (PKD)'] },
  { group: '🟢 Musculoskeletal & Bone', items: ['Osteoarthritis', 'Osteoporosis', 'Gout', 'Fibromyalgia', 'Bone Metastases'] },
];

// ─── Grant type list ──────────────────────────────────────────────────────────

const GRANT_TYPES: { group: string; items: string[] }[] = [
  { group: 'NIH — Research Grants (R series)', items: ['NIH R01 (Standard Research Project)', 'NIH R21 (Exploratory/Developmental)', 'NIH R03 (Small Research Grant)', 'NIH R15 (AREA — Academic Research Enhancement)', 'NIH R34 (Clinical Trial Planning)', 'NIH R41 (SBIR Phase I)', 'NIH R42 (SBIR Phase II)', 'NIH R43 (STTR Phase I)', 'NIH R44 (STTR Phase II)'] },
  { group: 'NIH — Career Development (K series)', items: ['NIH K99/R00 (Pathway to Independence)', 'NIH K08 (Mentored Clinical Scientist)', 'NIH K23 (Mentored Patient-Oriented Research)', 'NIH K24 (Midcareer Patient-Oriented Research)', 'NIH K22 (Career Transition)', 'NIH K25 (Mentored Quantitative Research)', 'NIH K01 (Mentored Research Scientist Development)'] },
  { group: 'NIH — Training & Fellowships', items: ['NIH F30 (MD/PhD Fellowship)', 'NIH F31 (Predoctoral Fellowship)', 'NIH F32 (Postdoctoral Fellowship)', 'NIH F99/K00 (Predoctoral to Postdoctoral Transition)', 'NIH T32 (Institutional Training Grant)'] },
  { group: 'NIH — Program & Center Grants', items: ['NIH P01 (Program Project Grant)', 'NIH P20 (Exploratory Center)', 'NIH P30 (Core Center Grant)', 'NIH P50 (Specialized Center)', 'NIH U01 (Cooperative Research Project)', 'NIH U54 (Specialized Center — Cooperative)'] },
  { group: 'NIH — High-Risk / Transformative', items: ['NIH DP1 (Pioneer Award)', 'NIH DP2 (New Innovator Award)', 'NIH DP5 (Early Independence Award)'] },
  { group: 'NSF — National Science Foundation', items: ['NSF CAREER Award', 'NSF DBI (Biological Infrastructure)', 'NSF MCB (Molecular & Cellular Biosciences)', 'NSF IOS (Integrative Organismal Systems)', 'NSF CBET (Chemical, Bioengineering, Environmental & Transport)', 'NSF SBE (Social, Behavioral & Economic Sciences)', 'NSF RAPID', 'NSF EAGER'] },
  { group: 'DOD / Defense', items: ['DOD CDMRP — Breast Cancer Research Program', 'DOD CDMRP — Prostate Cancer Research Program', 'DOD CDMRP — Lung Cancer Research Program', 'DOD CDMRP — Ovarian Cancer Research Program', 'DOD CDMRP — Brain Cancer Research Program', 'DOD CDMRP — Melanoma Research Program', 'DOD CDMRP — Rare Cancers Research Program', 'DARPA Young Faculty Award (YFA)', 'USAMRAA Investigator-Initiated', 'BARDA (Biomedical Advanced R&D Authority)'] },
  { group: 'Private Foundations & Nonprofits', items: ['American Cancer Society (ACS) Research Scholar Grant', 'American Heart Association (AHA)', 'HHMI Investigator Program', 'HHMI Hanna H. Gray Fellows Program', 'Bill & Melinda Gates Foundation Grand Challenges', 'Simons Foundation', 'Moore Foundation', 'Wellcome Trust (UK)', 'Cancer Research UK (CRUK)', 'Damon Runyon Cancer Research Foundation', 'V Foundation for Cancer Research', 'Stand Up To Cancer (SU2C)', 'Leukemia & Lymphoma Society (LLS)', 'National Multiple Sclerosis Society', "Alzheimer's Association", 'Cystic Fibrosis Foundation', 'Muscular Dystrophy Association (MDA)', "Michael J. Fox Foundation (Parkinson's)", "Alex's Lemonade Stand Foundation (Pediatric)"] },
  { group: 'International & Other', items: ['EU Horizon Europe (ERC Starting Grant)', 'EU Horizon Europe (ERC Consolidator)', 'EU Horizon Europe (ERC Advanced)', 'EU Horizon Europe (MSCA Postdoctoral Fellowship)', 'CIHR (Canada)', 'NHMRC (Australia)', 'DFG (Germany)', 'ANR (France)', 'PCORI (Patient-Centered Outcomes Research)', 'AHRQ (Agency for Healthcare Research & Quality)'] },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleLibrary {
  id: string;
  name: string;
  description: string;
  articles: Article[];
  createdAt: string;
  color: string;
}

interface LitFile {
  id: string;
  filename: string;
  content: string;
  size: string;
}

interface Article {
  id: string;
  pmid?: string;
  doi?: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  abstract: string;
  url: string;
}

interface PaperSummary {
  filename: string;
  key_findings: string;
  methodology: string;
  main_conclusion: string;
  relevance: string;
}

interface HypothesisItem {
  hypothesis: string;
  rationale: string;
  novelty_score: number;
  supporting_evidence: string;
  testability: string;
}

interface SynthesisResult {
  paper_summaries: PaperSummary[];
  field_overview: string;
  research_gaps: string[];
  web_context: string;
  novel_hypotheses: HypothesisItem[];
  specific_aims: string[];
  objectives: string[];
  grant_sections: Record<string, string>;
  source: string;
}

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const STAGES = [
  { id: 'ingest',     icon: '📚', label: 'Ingesting Literature',      desc: 'Reading and parsing uploaded papers' },
  { id: 'summarise',  icon: '🔍', label: 'Analysing Each Paper',       desc: 'Extracting key findings & methods' },
  { id: 'gaps',       icon: '🕳️', label: 'Mapping Research Gaps',       desc: 'Identifying unresolved questions' },
  { id: 'web',        icon: '🌐', label: 'Web Intelligence Search',    desc: 'Synthesising latest field advances' },
  { id: 'hypothesis', icon: '🧬', label: 'Generating Hypotheses',      desc: 'Creating novel, testable hypotheses' },
  { id: 'aims',       icon: '🎯', label: 'Drafting Specific Aims',     desc: 'Structuring NIH-style aims & objectives' },
  { id: 'compose',    icon: '✍️', label: 'Composing Grant Sections',   desc: 'Writing Specific Aims & Significance' },
];

const LIBRARY_COLORS = ['#6366f1', '#0071bc', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6'];

// ─── Library persistence ──────────────────────────────────────────────────────

function loadLibraries(): ArticleLibrary[] {
  try { return JSON.parse(localStorage.getItem('labos_article_libraries') || '[]'); } catch { return []; }
}
function saveLibraries(libs: ArticleLibrary[]) {
  localStorage.setItem('labos_article_libraries', JSON.stringify(libs));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function NoveltyBadge({ score }: { score: number }) {
  const color = score >= 9 ? '#22c55e' : score >= 7 ? '#f59e0b' : '#6366f1';
  const label = score >= 9 ? 'High Novelty' : score >= 7 ? 'Novel' : 'Incremental';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${color}20`, color, border: `1px solid ${color}40`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
      ⭐ {score}/10 · {label}
    </span>
  );
}

function articleToFile(a: Article): LitFile {
  const content = `Title: ${a.title}\nAuthors: ${a.authors}\nJournal: ${a.journal} (${a.year})\nPMID: ${a.pmid || 'N/A'}\nDOI: ${a.doi || 'N/A'}\nURL: ${a.url}\n\nAbstract:\n${a.abstract}`;
  return { id: a.id, filename: `${a.title.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, '')}.txt`, content, size: `${(content.length / 1024).toFixed(1)} KB` };
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STOP_WORDS = new Set(['the','a','an','and','or','of','in','for','to','with','by','on','at','is','are','was','were','that','this','from','as','into','via','using','between','among','after','before','during','through','within','without','against','toward','upon','effect','effects','role','roles','impact','impacts','study','studies','analysis','review','novel','new','patients','patient','cells','cell','gene','genes','protein','proteins','expression','associated','based','cancer','tumor','tumour','therapy','treatment','clinical','human','mouse','model','models','type','high','low','increased','decreased','activity','function','signaling','pathway','data','results','show','showed','identify','identified','report','reported','case','cases','level','levels','group','groups','target','targeting','potential','mechanism','mechanisms','approach']);

function autoGenerateTopic(articles: Article[]): string {
  if (!articles.length) return '';
  const wordCounts: Record<string, number> = {};
  articles.forEach(a => {
    (a.title + ' ' + (a.journal || '')).toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).forEach(w => {
      if (w.length > 4 && !STOP_WORDS.has(w)) wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
  });
  return Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w.replace(/-/g, ' ')).join(' ');
}

// ─── PubMed API ──────────────────────────────────────────────────────────────

const NCBI = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

async function pubmedSearch(query: string): Promise<string[]> {
  const r = await fetch(`${NCBI}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=25&retmode=json&sort=relevance`);
  const j = await r.json();
  return j.esearchresult?.idlist || [];
}

async function pubmedSummary(ids: string[]): Promise<Article[]> {
  if (!ids.length) return [];
  const r = await fetch(`${NCBI}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
  const j = await r.json();
  const result = j.result || {};
  return (result.uids || ids).map((pmid: string) => {
    const d = result[pmid] || {};
    const authors = (d.authors || []).slice(0, 3).map((a: any) => a.name).join(', ') + (d.authors?.length > 3 ? ' et al.' : '');
    const doi = (d.articleids || []).find((x: any) => x.idtype === 'doi')?.value || '';
    return { id: `pmid-${pmid}`, pmid, doi, title: d.title || 'Untitled', authors: authors || 'Unknown authors', journal: d.source || '', year: (d.pubdate || '').split(' ')[0] || '', abstract: '', url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
  });
}

async function pubmedAbstracts(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const r = await fetch(`${NCBI}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=text`);
  const text = await r.text();
  const map: Record<string, string> = {};
  const blocks = text.split(/\n\n\d+\.\s+/).filter(Boolean);
  ids.forEach((id, i) => { map[id] = blocks[i]?.trim() || text.trim(); });
  return map;
}

async function fetchByDOI(doi: string): Promise<Article | null> {
  try {
    const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    const j = await r.json();
    const w = j.message;
    const authors = (w.author || []).slice(0, 3).map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).join(', ') + (w.author?.length > 3 ? ' et al.' : '');
    return { id: `doi-${doi}`, doi, title: (w.title || ['Untitled'])[0], authors, journal: (w['container-title'] || [''])[0], year: w.published?.['date-parts']?.[0]?.[0]?.toString() || '', abstract: w.abstract?.replace(/<[^>]+>/g, '') || '', url: w.URL || `https://doi.org/${doi}` };
  } catch { return null; }
}

// ─── Library Browse Panel (display-only, state lives in LiteratureFinder) ────

function LibraryBrowse({
  libraries, onLoad, onAddAllToSwarm, onDelete, onRemoveArticle,
}: {
  libraries: ArticleLibrary[];
  onLoad: (articles: Article[]) => void;
  onAddAllToSwarm: (articles: Article[]) => void;
  onDelete: (id: string) => void;
  onRemoveArticle: (libId: string, artId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
        background: open ? 'var(--accent)' : 'var(--surface)', color: open ? 'white' : 'var(--text)',
        fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      }}>
        📚 Libraries
        {libraries.length > 0 && <span style={{ background: open ? 'rgba(255,255,255,0.25)' : 'var(--accent)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{libraries.length}</span>}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 38, zIndex: 300, width: 420, maxHeight: 560, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>📚 My Article Libraries</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>×</button>
          </div>

          {libraries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No libraries yet.<br />Select articles and click <strong>"💾 Save to Library"</strong> to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {libraries.map(lib => (
                <div key={lib.id} style={{ border: `1px solid ${lib.color}40`, borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
                  <div style={{ padding: '10px 12px', borderLeft: `3px solid ${lib.color}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: lib.color }}>{lib.name}</div>
                      {lib.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{lib.description}</div>}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {lib.articles.length} article{lib.articles.length !== 1 ? 's' : ''} · {new Date(lib.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { onAddAllToSwarm(lib.articles); setOpen(false); }} style={{ padding: '4px 12px', background: 'linear-gradient(135deg,#6366f1,#0071bc)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        🧬 Swarm All ({lib.articles.length})
                      </button>
                      <button onClick={() => { onLoad(lib.articles); setOpen(false); }} style={{ padding: '4px 10px', background: `${lib.color}20`, color: lib.color, border: `1px solid ${lib.color}40`, borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
                        ↑ Load
                      </button>
                      {confirmDelete === lib.id ? (
                        <>
                          <button onClick={() => { onDelete(lib.id); setConfirmDelete(null); }} style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Delete?</button>
                          <button onClick={() => setConfirmDelete(null)} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>✕</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(lib.id)} style={{ padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>🗑</button>
                      )}
                    </div>
                  </div>
                  {lib.articles.length > 0 && (
                    <div style={{ maxHeight: 130, overflowY: 'auto', padding: '4px 8px 8px' }}>
                      {lib.articles.map(art => (
                        <div key={art.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {art.title}</span>
                          <button onClick={() => onRemoveArticle(lib.id, art.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 0, flexShrink: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Save to Library inline picker ───────────────────────────────────────────

function SaveToLibraryPicker({
  libraries, selectedCount, onSave, onCreateAndSave,
}: {
  libraries: ArticleLibrary[];
  selectedCount: number;
  onSave: (libId: string) => void;
  onCreateAndSave: (name: string, desc: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const handle = (libId: string) => {
    onSave(libId);
    setSaved(libId);
    setTimeout(() => { setSaved(null); setOpen(false); }, 1200);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateAndSave(newName.trim(), newDesc.trim());
    setNewName(''); setNewDesc('');
    setTimeout(() => setOpen(false), 1200);
  };

  if (selectedCount === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding: '6px 14px', background: open ? '#6366f1' : 'rgba(99,102,241,0.15)',
        color: open ? 'white' : '#818cf8', border: '1px solid rgba(99,102,241,0.35)',
        borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
        💾 Save to Library
      </button>

      {open && (
        <div style={{ position: 'absolute', left: 0, top: 36, zIndex: 300, width: 280, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          {/* Existing libraries */}
          {libraries.length > 0 && (
            <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Add to existing library</div>
              {libraries.map(lib => (
                <button key={lib.id} onClick={() => handle(lib.id)} style={{
                  width: '100%', padding: '8px 12px', background: saved === lib.id ? 'rgba(34,197,94,0.1)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: lib.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lib.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {saved === lib.id ? '✓ Saved!' : `${lib.articles.length} articles`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Create new */}
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              {libraries.length === 0 ? 'Create your first library' : 'Create new library'}
            </div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Library name *"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, marginBottom: 5, boxSizing: 'border-box' }} />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleCreate} disabled={!newName.trim()} style={{ flex: 1, padding: '7px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: !newName.trim() ? 0.5 : 1 }}>
                + Create & Save {selectedCount} article{selectedCount !== 1 ? 's' : ''}
              </button>
              <button onClick={() => setOpen(false)} style={{ padding: '7px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Literature Finder Panel ─────────────────────────────────────────────────

function LiteratureFinder({ onAddToSwarm }: { onAddToSwarm: (articles: Article[]) => void }) {
  const [mode, setMode] = useState<'topic' | 'pmid' | 'doi'>('topic');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fetchingAbstracts, setFetchingAbstracts] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [suggestedTopic, setSuggestedTopic] = useState('');

  // Library state lives here so bulk actions bar can access it
  const [libraries, setLibraries] = useState<ArticleLibrary[]>(loadLibraries);

  const persistLibs = (libs: ArticleLibrary[]) => { setLibraries(libs); saveLibraries(libs); };

  const selectedArticles = results.filter(r => selected.has(r.id));
  const selCount = selected.size;

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setResults([]); setSelected(new Set()); setSearchErr(''); setSuggestedTopic('');
    try {
      let articles: Article[] = [];
      if (mode === 'topic') {
        const ids = await pubmedSearch(query.trim());
        if (!ids.length) { setSearchErr('No results found. Try different keywords.'); return; }
        articles = await pubmedSummary(ids);
      } else if (mode === 'pmid') {
        const ids = query.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
        articles = await pubmedSummary(ids);
      } else {
        const dois = query.split(/[\s,\n]+/).map(s => s.trim()).filter(Boolean);
        articles = (await Promise.all(dois.map(fetchByDOI))).filter(Boolean) as Article[];
      }
      setResults(articles);
      setSuggestedTopic(autoGenerateTopic(articles));
    } catch { setSearchErr('Search failed — check your connection.'); }
    finally { setSearching(false); }
  };

  const loadAbstractFor = async (article: Article) => {
    if (article.abstract) { setExpanded(article.id); return; }
    if (article.pmid) {
      setFetchingAbstracts(true);
      const map = await pubmedAbstracts([article.pmid]);
      setResults(prev => prev.map(a => a.pmid === article.pmid ? { ...a, abstract: map[article.pmid] || 'Abstract not available.' } : a));
      setFetchingAbstracts(false);
    }
    setExpanded(article.id);
  };

  const loadSelectedAbstracts = async (arts: Article[]): Promise<Article[]> => {
    const need = arts.filter(a => !a.abstract && a.pmid);
    if (!need.length) return arts;
    setFetchingAbstracts(true);
    const map = await pubmedAbstracts(need.map(a => a.pmid!));
    const enriched = arts.map(a => a.pmid && map[a.pmid] ? { ...a, abstract: map[a.pmid] } : a);
    setResults(prev => prev.map(r => enriched.find(e => e.id === r.id) || r));
    setFetchingAbstracts(false);
    return enriched;
  };

  const handleAddToSwarm = async () => {
    let sel = await loadSelectedAbstracts(selectedArticles);
    onAddToSwarm(sel);
  };

  const downloadSelected = async () => {
    let sel = await loadSelectedAbstracts(selectedArticles);
    downloadText(sel.map(a => `${'='.repeat(80)}\nTitle: ${a.title}\nAuthors: ${a.authors}\nJournal: ${a.journal} (${a.year})\nPMID: ${a.pmid || 'N/A'} | DOI: ${a.doi || 'N/A'}\nURL: ${a.url}\n\nAbstract:\n${a.abstract || 'Not available'}\n`).join('\n'), `literature_${Date.now()}.txt`);
  };

  const downloadSingle = async (article: Article) => {
    let art = article;
    if (!art.abstract && art.pmid) { const map = await pubmedAbstracts([art.pmid]); art = { ...art, abstract: map[art.pmid] || 'Abstract not available.' }; }
    downloadText(`Title: ${art.title}\nAuthors: ${art.authors}\nJournal: ${art.journal} (${art.year})\nPMID: ${art.pmid || 'N/A'}\nDOI: ${art.doi || 'N/A'}\nURL: ${art.url}\n\nAbstract:\n${art.abstract}`, `${art.title.slice(0, 50).replace(/[^a-zA-Z0-9 ]/g, '')}.txt`);
  };

  // Library operations
  const saveToLibrary = (libId: string) => {
    const sels = results.filter(r => selected.has(r.id));
    persistLibs(libraries.map(lib => {
      if (lib.id !== libId) return lib;
      const existing = new Set(lib.articles.map(a => a.id));
      return { ...lib, articles: [...lib.articles, ...sels.filter(a => !existing.has(a.id))] };
    }));
  };

  const createAndSave = (name: string, desc: string) => {
    const sels = results.filter(r => selected.has(r.id));
    const lib: ArticleLibrary = { id: `lib-${Date.now()}`, name, description: desc, articles: sels, createdAt: new Date().toISOString(), color: LIBRARY_COLORS[libraries.length % LIBRARY_COLORS.length] };
    persistLibs([...libraries, lib]);
  };

  const loadLibrary = (arts: Article[]) => {
    setResults(arts); setSelected(new Set()); setSuggestedTopic(autoGenerateTopic(arts));
  };

  const deleteLibrary = (id: string) => persistLibs(libraries.filter(l => l.id !== id));
  const removeFromLibrary = (libId: string, artId: string) =>
    persistLibs(libraries.map(l => l.id === libId ? { ...l, articles: l.articles.filter(a => a.id !== artId) } : l));

  return (
    <div className="card" style={{ marginBottom: 20, padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>🔎</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Literature Finder</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Search PubMed by topic, PMID, or DOI — select and send to AI Swarm</div>
        </div>
        <LibraryBrowse
          libraries={libraries}
          onLoad={loadLibrary}
          onAddAllToSwarm={arts => { onAddToSwarm(arts); }}
          onDelete={deleteLibrary}
          onRemoveArticle={removeFromLibrary}
        />
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['topic', 'pmid', 'doi'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setQuery(''); setResults([]); setSuggestedTopic(''); }} style={{
            padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: mode === m ? 'var(--accent)' : 'var(--surface2)',
            color: mode === m ? 'white' : 'var(--text-muted)',
          }}>
            {m === 'topic' ? '🔤 Topic / Keywords' : m === 'pmid' ? '🆔 PubMed ID' : '🔗 DOI'}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder={mode === 'topic' ? 'e.g. CAR-T immunotherapy glioblastoma' : mode === 'pmid' ? 'e.g. 38234567, 38123456 (comma-separated)' : 'e.g. 10.1038/s41586-024-07018-7'}
          style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
        <button onClick={doSearch} disabled={searching || !query.trim()} style={{ padding: '9px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', opacity: searching || !query.trim() ? 0.6 : 1 }}>
          {searching ? '⏳ Searching…' : '🔍 Search'}
        </button>
      </div>

      {searchErr && <div style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠️ {searchErr}</div>}

      {/* Auto-suggested topic */}
      {suggestedTopic && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '9px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>✨ Auto-detected topic:</span>
          <span style={{ fontSize: 12, color: 'var(--text)', fontStyle: 'italic', flex: 1 }}>{suggestedTopic}</span>
          <button onClick={() => document.dispatchEvent(new CustomEvent('labos:set-topic', { detail: suggestedTopic }))}
            style={{ padding: '4px 12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
            Use this topic ↓
          </button>
        </div>
      )}

      {/* Bulk actions bar */}
      {results.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
            <input type="checkbox"
              checked={selCount === results.length && results.length > 0}
              onChange={e => setSelected(e.target.checked ? new Set(results.map(r => r.id)) : new Set())}
            />
            {selCount > 0 ? `${selCount} of ${results.length} selected` : `Select all ${results.length} results`}
          </label>

          {selCount > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={handleAddToSwarm} disabled={fetchingAbstracts} style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #6366f1, #0071bc)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {fetchingAbstracts ? '⏳ Loading…' : `🧬 Add ${selCount} to AI Swarm`}
              </button>

              {/* ── Save to Library picker ── */}
              <SaveToLibraryPicker libraries={libraries} selectedCount={selCount} onSave={saveToLibrary} onCreateAndSave={createAndSave} />

              <button onClick={downloadSelected} disabled={fetchingAbstracts} style={{ padding: '6px 14px', background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                ⬇ Download ({selCount})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
          {results.map(article => (
            <div key={article.id} style={{
              border: `1px solid ${selected.has(article.id) ? 'rgba(99,102,241,0.45)' : 'var(--border)'}`,
              borderRadius: 10, overflow: 'hidden',
              background: selected.has(article.id) ? 'rgba(99,102,241,0.07)' : 'var(--surface)',
              transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
                <input type="checkbox" checked={selected.has(article.id)} onChange={() => toggleSelect(article.id)}
                  style={{ marginTop: 3, cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Explicit color fixes the invisible text bug */}
                  <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.45, marginBottom: 4, color: 'var(--text)' }}>
                    {article.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {article.authors && <span>👤 {article.authors}</span>}
                    {article.journal && <span>📰 {article.journal}</span>}
                    {article.year && <span>📅 {article.year}</span>}
                    {article.pmid && <span style={{ color: '#60a5fa' }}>PMID: {article.pmid}</span>}
                    {article.doi && <span style={{ color: '#a78bfa' }}>DOI: {article.doi}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => expanded === article.id ? setExpanded(null) : loadAbstractFor(article)} style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}>
                    {expanded === article.id ? '▲ Hide' : '▼ Abstract'}
                  </button>
                  <a href={article.url} target="_blank" rel="noreferrer" style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>↗</a>
                  <button onClick={() => downloadSingle(article)} title="Download abstract" style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>⬇</button>
                </div>
              </div>
              {expanded === article.id && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {article.abstract
                    ? <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)', margin: 0 }}>{article.abstract}</p>
                    : <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{fetchingAbstracts ? '⏳ Fetching abstract…' : 'Abstract not available.'}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!searching && results.length === 0 && !searchErr && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>
          Enter a topic, PubMed IDs, or DOIs above and click Search
        </div>
      )}
    </div>
  );
}

// ─── Queue Display — handles 1–100 papers gracefully ─────────────────────────

function QueueDisplay({ files, onRemove, onClear }: { files: LitFile[]; onRemove: (id: string) => void; onClear: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW = 5;
  const shown = expanded ? files : files.slice(0, PREVIEW);
  const hidden = files.length - PREVIEW;
  const large = files.length > 20;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
          QUEUED FOR SWARM
        </span>
        <span style={{ background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>
          {files.length}
        </span>
        {large && (
          <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
            ⚡ Large library — content auto-trimmed for AI context
          </span>
        )}
        <button onClick={onClear} style={{ marginLeft: 'auto', padding: '2px 8px', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
          Clear all
        </button>
      </div>

      {/* File list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: expanded ? 340 : 'none', overflowY: expanded ? 'auto' : 'visible' }}>
        {shown.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface)', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12 }}>
            <span style={{ fontSize: 13 }}>📄</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{f.filename}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{f.size}</span>
            <button onClick={() => onRemove(f.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0 }}>×</button>
          </div>
        ))}
      </div>

      {/* Show more / less */}
      {files.length > PREVIEW && (
        <button onClick={() => setExpanded(e => !e)} style={{ padding: '5px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          {expanded ? '▲ Show fewer' : `▼ Show all ${files.length} papers (${hidden} more)`}
        </button>
      )}

      {/* Download */}
      <button onClick={() => downloadText(files.map(f => `${'='.repeat(60)}\n${f.filename}\n${'='.repeat(60)}\n${f.content}\n`).join('\n'), `all_${files.length}_articles.txt`)}
        style={{ padding: '5px 12px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
        ⬇ Download all {files.length} queued papers
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  onSendToGrant: (sections: Record<string, string>, topic: string) => void;
}

export default function ResearchAITab({ onSendToGrant }: Props) {
  const [files, setFiles] = useState<LitFile[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [topic, setTopic] = useState('');
  const [disease, setDisease] = useState('');
  const [grantType, setGrantType] = useState('NIH R01 (Standard Research Project)');
  const [extraContext, setExtraContext] = useState('');
  const [dragging, setDragging] = useState(false);

  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(-1);
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState('');

  const [expandedPaper, setExpandedPaper] = useState<number | null>(null);
  const [expandedHyp, setExpandedHyp] = useState<number | null>(0);
  const [activeResultTab, setActiveResultTab] = useState<'overview' | 'hypotheses' | 'aims' | 'grant'>('overview');

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: Event) => { const t = (e as CustomEvent).detail; if (t) setTopic(t); };
    document.addEventListener('labos:set-topic', handler);
    return () => document.removeEventListener('labos:set-topic', handler);
  }, []);

  const addFiles = useCallback(async (incoming: File[]) => {
    const newFiles: LitFile[] = [];
    for (const f of incoming.slice(0, 100)) {
      const content = await new Promise<string>(resolve => { const r = new FileReader(); r.onload = e => resolve((e.target?.result as string) || ''); r.readAsText(f, 'utf-8'); });
      newFiles.push({ id: `${f.name}-${Date.now()}`, filename: f.name, content: content.slice(0, 8000), size: `${(f.size / 1024).toFixed(0)} KB` });
    }
    setFiles(prev => [...prev, ...newFiles].slice(0, 100));
  }, []);

  const handleAddFromSearch = (articles: Article[]) => {
    if (!articles.length) return;
    const newFiles = articles.map(articleToFile);
    setFiles(prev => { const ex = new Set(prev.map(f => f.id)); return [...prev, ...newFiles.filter(f => !ex.has(f.id))].slice(0, 100); });
    if (!topic && articles.length > 0) setTopic(autoGenerateTopic(articles));
  };

  const runPipeline = async () => {
    const texts = [...files.map(f => ({ filename: f.filename, content: f.content })), ...(pasteText.trim() ? [{ filename: 'Pasted Text', content: pasteText.trim() }] : [])];
    if (!texts.length) { setError('Add at least one article — search PubMed above, upload a file, or paste text.'); return; }
    if (!topic.trim()) { setError('Enter a research topic.'); return; }

    setError(''); setRunning(true); setResult(null); setCurrentStage(0);
    const timer = setInterval(() => setCurrentStage(p => p < STAGES.length - 1 ? p + 1 : p), 2200);
    try {
      const res = await grantsApi.researchSynthesis({ texts, topic: topic.trim(), disease: disease.trim(), grant_type: grantType, extra_context: extraContext.trim() });
      clearInterval(timer); setCurrentStage(STAGES.length); setResult(res.data); setActiveResultTab('overview');
    } catch (err: any) {
      clearInterval(timer); setError(err.response?.data?.detail || 'Synthesis failed — check backend connection.');
    } finally { setRunning(false); }
  };

  const totalSources = files.length + (pasteText.trim() ? 1 : 0);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 28 }}>🧬</span>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text)' }}>Research AI Swarm</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Search PubMed → select articles → AI synthesises gaps → novel hypotheses → grant-ready content</p>
          </div>
          {result && (
            <span style={{ marginLeft: 'auto', background: result.source === 'openai' ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.12)', color: result.source === 'openai' ? '#818cf8' : '#4ade80', border: `1px solid ${result.source === 'openai' ? '#6366f140' : '#22c55e40'}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>
              {result.source === 'openai' ? '⚡ GPT-4o Powered' : '📋 Template Mode'}
            </span>
          )}
        </div>
      </div>

      {!running && !result && (
        <>
          <LiteratureFinder onAddToSwarm={handleAddFromSearch} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>ALSO ADD MANUALLY</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Upload zone */}
            <div>
              <div className="card"
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(99,102,241,0.05)' : 'var(--surface)', transition: 'all 0.2s', marginBottom: 10 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 14, color: 'var(--text)' }}>Drop files here</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF, TXT — up to 20 papers</div>
                <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }} />
              </div>
              {files.length > 0 && (
                <QueueDisplay files={files} onRemove={id => setFiles(p => p.filter(x => x.id !== id))} onClear={() => setFiles([])} />
              )}
            </div>

            {/* Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>OR PASTE TEXT / ABSTRACTS</label>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Paste full text or abstracts from multiple papers here…"
                  style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>RESEARCH TOPIC *</label>
                <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. CAR-T therapy in GBM"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${topic ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
                {topic && <div style={{ fontSize: 10, color: '#818cf8', marginTop: 3 }}>✓ Auto-filled — edit as needed</div>}
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DISEASE / CONDITION</label>
                <select value={disease} onChange={e => setDisease(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: disease ? 'var(--text)' : 'var(--text-muted)', fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">Select disease / condition…</option>
                  {DISEASES.map(({ group, items }) => (
                    <optgroup key={group} label={group}>
                      {items.map(item => <option key={item} value={item}>{item}</option>)}
                    </optgroup>
                  ))}
                  <optgroup label="── Other">
                    <option value="Other (specify in topic)">Other (specify in topic)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>GRANT TYPE</label>
                <select value={grantType} onChange={e => setGrantType(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}>
                  {GRANT_TYPES.map(({ group, items }) => (
                    <optgroup key={group} label={group}>
                      {items.map(item => <option key={item} value={item}>{item}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>EXTRA CONTEXT</label>
                <input value={extraContext} onChange={e => setExtraContext(e.target.value)} placeholder="Lab expertise, preliminary data, PI background…"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
        </>
      )}

      {error && <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', marginBottom: 16, fontSize: 13 }}>⚠️ {error}</div>}

      {!running && !result && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          <button onClick={runPipeline} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #6366f1, #0071bc)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
            🚀 Launch AI Swarm
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ color: totalSources > 20 ? '#f59e0b' : 'var(--text-muted)', fontWeight: totalSources > 20 ? 700 : 400 }}>
              {totalSources} paper{totalSources !== 1 ? 's' : ''}
            </span>
            {' '}ready · 7 AI agents
            {totalSources > 20 && <span style={{ color: '#f59e0b' }}> · adaptive batching enabled</span>}
            {disease && <> · <span style={{ color: '#f59e0b' }}>{disease}</span></>}
            {grantType && <> · <span style={{ color: '#818cf8' }}>{grantType}</span></>}
          </span>
        </div>
      )}

      {/* Pipeline progress */}
      {running && (
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 20, height: 20, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>AI Swarm Running…</span>
            <span style={{ fontSize: 12, color: totalSources > 20 ? '#f59e0b' : 'var(--text-muted)', fontWeight: totalSources > 20 ? 700 : 400 }}>
              {totalSources} paper{totalSources !== 1 ? 's' : ''}
              {totalSources > 20 && ' · adaptive batching'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STAGES.map((stage, i) => {
              const done = i < currentStage; const active = i === currentStage;
              return (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, background: done ? 'rgba(34,197,94,0.08)' : active ? 'rgba(99,102,241,0.1)' : 'var(--surface)', border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : active ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, transition: 'all 0.4s' }}>
                  {done ? <span style={{ width: 28, height: 28, background: '#22c55e20', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</span>
                    : active ? <div style={{ width: 28, height: 28, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    : <span style={{ width: 28, height: 28, background: 'var(--surface2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{i + 1}</span>}
                  <span style={{ fontSize: 18 }}>{stage.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: done ? '#4ade80' : active ? '#818cf8' : 'var(--text-muted)' }}>{stage.label}</div>
                    {active && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stage.desc}</div>}
                  </div>
                  {active && <div style={{ marginLeft: 'auto', fontSize: 11, color: '#818cf8', fontWeight: 600 }}>Running…</div>}
                  {done && <div style={{ marginLeft: 'auto', fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Done</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !running && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['overview', 'hypotheses', 'aims', 'grant'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveResultTab(tab)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: activeResultTab === tab ? 'var(--accent)' : 'var(--surface)', color: activeResultTab === tab ? 'white' : 'var(--text)' }}>
                  {tab === 'overview' ? '📊 Overview' : tab === 'hypotheses' ? '🧬 Hypotheses' : tab === 'aims' ? '🎯 Aims' : '✍️ Grant Sections'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  const opts: SwarmExportOptions = {
                    topic, grantType, disease,
                    fieldOverview: result.field_overview,
                    webContext: result.web_context,
                    researchGaps: result.research_gaps,
                    paperSummaries: result.paper_summaries,
                    novelHypotheses: result.novel_hypotheses,
                    specificAims: result.specific_aims,
                    objectives: result.objectives,
                    grantSections: result.grant_sections,
                  };
                  const { exportSwarmDocx } = await import('../lib/exportDocx');
                  await exportSwarmDocx(opts);
                }}
                style={{ padding: '8px 14px', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, background: 'rgba(99,102,241,0.12)', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                ⬇ Word (.docx)
              </button>
              <button onClick={() => downloadText([`RESEARCH AI SWARM — ${topic}\n${'='.repeat(60)}`, `\nFIELD OVERVIEW:\n${result.field_overview}`, `\nRESEARCH GAPS:\n${result.research_gaps.map((g, i) => `${i + 1}. ${g}`).join('\n')}`, `\nNOVEL HYPOTHESES:\n${result.novel_hypotheses.map((h, i) => `${i + 1}. [Score: ${h.novelty_score}/10]\n${h.hypothesis}\nRationale: ${h.rationale}`).join('\n\n')}`, `\nSPECIFIC AIMS:\n${result.specific_aims.map((a, i) => `Aim ${i + 1}: ${a}`).join('\n\n')}`, `\nGRANT SECTIONS:\n${Object.entries(result.grant_sections).map(([k, v]) => `--- ${k.toUpperCase()} ---\n${v}`).join('\n\n')}`].join('\n'), `research_synthesis_${topic.slice(0, 30).replace(/\s+/g, '_')}.txt`)}
                style={{ padding: '8px 14px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                ⬇ Text (.txt)
              </button>
              <button onClick={() => { setResult(null); setCurrentStage(-1); }} style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>↺ New Analysis</button>
              <button onClick={() => onSendToGrant(result.grant_sections, topic)} style={{ padding: '8px 20px', background: 'linear-gradient(135deg, #0071bc, #1a4480)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📝 Send to Grant Composer</button>
            </div>
          </div>

          {activeResultTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>🌍 Field Overview <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{result.paper_summaries.length} papers analysed</span></div>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{result.field_overview}</p>
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                  🕳️ Research Gaps <span style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{result.research_gaps.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.research_gaps.map((gap, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                      <span style={{ color: '#f87171', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>G{i + 1}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: 'var(--text)' }}>🌐 Latest Field Intelligence</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{result.web_context}</p>
              </div>
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--text)' }}>📚 Paper Summaries</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.paper_summaries.map((p, i) => (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <button onClick={() => setExpandedPaper(expandedPaper === i ? null : i)} style={{ width: '100%', padding: '12px 16px', background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                        <span>📄</span><span style={{ fontWeight: 600, fontSize: 13, flex: 1, color: 'var(--text)' }}>{p.filename}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{expandedPaper === i ? '▲' : '▼'}</span>
                      </button>
                      {expandedPaper === i && (
                        <div style={{ padding: '12px 16px 16px', background: 'var(--bg)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {[['🔑 Key Findings', p.key_findings], ['🔬 Methodology', p.methodology], ['💡 Conclusion', p.main_conclusion], ['🎯 Relevance', p.relevance]].map(([label, text]) => (
                            <div key={label as string}>
                              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                              <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeResultTab === 'hypotheses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.08)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)', fontSize: 13, color: 'var(--text-muted)' }}>
                🧬 <strong>AI-Generated Novel Hypotheses</strong> — Ranked by novelty score. Each addresses identified research gaps and is directly testable.
              </div>
              {result.novel_hypotheses.map((h, i) => (
                <div key={i} className="card" style={{ border: `1px solid ${h.novelty_score >= 9 ? 'rgba(34,197,94,0.25)' : 'rgba(99,102,241,0.2)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 28, flexShrink: 0 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)' }}>HYPOTHESIS {i + 1}</span>
                        <NoveltyBadge score={h.novelty_score} />
                      </div>
                      <p style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.6, margin: 0, color: 'var(--text)' }}>{h.hypothesis}</p>
                    </div>
                    <button onClick={() => setExpandedHyp(expandedHyp === i ? null : i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}>
                      {expandedHyp === i ? '▲' : '▼'}
                    </button>
                  </div>
                  {expandedHyp === i && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      {[['📖 Rationale', h.rationale, '#60a5fa'], ['🔬 Supporting Evidence', h.supporting_evidence, '#a78bfa'], ['✅ Testability', h.testability, '#4ade80']].map(([label, text, color]) => (
                        <div key={label as string} style={{ padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 11, color: color as string, marginBottom: 6 }}>{label}</div>
                          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>{text}</div>
                        </div>
                      ))}
                      <div style={{ padding: 12, background: 'linear-gradient(135deg, rgba(0,113,188,0.1), rgba(99,102,241,0.1))', borderRadius: 8, border: '1px solid rgba(0,113,188,0.2)' }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: '#60a5fa', marginBottom: 6 }}>💡 USE THIS HYPOTHESIS</div>
                        <button onClick={() => onSendToGrant({ specific_aims: `Central Hypothesis:\n${h.hypothesis}` }, topic)} style={{ padding: '6px 14px', background: '#0071bc', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>→ Send to Grant Composer</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeResultTab === 'aims' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text)' }}>🎯 Specific Aims (NIH-Style)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {result.specific_aims.map((aim, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #0071bc, #6366f1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{aim}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>📋 Research Objectives</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.objectives.map((obj, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(0,113,188,0.06)', borderRadius: 8, border: '1px solid rgba(0,113,188,0.15)' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>O{i + 1}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--text)' }}>📊 Summary</div>
                {[['Papers Analysed', result.paper_summaries.length, '#6366f1'], ['Gaps Identified', result.research_gaps.length, '#f87171'], ['Novel Hypotheses', result.novel_hypotheses.length, '#22c55e'], ['Specific Aims', result.specific_aims.length, '#0071bc'], ['Objectives', result.objectives.length, '#f59e0b']].map(([label, value, color]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 700, color: color as string }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeResultTab === 'grant' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 16px', background: 'rgba(0,113,188,0.08)', borderRadius: 10, border: '1px solid rgba(0,113,188,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>✍️ AI-drafted grant sections — send directly to Grant Composer</span>
                <button onClick={() => onSendToGrant(result.grant_sections, topic)} style={{ padding: '8px 18px', background: '#0071bc', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📝 Send All to Grant Composer</button>
              </div>
              {Object.entries(result.grant_sections).map(([key, content]) => (
                <div key={key} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                      {key === 'specific_aims' ? '📋 Specific Aims' : key === 'significance' ? '📈 Significance' : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => navigator.clipboard?.writeText(content as string)} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>📋 Copy</button>
                      <button onClick={() => downloadText(content as string, `${key}.txt`)} style={{ padding: '4px 10px', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontSize: 11 }}>⬇ .txt</button>
                    </div>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)', margin: 0, maxHeight: 400, overflowY: 'auto' }}>{content}</pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
