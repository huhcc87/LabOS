import { useState, useEffect } from 'react';
import { ProtocolExecutionModal } from '../components/ProtocolExecutionModal';
import { protocolsApi } from '../lib/api';
import { useNavigate } from '../context/NavigationContext';

// Types
interface Protocol { id: number; name: string; version: string; status: 'active' | 'draft' | 'archived'; lastUpdated: string; description?: string; category?: string; }
interface SOP { id: number; title: string; category: string; version: string; description?: string; }
interface Instrument { id: number; name: string; location: string; status: 'available' | 'in_use' | 'maintenance'; type?: string; }
interface Booking { id: number; instrument: string; user: string; date: string; time: string; status: 'confirmed' | 'pending'; purpose?: string; }
interface Maintenance { id: number; instrument: string; type: string; date: string; status: 'completed' | 'scheduled' | 'overdue'; notes?: string; }

// Protocol Templates for dropdown
const PROTOCOL_TEMPLATES = [
  { name: 'PCR Amplification', category: 'Molecular Biology', description: 'Standard polymerase chain reaction protocol for DNA amplification' },
  { name: 'Western Blot Analysis', category: 'Protein Analysis', description: 'Protein detection using antibody-based immunoblotting' },
  { name: 'RNA Extraction', category: 'Molecular Biology', description: 'Total RNA isolation from cells or tissues' },
  { name: 'Cell Culture Maintenance', category: 'Cell Biology', description: 'Routine cell culture passage and maintenance procedures' },
  { name: 'ELISA Assay', category: 'Immunology', description: 'Enzyme-linked immunosorbent assay for protein quantification' },
  { name: 'Flow Cytometry', category: 'Cell Analysis', description: 'Cell sorting and analysis by fluorescence' },
  { name: 'DNA Sequencing Prep', category: 'Genomics', description: 'Sample preparation for Sanger or NGS sequencing' },
  { name: 'Protein Purification', category: 'Biochemistry', description: 'Affinity chromatography protein purification' },
  { name: 'Immunofluorescence Staining', category: 'Imaging', description: 'Fluorescent antibody staining for microscopy' },
  { name: 'qPCR / Real-Time PCR', category: 'Molecular Biology', description: 'Quantitative PCR for gene expression analysis' },
];

// SOP Templates
const SOP_TEMPLATES = [
  { title: 'Biosafety Level 2 Procedures', category: 'Safety', description: 'BSL-2 containment and safety protocols' },
  { title: 'Chemical Waste Disposal', category: 'Safety', description: 'Proper disposal of hazardous chemical waste' },
  { title: 'Equipment Calibration', category: 'Quality', description: 'Routine calibration procedures for lab equipment' },
  { title: 'Sample Storage Guidelines', category: 'Operations', description: 'Proper storage conditions for biological samples' },
  { title: 'PPE Requirements', category: 'Safety', description: 'Personal protective equipment guidelines' },
  { title: 'Emergency Procedures', category: 'Safety', description: 'Emergency response and evacuation procedures' },
  { title: 'Autoclave Operation', category: 'Equipment', description: 'Safe autoclave use and sterilization protocols' },
  { title: 'Centrifuge Operation', category: 'Equipment', description: 'Proper centrifuge use and rotor selection' },
  { title: 'Data Management', category: 'Quality', description: 'Electronic lab notebook and data backup procedures' },
  { title: 'Reagent Preparation', category: 'Operations', description: 'Standard buffer and reagent preparation' },
];

// Instrument Types
const INSTRUMENT_TYPES = [
  'Centrifuge', 'PCR Thermocycler', 'Flow Cytometer', 'Spectrophotometer', 'Microscope',
  'Autoclave', 'Incubator', 'Biosafety Cabinet', 'Plate Reader', 'Mass Spectrometer',
  'NMR Spectrometer', 'HPLC', 'Gel Imager', 'Real-Time PCR', 'Sequencer',
];

// Maintenance Types
const MAINTENANCE_TYPES = [
  'Calibration', 'Annual Service', 'Filter Replacement', 'Cleaning', 'Repair',
  'Inspection', 'Software Update', 'Parts Replacement', 'Decontamination', 'Performance Verification',
];

// Time Slots
const TIME_SLOTS = [
  '06:00-07:00', '07:00-08:00', '08:00-09:00', '09:00-10:00', '10:00-11:00',
  '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
  '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00', '20:00-21:00',
  '21:00-22:00',
  // Extended slots
  '08:00-10:00', '09:00-11:00', '10:00-12:00', '13:00-15:00', '14:00-16:00',
  '15:00-17:00', '08:00-12:00', '13:00-17:00', '09:00-17:00', 'Full Day (08:00-18:00)',
];

// ── External Protocol Library ─────────────────────────────────────────────────
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

// Protocol Categories
const PROTOCOL_CATEGORIES = [
  'Molecular Biology', 'Cell Biology', 'Protein Analysis', 'Immunology',
  'Genomics', 'Biochemistry', 'Imaging', 'Microbiology', 'Chemistry',
  'Histology', 'Animal Studies', 'Clinical', 'General',
];

// Locations
const LAB_LOCATIONS = [
  'Room 101', 'Room 102', 'Room 103', 'Room 104', 'Room 105',
  'Room 201', 'Room 202', 'Room 203', 'Cold Room', 'Clean Room',
  'BSL-2 Lab', 'Cell Culture Room', 'Microscopy Suite', 'NMR Room',
  'Mass Spec Room', 'Sequencing Core', 'Flow Cytometry Core',
];

export default function LabHubPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'protocols' | 'sops' | 'instruments' | 'bookings' | 'maintenance' | 'library'>('protocols');

  // Modal states
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [showSOPModal, setShowSOPModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showInstrumentModal, setShowInstrumentModal] = useState(false);

  // View states
  const [viewProtocol, setViewProtocol] = useState<Protocol | null>(null);
  const [viewSOP, setViewSOP] = useState<SOP | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [executingProtocol, setExecutingProtocol] = useState<Protocol | null>(null);
  const [protocolVersions, setProtocolVersions] = useState<any[]>([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [newVersionNum, setNewVersionNum] = useState('');
  const [newVersionNote, setNewVersionNote] = useState('');

  useEffect(() => {
    if (viewProtocol?.id) {
      protocolsApi.listVersions(viewProtocol.id)
        .then(r => setProtocolVersions(r.data))
        .catch(() => setProtocolVersions([]));
    } else {
      setProtocolVersions([]);
    }
  }, [viewProtocol?.id]);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; name: string } | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Bulk Selection States
  const [selectedProtocols, setSelectedProtocols] = useState<Set<number>>(new Set());
  const [selectedSOPs, setSelectedSOPs] = useState<Set<number>>(new Set());
  const [selectedInstruments, setSelectedInstruments] = useState<Set<number>>(new Set());
  const [selectedBookings, setSelectedBookings] = useState<Set<number>>(new Set());
  const [selectedMaintenance, setSelectedMaintenance] = useState<Set<number>>(new Set());

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Sort States
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Bulk Delete Confirmation
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{ type: string; count: number } | null>(null);

  // Help Guide
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Feature: Usage tracking
  const [usageLogs, setUsageLogs] = useState<Record<number, number>>({});
  // Feature: Booking calendar view
  const [bookingView, setBookingView] = useState<'list' | 'calendar'>('list');
  const [calendarWeekStart, setCalendarWeekStart] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d;
  });
  // Feature: Library search + category
  const [libSearch, setLibSearch] = useState('');
  const [libCategory, setLibCategory] = useState('all');
  const [viewLibProtocol, setViewLibProtocol] = useState<ExternalProtocol | null>(null);

  // AI states
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // Form states with enhanced fields
  const [newProtocol, setNewProtocol] = useState<{ name: string; version: string; status: 'draft' | 'active'; description: string; category: string; useTemplate: boolean; customCategory: string }>({
    name: '', version: '1.0', status: 'draft', description: '', category: '', useTemplate: true, customCategory: ''
  });
  const [newSOP, setNewSOP] = useState({
    title: '', category: 'Safety', version: '1.0', description: '', useTemplate: true
  });
  const [newBooking, setNewBooking] = useState({
    instrument: '', user: '', date: '', time: '', purpose: '', customInstrument: '', customTime: ''
  });
  const [newMaintenance, setNewMaintenance] = useState({
    instrument: '', type: '', date: '', notes: '', customInstrument: '', customType: ''
  });
  const [newInstrument, setNewInstrument] = useState<{ name: string; location: string; type: string; status: 'available' | 'maintenance'; customLocation: string; customType: string }>({
    name: '', location: '', type: '', status: 'available', customLocation: '', customType: ''
  });

  // Data states
  const [protocols, setProtocols] = useState<Protocol[]>([
    { id: 1, name: 'PCR Amplification', version: '2.1', status: 'active', lastUpdated: '2024-03-15', category: 'Molecular Biology' },
    { id: 2, name: 'Western Blot Analysis', version: '1.5', status: 'active', lastUpdated: '2024-02-20', category: 'Protein Analysis' },
    { id: 3, name: 'Cell Culture Maintenance', version: '3.0', status: 'active', lastUpdated: '2024-01-10', category: 'Cell Biology' },
    { id: 4, name: 'RNA Extraction', version: '1.2', status: 'draft', lastUpdated: '2024-03-18', category: 'Molecular Biology' },
  ]);

  const [sops, setSOPs] = useState<SOP[]>([
    { id: 1, title: 'Biosafety Level 2 Procedures', category: 'Safety', version: '4.0' },
    { id: 2, title: 'Chemical Waste Disposal', category: 'Safety', version: '2.1' },
    { id: 3, title: 'Equipment Calibration', category: 'Quality', version: '1.3' },
    { id: 4, title: 'Sample Storage Guidelines', category: 'Operations', version: '2.0' },
  ]);

  const [instruments, setInstruments] = useState<Instrument[]>([
    { id: 1, name: 'Centrifuge XR-500', location: 'Room 101', status: 'available', type: 'Centrifuge' },
    { id: 2, name: 'PCR Thermocycler', location: 'Room 102', status: 'in_use', type: 'PCR Thermocycler' },
    { id: 3, name: 'Flow Cytometer', location: 'Room 103', status: 'available', type: 'Flow Cytometer' },
    { id: 4, name: 'Spectrophotometer', location: 'Room 101', status: 'maintenance', type: 'Spectrophotometer' },
  ]);

  const [bookings, setBookings] = useState<Booking[]>([
    { id: 1, instrument: 'Flow Cytometer', user: 'Dr. Smith', date: '2024-03-20', time: '09:00-12:00', status: 'confirmed', purpose: 'Cell sorting' },
    { id: 2, instrument: 'PCR Thermocycler', user: 'J. Chen', date: '2024-03-20', time: '14:00-16:00', status: 'pending', purpose: 'Gene amplification' },
    { id: 3, instrument: 'Centrifuge XR-500', user: 'M. Johnson', date: '2024-03-21', time: '10:00-11:00', status: 'confirmed', purpose: 'Sample prep' },
  ]);

  const [maintenanceLogs, setMaintenanceLogs] = useState<Maintenance[]>([
    { id: 1, instrument: 'Spectrophotometer', type: 'Calibration', date: '2024-03-19', status: 'scheduled' },
    { id: 2, instrument: 'Centrifuge XR-500', type: 'Annual Service', date: '2024-03-15', status: 'completed' },
    { id: 3, instrument: 'PCR Thermocycler', type: 'Filter Replacement', date: '2024-03-10', status: 'overdue' },
  ]);

  // AI Generate Protocol Description
  const generateAIProtocol = (protocolName: string) => {
    setAiGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      const template = PROTOCOL_TEMPLATES.find(t => t.name === protocolName);
      if (template) {
        const aiDescription = `${template.description}\n\n**Procedure Overview:**\n1. Prepare all reagents and equipment\n2. Follow standard safety protocols\n3. Document all steps in lab notebook\n4. Perform quality control checks\n5. Analyze results and record data\n\n**Safety Considerations:**\n- Wear appropriate PPE\n- Follow biosafety guidelines\n- Dispose of waste properly\n\n**Expected Duration:** 2-4 hours\n**Skill Level:** Intermediate`;
        setNewProtocol(prev => ({ ...prev, description: aiDescription }));
      } else {
        setNewProtocol(prev => ({
          ...prev,
          description: `Protocol: ${protocolName}\n\n**Objective:**\nDescribe the main goal of this protocol.\n\n**Materials:**\n- List required reagents\n- List required equipment\n\n**Procedure:**\n1. Step 1\n2. Step 2\n3. Step 3\n\n**Quality Control:**\n- Verification steps\n\n**Safety:**\n- PPE requirements\n- Hazard warnings`
        }));
      }
      setAiGenerating(false);
    }, 1500);
  };

  // AI Generate SOP Content
  const generateAISOP = (sopTitle: string) => {
    setAiGenerating(true);
    setTimeout(() => {
      const template = SOP_TEMPLATES.find(t => t.title === sopTitle);
      if (template) {
        const aiDescription = `${template.description}\n\n**Purpose:**\nThis SOP establishes standardized procedures for ${sopTitle.toLowerCase()}.\n\n**Scope:**\nApplies to all laboratory personnel.\n\n**Responsibilities:**\n- Lab Manager: Oversight and compliance\n- Staff: Daily implementation\n- Safety Officer: Audits and training\n\n**Procedure:**\n1. Review requirements before starting\n2. Follow established protocols\n3. Document all activities\n4. Report any deviations\n\n**Documentation:**\n- Maintain records for 7 years\n- Use approved forms only`;
        setNewSOP(prev => ({ ...prev, description: aiDescription }));
      } else {
        setNewSOP(prev => ({
          ...prev,
          description: `SOP: ${sopTitle}\n\n**Purpose:**\nDefine the purpose of this SOP.\n\n**Scope:**\nDefine who this applies to.\n\n**Definitions:**\n- Key terms\n\n**Procedure:**\n1. Step 1\n2. Step 2\n\n**References:**\n- Related documents`
        }));
      }
      setAiGenerating(false);
    }, 1500);
  };

  // AI Suggest Maintenance
  const getAIMaintenanceSuggestions = (instrumentName: string) => {
    const suggestions = [
      `Schedule preventive maintenance for ${instrumentName}`,
      `Check calibration status - last done 30 days ago`,
      `Replace consumables based on usage hours`,
      `Perform decontamination before next use`,
    ];
    setAiSuggestions(suggestions);
  };

  // Handlers
  const handleCreateProtocol = () => {
    if (!newProtocol.name.trim()) return;
    const template = PROTOCOL_TEMPLATES.find(t => t.name === newProtocol.name);
    const category = newProtocol.category === '__custom__' ? newProtocol.customCategory : newProtocol.category;
    setProtocols(prev => [...prev, {
      id: Date.now(),
      name: newProtocol.name,
      version: newProtocol.version,
      status: newProtocol.status,
      lastUpdated: new Date().toISOString().slice(0, 10),
      description: newProtocol.description,
      category: template?.category || category || 'General',
    }]);
    setNewProtocol({ name: '', version: '1.0', status: 'draft', description: '', category: '', useTemplate: true, customCategory: '' });
    setShowProtocolModal(false);
    showToast('Protocol created successfully!', 'success');
  };

  const handleCreateSOP = () => {
    if (!newSOP.title.trim()) return;
    setSOPs(prev => [...prev, {
      id: Date.now(),
      title: newSOP.title,
      category: newSOP.category,
      version: newSOP.version,
      description: newSOP.description,
    }]);
    setNewSOP({ title: '', category: 'Safety', version: '1.0', description: '', useTemplate: true });
    setShowSOPModal(false);
    showToast('SOP created successfully!', 'success');
  };

  const handleCreateInstrument = () => {
    if (!newInstrument.name.trim()) return;
    const location = newInstrument.location === '__custom__' ? newInstrument.customLocation : newInstrument.location;
    const type = newInstrument.type === '__custom__' ? newInstrument.customType : newInstrument.type;
    setInstruments(prev => [...prev, {
      id: Date.now(),
      name: newInstrument.name,
      location: location || 'TBD',
      status: newInstrument.status,
      type: type || undefined,
    }]);
    setNewInstrument({ name: '', location: '', type: '', status: 'available', customLocation: '', customType: '' });
    setShowInstrumentModal(false);
    showToast('Instrument added successfully!', 'success');
  };

  const handleCreateBooking = () => {
    const instrumentName = newBooking.instrument === '__custom__' ? newBooking.customInstrument : newBooking.instrument;
    const timeSlot = newBooking.time === '__custom__' ? newBooking.customTime : newBooking.time;
    if (!instrumentName || !newBooking.date) return;

    // If custom instrument, add it to the list
    if (newBooking.instrument === '__custom__' && newBooking.customInstrument) {
      setInstruments(prev => [...prev, {
        id: Date.now(),
        name: newBooking.customInstrument,
        location: 'TBD',
        status: 'available',
      }]);
    }

    setBookings(prev => [...prev, {
      id: Date.now(),
      instrument: instrumentName,
      user: newBooking.user || 'Current User',
      date: newBooking.date,
      time: timeSlot || '09:00-10:00',
      status: 'pending',
      purpose: newBooking.purpose,
    }]);
    setNewBooking({ instrument: '', user: '', date: '', time: '', purpose: '', customInstrument: '', customTime: '' });
    setShowBookingModal(false);
    showToast('Booking created successfully!', 'success');
  };

  const handleCreateMaintenance = () => {
    const instrumentName = newMaintenance.instrument === '__custom__' ? newMaintenance.customInstrument : newMaintenance.instrument;
    const maintenanceType = newMaintenance.type === '__custom__' ? newMaintenance.customType : newMaintenance.type;
    if (!instrumentName || !maintenanceType) return;

    setMaintenanceLogs(prev => [...prev, {
      id: Date.now(),
      instrument: instrumentName,
      type: maintenanceType,
      date: newMaintenance.date || new Date().toISOString().slice(0, 10),
      status: 'scheduled',
      notes: newMaintenance.notes,
    }]);
    setAiSuggestions([]);
    setNewMaintenance({ instrument: '', type: '', date: '', notes: '', customInstrument: '', customType: '' });
    setShowMaintenanceModal(false);
    showToast('Maintenance logged successfully!', 'success');
  };

  // Delete Handlers
  const handleDelete = () => {
    if (!deleteConfirm) return;
    const itemName = deleteConfirm.name;

    switch (deleteConfirm.type) {
      case 'protocol':
        setProtocols(prev => prev.filter(p => p.id !== deleteConfirm.id));
        break;
      case 'sop':
        setSOPs(prev => prev.filter(s => s.id !== deleteConfirm.id));
        break;
      case 'instrument':
        setInstruments(prev => prev.filter(i => i.id !== deleteConfirm.id));
        break;
      case 'booking':
        setBookings(prev => prev.filter(b => b.id !== deleteConfirm.id));
        break;
      case 'maintenance':
        setMaintenanceLogs(prev => prev.filter(m => m.id !== deleteConfirm.id));
        break;
    }
    setDeleteConfirm(null);
    showToast(`${deleteConfirm.type.charAt(0).toUpperCase() + deleteConfirm.type.slice(1)} deleted successfully`, 'success');
  };

  // Bulk Selection Handlers
  const selectAllProtocols = () => setSelectedProtocols(new Set(protocols.map(p => p.id)));
  const selectNoneProtocols = () => setSelectedProtocols(new Set());
  const toggleProtocolSelection = (id: number) => {
    setSelectedProtocols(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAllSOPs = () => setSelectedSOPs(new Set(sops.map(s => s.id)));
  const selectNoneSOPs = () => setSelectedSOPs(new Set());
  const toggleSOPSelection = (id: number) => {
    setSelectedSOPs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAllInstruments = () => setSelectedInstruments(new Set(instruments.map(i => i.id)));
  const selectNoneInstruments = () => setSelectedInstruments(new Set());
  const toggleInstrumentSelection = (id: number) => {
    setSelectedInstruments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAllBookings = () => setSelectedBookings(new Set(bookings.map(b => b.id)));
  const selectNoneBookings = () => setSelectedBookings(new Set());
  const toggleBookingSelection = (id: number) => {
    setSelectedBookings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAllMaintenance = () => setSelectedMaintenance(new Set(maintenanceLogs.map(m => m.id)));
  const selectNoneMaintenance = () => setSelectedMaintenance(new Set());
  const toggleMaintenanceSelection = (id: number) => {
    setSelectedMaintenance(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Bulk Delete Handler
  const handleBulkDelete = () => {
    if (!bulkDeleteConfirm) return;

    switch (bulkDeleteConfirm.type) {
      case 'protocol':
        setProtocols(prev => prev.filter(p => !selectedProtocols.has(p.id)));
        setSelectedProtocols(new Set());
        break;
      case 'sop':
        setSOPs(prev => prev.filter(s => !selectedSOPs.has(s.id)));
        setSelectedSOPs(new Set());
        break;
      case 'instrument':
        setInstruments(prev => prev.filter(i => !selectedInstruments.has(i.id)));
        setSelectedInstruments(new Set());
        break;
      case 'booking':
        setBookings(prev => prev.filter(b => !selectedBookings.has(b.id)));
        setSelectedBookings(new Set());
        break;
      case 'maintenance':
        setMaintenanceLogs(prev => prev.filter(m => !selectedMaintenance.has(m.id)));
        setSelectedMaintenance(new Set());
        break;
    }
    showToast(`${bulkDeleteConfirm.count} item(s) deleted successfully`, 'success');
    setBulkDeleteConfirm(null);
  };

  // Bulk Status Change
  const bulkChangeStatus = (type: string, newStatus: string) => {
    switch (type) {
      case 'protocol':
        setProtocols(prev => prev.map(p =>
          selectedProtocols.has(p.id) ? { ...p, status: newStatus as Protocol['status'], lastUpdated: new Date().toISOString().slice(0, 10) } : p
        ));
        showToast(`${selectedProtocols.size} protocol(s) updated to ${newStatus}`, 'success');
        setSelectedProtocols(new Set());
        break;
      case 'booking':
        setBookings(prev => prev.map(b =>
          selectedBookings.has(b.id) ? { ...b, status: newStatus as Booking['status'] } : b
        ));
        showToast(`${selectedBookings.size} booking(s) updated to ${newStatus}`, 'success');
        setSelectedBookings(new Set());
        break;
      case 'maintenance':
        setMaintenanceLogs(prev => prev.map(m =>
          selectedMaintenance.has(m.id) ? { ...m, status: newStatus as Maintenance['status'] } : m
        ));
        showToast(`${selectedMaintenance.size} maintenance log(s) updated to ${newStatus}`, 'success');
        setSelectedMaintenance(new Set());
        break;
    }
  };

  // Duplicate/Clone Handler
  const duplicateProtocol = (protocol: Protocol) => {
    const newProtocol = {
      ...protocol,
      id: Date.now(),
      name: `${protocol.name} (Copy)`,
      status: 'draft' as const,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    setProtocols(prev => [...prev, newProtocol]);
    showToast('Protocol duplicated successfully', 'success');
  };

  const duplicateSOP = (sop: SOP) => {
    const newSOP = {
      ...sop,
      id: Date.now(),
      title: `${sop.title} (Copy)`,
    };
    setSOPs(prev => [...prev, newSOP]);
    showToast('SOP duplicated successfully', 'success');
  };

  // Export to CSV
  const exportToCSV = (type: string) => {
    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'protocols':
        csvContent = 'ID,Name,Category,Version,Status,Last Updated\n' +
          protocols.map(p => `${p.id},"${p.name}","${p.category || ''}",${p.version},${p.status},${p.lastUpdated}`).join('\n');
        filename = 'protocols.csv';
        break;
      case 'sops':
        csvContent = 'ID,Title,Category,Version\n' +
          sops.map(s => `${s.id},"${s.title}","${s.category}",${s.version}`).join('\n');
        filename = 'sops.csv';
        break;
      case 'instruments':
        csvContent = 'ID,Name,Type,Location,Status\n' +
          instruments.map(i => `${i.id},"${i.name}","${i.type || ''}","${i.location}",${i.status}`).join('\n');
        filename = 'instruments.csv';
        break;
      case 'bookings':
        csvContent = 'ID,Instrument,User,Date,Time,Status,Purpose\n' +
          bookings.map(b => `${b.id},"${b.instrument}","${b.user}",${b.date},${b.time},${b.status},"${b.purpose || ''}"`).join('\n');
        filename = 'bookings.csv';
        break;
      case 'maintenance':
        csvContent = 'ID,Instrument,Type,Date,Status,Notes\n' +
          maintenanceLogs.map(m => `${m.id},"${m.instrument}","${m.type}",${m.date},${m.status},"${m.notes || ''}"`).join('\n');
        filename = 'maintenance.csv';
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${type} to CSV`, 'success');
  };

  // Filter & Sort Functions
  const filterAndSortProtocols = () => {
    let filtered = protocols.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'version': comparison = a.version.localeCompare(b.version); break;
        case 'date': comparison = a.lastUpdated.localeCompare(b.lastUpdated); break;
        case 'status': comparison = a.status.localeCompare(b.status); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filterBookings = () => {
    return bookings.filter(b => {
      const matchesSearch = b.instrument.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.user.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesDate = !dateFilter || b.date === dateFilter;
      return matchesSearch && matchesStatus && matchesDate;
    });
  };

  const filterMaintenance = () => {
    return maintenanceLogs.filter(m => {
      const matchesSearch = m.instrument.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };

  // Update/Save Handlers
  const handleUpdateProtocol = (updatedProtocol: Protocol) => {
    setProtocols(prev => prev.map(p =>
      p.id === updatedProtocol.id
        ? { ...updatedProtocol, lastUpdated: new Date().toISOString().slice(0, 10) }
        : p
    ));
    setViewProtocol(null);
    setEditMode(false);
    showToast('Protocol saved successfully!', 'success');
  };

  const handleUpdateSOP = (updatedSOP: SOP) => {
    setSOPs(prev => prev.map(s => s.id === updatedSOP.id ? updatedSOP : s));
    setViewSOP(null);
    setEditMode(false);
    showToast('SOP saved successfully!', 'success');
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    draft: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' },
    archived: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    available: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    in_use: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    maintenance: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    confirmed: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    pending: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    completed: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    scheduled: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    overdue: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  };

  // Feature 7: mark protocol as used
  const markAsUsed = (protocolId: number) => {
    setUsageLogs(prev => ({ ...prev, [protocolId]: (prev[protocolId] || 0) + 1 }));
    showToast('Protocol marked as used!', 'success');
  };

  // Feature 1: import external protocol into local list
  const importLibProtocol = (ep: ExternalProtocol) => {
    const exists = protocols.find(p => p.name === ep.title);
    if (exists) { showToast('Protocol already in your library', 'error'); return; }
    setProtocols(prev => [...prev, {
      id: Date.now(),
      name: ep.title,
      version: '1.0',
      status: 'active',
      lastUpdated: new Date().toISOString().slice(0, 10),
      description: ep.description + '\n\nSteps:\n' + ep.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      category: ep.category,
    }]);
    showToast(`"${ep.title}" imported to My Protocols!`, 'success');
    setViewLibProtocol(null);
  };

  // Feature 4: quick instrument status cycle
  const cycleInstrumentStatus = (id: number) => {
    setInstruments(prev => prev.map(inst => {
      if (inst.id !== id) return inst;
      const next: Record<string, Instrument['status']> = { available: 'in_use', in_use: 'maintenance', maintenance: 'available' };
      return { ...inst, status: next[inst.status] };
    }));
  };

  const tabs = [
    { key: 'protocols', label: 'Protocols', icon: '📋', count: protocols.length },
    { key: 'sops', label: 'SOPs', icon: '📚', count: sops.length },
    { key: 'instruments', label: 'Instruments', icon: '🔬', count: instruments.length },
    { key: 'bookings', label: 'Bookings', icon: '📅', count: bookings.length },
    { key: 'maintenance', label: 'Maintenance', icon: '🔧', count: maintenanceLogs.filter(m => m.status !== 'completed').length },
    { key: 'library', label: 'Protocol Library', icon: '🌐', count: EXTERNAL_PROTOCOLS.length },
  ];

  const modalStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };

  const modalContentStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, padding: 28,
    width: 520, maxHeight: '85vh', overflow: 'auto',
    border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  };

  const inputGroupStyle: React.CSSProperties = { marginBottom: 16 };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-soft)' };

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          padding: '12px 20px',
          borderRadius: 8,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
          color: 'white',
          fontWeight: 500,
          fontSize: 14,
          zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          animation: 'slideIn 0.3s ease-out',
        }}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.message}
        </div>
      )}

      {/* Header with AI Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Lab Operations</h1>
            <span style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              AI-Powered
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage protocols, instruments, and lab resources with AI assistance</p>
        </div>
        <button
          onClick={() => setShowHelpGuide(true)}
          style={{
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(6,182,212,0.3)'
          }}
        >
          <span style={{ fontSize: 18 }}>?</span>
          How to Use
        </button>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active Protocols', value: protocols.filter(p => p.status === 'active').length, icon: '📋', color: '#22c55e' },
          { label: 'SOPs', value: sops.length, icon: '📚', color: '#6366f1' },
          { label: 'Available Instruments', value: instruments.filter(i => i.status === 'available').length, icon: '🔬', color: '#06b6d4' },
          { label: 'Pending Bookings', value: bookings.filter(b => b.status === 'pending').length, icon: '📅', color: '#f59e0b' },
          { label: 'Overdue Maintenance', value: maintenanceLogs.filter(m => m.status === 'overdue').length, icon: '⚠️', color: '#ef4444' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Feature 6: Maintenance Due Alert Banner */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10);
        const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const overdue = maintenanceLogs.filter(m => m.status === 'overdue');
        const upcoming = maintenanceLogs.filter(m => m.status === 'scheduled' && m.date <= soon && m.date >= today);
        if (overdue.length === 0 && upcoming.length === 0) return null;
        return (
          <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {overdue.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(239,68,68,0.12)', borderBottom: upcoming.length > 0 ? '1px solid rgba(239,68,68,0.2)' : 'none' }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ color: '#f87171', fontWeight: 600, fontSize: 13 }}>
                  {overdue.length} overdue maintenance{overdue.length > 1 ? 's' : ''}:
                </span>
                <span style={{ color: '#fca5a5', fontSize: 13 }}>{overdue.map(m => m.instrument).join(', ')}</span>
                <button onClick={() => setActiveTab('maintenance')} style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>View →</button>
              </div>
            )}
            {upcoming.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(234,179,8,0.1)' }}>
                <span style={{ fontSize: 16 }}>🔔</span>
                <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: 13 }}>
                  {upcoming.length} maintenance due within 7 days:
                </span>
                <span style={{ color: '#fde68a', fontSize: 13 }}>{upcoming.map(m => `${m.instrument} (${m.date})`).join(', ')}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* More Tools Quick Access */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { icon: '📓', label: 'Lab Notebook', page: 'lab-notebook', color: '#8b5cf6' },
          { icon: '🗺️', label: 'Storage Map', page: 'storage-map', color: '#06b6d4' },
          { icon: '⚗️', label: 'Equipment Hub', page: 'equipment', color: '#f59e0b' },
          { icon: '🧫', label: 'Experiments', page: 'experiments', color: '#22c55e' },
          { icon: '📄', label: 'Documents', page: 'documents', color: '#64748b' },
        ].map(tool => (
          <button key={tool.page} onClick={() => navigate(tool.page)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20,
            color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = tool.color; (e.currentTarget as HTMLButtonElement).style.color = tool.color; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            <span>{tool.icon}</span>
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: -1,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                background: activeTab === tab.key ? 'var(--accent)' : 'var(--surface2)',
                color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
                padding: '2px 8px', borderRadius: 10, fontSize: 11
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Protocols Tab */}
      {activeTab === 'protocols' && (
        <div>
          {/* Search, Filter & Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="🔍 Search protocols..."
                className="form-input"
                style={{ width: 200 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select
                className="form-select"
                style={{ width: 130 }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <select
                className="form-select"
                style={{ width: 150 }}
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {PROTOCOL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                className="form-select"
                style={{ width: 120 }}
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="name">Sort: Name</option>
                <option value="date">Sort: Date</option>
                <option value="status">Sort: Status</option>
                <option value="version">Sort: Version</option>
              </select>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => exportToCSV('protocols')} title="Export to CSV">
                📥 Export
              </button>
              <button className="btn btn-primary" onClick={() => setShowProtocolModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✨</span> New Protocol
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-sm"
                onClick={selectAllProtocols}
                style={{ background: '#6366f1', color: 'white', border: 'none', fontWeight: 500 }}
              >
                Select All
              </button>
              <button
                className="btn btn-sm"
                onClick={selectNoneProtocols}
                style={{ background: 'white', color: '#6366f1', border: '1px solid #6366f1', fontWeight: 500 }}
              >
                Clear Selection
              </button>
              <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, padding: '4px 12px', background: 'white', borderRadius: 20 }}>
                {selectedProtocols.size} of {filterAndSortProtocols().length} selected
              </span>
            </div>
            {selectedProtocols.size > 0 && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  className="form-select"
                  style={{
                    width: 180,
                    height: 38,
                    fontSize: 14,
                    fontWeight: 500,
                    background: 'white',
                    border: '2px solid #6366f1',
                    borderRadius: 8,
                    cursor: 'pointer',
                    padding: '0 12px',
                    color: '#374151'
                  }}
                  onChange={e => { if (e.target.value) { bulkChangeStatus('protocol', e.target.value); e.target.value = ''; }}}
                  defaultValue=""
                >
                  <option value="" disabled>Change Status</option>
                  <option value="active">Set Active</option>
                  <option value="draft">Set Draft</option>
                  <option value="archived">Set Archived</option>
                </select>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    fontWeight: 500,
                    padding: '8px 16px',
                    borderRadius: 8
                  }}
                  onClick={() => setBulkDeleteConfirm({ type: 'protocol', count: selectedProtocols.size })}
                >
                  Delete Selected ({selectedProtocols.size})
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={{ padding: 12, width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedProtocols.size === filterAndSortProtocols().length && filterAndSortProtocols().length > 0}
                      onChange={e => e.target.checked ? selectAllProtocols() : selectNoneProtocols()}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Protocol Name</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Category</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Version</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Last Updated</th>
                  <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filterAndSortProtocols().map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)', background: selectedProtocols.has(p.id) ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                    <td style={{ padding: 12 }}>
                      <input
                        type="checkbox"
                        checked={selectedProtocols.has(p.id)}
                        onChange={() => toggleProtocolSelection(p.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: 12, fontSize: 14, fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>{p.category || 'General'}</td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>v{p.version}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: statusColors[p.status].bg, color: statusColors[p.status].text }}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{new Date(p.lastUpdated).toLocaleDateString()}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      {/* Feature 7: usage count badge */}
                      {(usageLogs[p.id] || 0) > 0 && (
                        <span style={{ marginRight: 6, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: 11, fontWeight: 600 }}>
                          ✓ used {usageLogs[p.id]}×
                        </span>
                      )}
                      <button className="btn btn-sm btn-secondary" style={{ marginRight: 4 }} onClick={() => { setViewProtocol(p); setEditMode(false); }} title="View">👁️</button>
                      <button className="btn btn-sm btn-secondary" style={{ marginRight: 4 }} onClick={() => { setViewProtocol(p); setEditMode(true); }} title="Edit">✏️</button>
                      <button className="btn btn-sm" style={{ marginRight: 4, background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: 'none' }} onClick={() => { setExecutingProtocol(p); setViewProtocol(null); }} title="Execute">▶ Run</button>
                      <button className="btn btn-sm" style={{ marginRight: 4, background: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'none' }} onClick={() => markAsUsed(p.id)} title="Mark as used today">✓ Used</button>
                      <button className="btn btn-sm btn-secondary" style={{ marginRight: 4 }} onClick={() => duplicateProtocol(p)} title="Duplicate">📋</button>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'none' }}
                        onClick={() => setDeleteConfirm({ type: 'protocol', id: p.id, name: p.name })}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {filterAndSortProtocols().length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No protocols found matching your criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SOPs Tab */}
      {activeTab === 'sops' && (
        <div>
          {/* Search & Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="🔍 Search SOPs..."
                className="form-input"
                style={{ width: 200 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select className="form-select" style={{ width: 150 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                <option value="Safety">Safety</option>
                <option value="Quality">Quality</option>
                <option value="Operations">Operations</option>
                <option value="Equipment">Equipment</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => exportToCSV('sops')}>📥 Export</button>
              <button className="btn btn-primary" onClick={() => setShowSOPModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✨</span> New SOP
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-sm"
                onClick={selectAllSOPs}
                style={{ background: '#6366f1', color: 'white', border: 'none', fontWeight: 500 }}
              >
                Select All
              </button>
              <button
                className="btn btn-sm"
                onClick={selectNoneSOPs}
                style={{ background: 'white', color: '#6366f1', border: '1px solid #6366f1', fontWeight: 500 }}
              >
                Clear Selection
              </button>
              <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, padding: '4px 12px', background: 'white', borderRadius: 20 }}>
                {selectedSOPs.size} of {sops.length} selected
              </span>
            </div>
            {selectedSOPs.size > 0 && (
              <button
                className="btn btn-sm"
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  fontWeight: 500,
                  padding: '8px 16px',
                  borderRadius: 8
                }}
                onClick={() => setBulkDeleteConfirm({ type: 'sop', count: selectedSOPs.size })}
              >
                Delete Selected ({selectedSOPs.size})
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {sops
              .filter(s => {
                const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
                return matchesSearch && matchesCategory;
              })
              .map(sop => (
              <div
                key={sop.id}
                className="card"
                style={{
                  position: 'relative',
                  border: selectedSOPs.has(sop.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedSOPs.has(sop.id) ? 'rgba(99,102,241,0.05)' : 'var(--surface)',
                }}
              >
                {/* Selection Checkbox */}
                <div style={{ position: 'absolute', top: 12, left: 12 }}>
                  <input
                    type="checkbox"
                    checked={selectedSOPs.has(sop.id)}
                    onChange={() => toggleSOPSelection(sop.id)}
                    style={{ cursor: 'pointer', width: 18, height: 18 }}
                  />
                </div>
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                  background: sop.category === 'Safety' ? 'rgba(239,68,68,0.15)' : sop.category === 'Quality' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                  color: sop.category === 'Safety' ? '#f87171' : sop.category === 'Quality' ? '#60a5fa' : '#4ade80',
                }}>
                  {sop.category}
                </div>
                <div style={{ fontSize: 32, marginBottom: 12, marginLeft: 28 }}>📚</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, paddingRight: 70, paddingLeft: 28 }}>{sop.title}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, paddingLeft: 28 }}>Version {sop.version}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => { setViewSOP(sop); setEditMode(false); }}>👁️ View</button>
                  <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => { setViewSOP(sop); setEditMode(true); }}>✏️ Edit</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => duplicateSOP(sop)} title="Duplicate">📋</button>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'none', padding: '4px 8px' }}
                    onClick={() => setDeleteConfirm({ type: 'sop', id: sop.id, name: sop.title })}
                    title="Delete SOP"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instruments Tab */}
      {activeTab === 'instruments' && (
        <div>
          {/* Stats & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Search instruments..."
                className="form-input"
                style={{ width: 200 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="in_use">In Use</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Available', value: instruments.filter(i => i.status === 'available').length, color: '#4ade80' },
                { label: 'In Use', value: instruments.filter(i => i.status === 'in_use').length, color: '#60a5fa' },
                { label: 'Maintenance', value: instruments.filter(i => i.status === 'maintenance').length, color: '#fbbf24' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'var(--surface2)', borderRadius: 8, padding: '8px 16px',
                  display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => exportToCSV('instruments')}>📥 Export</button>
              <button className="btn btn-primary" onClick={() => setShowInstrumentModal(true)}>+ Add Instrument</button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-sm"
                onClick={selectAllInstruments}
                style={{ background: '#6366f1', color: 'white', border: 'none', fontWeight: 500 }}
              >
                Select All
              </button>
              <button
                className="btn btn-sm"
                onClick={selectNoneInstruments}
                style={{ background: 'white', color: '#6366f1', border: '1px solid #6366f1', fontWeight: 500 }}
              >
                Clear Selection
              </button>
              <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, padding: '4px 12px', background: 'white', borderRadius: 20 }}>
                {selectedInstruments.size} of {instruments.length} selected
              </span>
            </div>
            {selectedInstruments.size > 0 && (
              <button
                className="btn btn-sm"
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  fontWeight: 500,
                  padding: '8px 16px',
                  borderRadius: 8
                }}
                onClick={() => setBulkDeleteConfirm({ type: 'instrument', count: selectedInstruments.size })}
              >
                Delete Selected ({selectedInstruments.size})
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {instruments
              .filter(i => {
                const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (i.type || '').toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
                return matchesSearch && matchesStatus;
              })
              .map(inst => (
              <div
                key={inst.id}
                className="card"
                style={{
                  border: selectedInstruments.has(inst.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedInstruments.has(inst.id) ? 'rgba(99,102,241,0.05)' : 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedInstruments.has(inst.id)}
                      onChange={() => toggleInstrumentSelection(inst.id)}
                      style={{ cursor: 'pointer', marginTop: 4 }}
                    />
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{inst.name}</h3>
                      {inst.type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inst.type}</div>}
                    </div>
                  </div>
                  {/* Feature 4: quick status toggle */}
                  <button
                    onClick={() => cycleInstrumentStatus(inst.id)}
                    title="Click to change status"
                    style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: statusColors[inst.status].bg, color: statusColors[inst.status].text, border: 'none', cursor: 'pointer' }}
                  >
                    {inst.status === 'available' ? '✓ Available' : inst.status === 'in_use' ? '⏳ In Use' : '🔧 Maintenance'}
                  </button>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, marginLeft: 26 }}>📍 {inst.location}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ flex: 1 }}
                    disabled={inst.status !== 'available'}
                    onClick={() => {
                      if (inst.status === 'available') {
                        setNewBooking({ ...newBooking, instrument: inst.name });
                        setShowBookingModal(true);
                      }
                    }}
                  >
                    {inst.status === 'available' ? '📅 Book Now' : inst.status === 'in_use' ? 'In Use' : '🔧 Maintenance'}
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'none' }}
                    onClick={() => setDeleteConfirm({ type: 'instrument', id: inst.id, name: inst.name })}
                    title="Delete Instrument"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div>
          {/* Search & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="🔍 Search bookings..."
                className="form-input"
                style={{ width: 200 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <input
                type="date"
                className="form-input"
                style={{ width: 150 }}
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
              />
              <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Feature 5: calendar/list toggle */}
              <button
                className="btn btn-secondary"
                onClick={() => setBookingView(bookingView === 'list' ? 'calendar' : 'list')}
                style={{ fontWeight: 600 }}
              >
                {bookingView === 'list' ? '📅 Calendar View' : '☰ List View'}
              </button>
              <button className="btn btn-secondary" onClick={() => exportToCSV('bookings')}>📥 Export</button>
              <button className="btn btn-primary" onClick={() => setShowBookingModal(true)}>+ New Booking</button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-sm"
                onClick={selectAllBookings}
                style={{ background: '#6366f1', color: 'white', border: 'none', fontWeight: 500 }}
              >
                Select All
              </button>
              <button
                className="btn btn-sm"
                onClick={selectNoneBookings}
                style={{ background: 'white', color: '#6366f1', border: '1px solid #6366f1', fontWeight: 500 }}
              >
                Clear Selection
              </button>
              <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, padding: '4px 12px', background: 'white', borderRadius: 20 }}>
                {selectedBookings.size} of {filterBookings().length} selected
              </span>
            </div>
            {selectedBookings.size > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => bulkChangeStatus('booking', 'confirmed')}
                  style={{ background: '#22c55e', color: 'white', border: 'none', fontWeight: 500, padding: '8px 16px', borderRadius: 8 }}
                >
                  Confirm Selected
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    fontWeight: 500,
                    padding: '8px 16px',
                    borderRadius: 8
                  }}
                  onClick={() => setBulkDeleteConfirm({ type: 'booking', count: selectedBookings.size })}
                >
                  Cancel Selected ({selectedBookings.size})
                </button>
              </div>
            )}
          </div>

          {/* Feature 5: 7-day calendar view */}
          {bookingView === 'calendar' && (() => {
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(calendarWeekStart);
              d.setDate(d.getDate() + i);
              return d;
            });
            const fmt = (d: Date) => d.toISOString().slice(0, 10);
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => { const d = new Date(calendarWeekStart); d.setDate(d.getDate() - 7); setCalendarWeekStart(d); }}>← Prev Week</button>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <button className="btn btn-sm btn-secondary" onClick={() => { const d = new Date(calendarWeekStart); d.setDate(d.getDate() + 7); setCalendarWeekStart(d); }}>Next Week →</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {days.map(day => {
                    const dayStr = fmt(day);
                    const dayBookings = bookings.filter(b => b.date === dayStr);
                    const isToday = dayStr === fmt(new Date());
                    return (
                      <div key={dayStr} style={{ background: isToday ? 'rgba(99,102,241,0.1)' : 'var(--surface)', border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 10, padding: 10, minHeight: 100 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 6 }}>
                          {day.toLocaleDateString(undefined, { weekday: 'short' })} {day.getDate()}
                        </div>
                        {dayBookings.length === 0 ? (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Free</div>
                        ) : dayBookings.map(b => (
                          <div key={b.id} style={{ background: b.status === 'confirmed' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)', border: `1px solid ${b.status === 'confirmed' ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`, borderRadius: 6, padding: '4px 6px', marginBottom: 4 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{b.instrument}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{b.time}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filterBookings().map(b => (
              <div
                key={b.id}
                className="card"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  border: selectedBookings.has(b.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedBookings.has(b.id) ? 'rgba(99,102,241,0.05)' : 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <input
                    type="checkbox"
                    checked={selectedBookings.has(b.id)}
                    onChange={() => toggleBookingSelection(b.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    🔬
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{b.instrument}</h4>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.user} • {new Date(b.date).toLocaleDateString()} • {b.time}</div>
                    {b.purpose && <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>Purpose: {b.purpose}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: statusColors[b.status].bg, color: statusColors[b.status].text }}>
                    {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </span>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setBookings(prev => prev.map(booking =>
                        booking.id === b.id
                          ? { ...booking, status: booking.status === 'pending' ? 'confirmed' : 'pending' }
                          : booking
                      ));
                    }}
                  >
                    {b.status === 'pending' ? '✓ Confirm' : '↩ Pending'}
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'none' }}
                    onClick={() => setDeleteConfirm({ type: 'booking', id: b.id, name: `${b.instrument} - ${b.date}` })}
                    title="Cancel Booking"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
            {filterBookings().length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No bookings found matching your criteria
              </div>
            )}
          </div>
        </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <div>
          {/* Search & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="🔍 Search maintenance..."
                className="form-input"
                style={{ width: 200 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => exportToCSV('maintenance')}>📥 Export</button>
              <button className="btn btn-primary" onClick={() => setShowMaintenanceModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔧</span> Log Maintenance
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="btn btn-sm"
                onClick={selectAllMaintenance}
                style={{ background: '#6366f1', color: 'white', border: 'none', fontWeight: 500 }}
              >
                Select All
              </button>
              <button
                className="btn btn-sm"
                onClick={selectNoneMaintenance}
                style={{ background: 'white', color: '#6366f1', border: '1px solid #6366f1', fontWeight: 500 }}
              >
                Clear Selection
              </button>
              <span style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, padding: '4px 12px', background: 'white', borderRadius: 20 }}>
                {selectedMaintenance.size} of {filterMaintenance().length} selected
              </span>
            </div>
            {selectedMaintenance.size > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => bulkChangeStatus('maintenance', 'completed')}
                  style={{ background: '#22c55e', color: 'white', border: 'none', fontWeight: 500, padding: '8px 16px', borderRadius: 8 }}
                >
                  Complete Selected
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    fontWeight: 500,
                    padding: '8px 16px',
                    borderRadius: 8
                  }}
                  onClick={() => setBulkDeleteConfirm({ type: 'maintenance', count: selectedMaintenance.size })}
                >
                  Delete Selected ({selectedMaintenance.size})
                </button>
              </div>
            )}
          </div>

          {/* Overdue Alert */}
          {maintenanceLogs.filter(m => m.status === 'overdue').length > 0 && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12
            }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <span style={{ color: '#ef4444', fontWeight: 500 }}>
                {maintenanceLogs.filter(m => m.status === 'overdue').length} maintenance task(s) are overdue and require immediate attention
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filterMaintenance().map(m => (
              <div
                key={m.id}
                className="card"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: m.status === 'overdue' ? '4px solid #ef4444' : selectedMaintenance.has(m.id) ? '4px solid var(--accent)' : '4px solid var(--border)',
                  background: selectedMaintenance.has(m.id) ? 'rgba(99,102,241,0.05)' : 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <input
                    type="checkbox"
                    checked={selectedMaintenance.has(m.id)}
                    onChange={() => toggleMaintenanceSelection(m.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div style={{
                    width: 48, height: 48, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    background: m.status === 'overdue' ? 'rgba(239,68,68,0.15)' : m.status === 'completed' ? 'rgba(34,197,94,0.15)' : 'var(--surface2)',
                  }}>
                    {m.status === 'completed' ? '✅' : m.status === 'overdue' ? '⚠️' : '🔧'}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{m.instrument}</h4>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.type} • {new Date(m.date).toLocaleDateString()}</div>
                    {m.notes && <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>{m.notes}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: statusColors[m.status].bg, color: statusColors[m.status].text }}>
                    {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                  </span>
                  {m.status !== 'completed' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setMaintenanceLogs(prev => prev.map(log =>
                          log.id === m.id ? { ...log, status: 'completed' } : log
                        ));
                        showToast('Maintenance marked as completed', 'success');
                      }}
                    >
                      ✓ Complete
                    </button>
                  )}
                  <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: 'none' }}
                    onClick={() => setDeleteConfirm({ type: 'maintenance', id: m.id, name: `${m.instrument} - ${m.type}` })}
                    title="Delete Maintenance Log"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
            {filterMaintenance().length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No maintenance logs found matching your criteria
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature 1+2+3: External Protocol Library Tab */}
      {activeTab === 'library' && (() => {
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

      {/* Protocol Modal - Enhanced with AI */}
      {showProtocolModal && (
        <div style={modalStyle} onClick={() => setShowProtocolModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Create New Protocol</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Use AI to generate protocol content or create manually</p>
              </div>
              <button onClick={() => setShowProtocolModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            {/* Toggle: Template or Manual */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                className={`btn ${newProtocol.useTemplate ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setNewProtocol({ ...newProtocol, useTemplate: true })}
                style={{ flex: 1 }}
              >
                📋 Use Template
              </button>
              <button
                className={`btn ${!newProtocol.useTemplate ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setNewProtocol({ ...newProtocol, useTemplate: false, name: '' })}
                style={{ flex: 1 }}
              >
                ✏️ Create Manually
              </button>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Protocol Name *</label>
              {newProtocol.useTemplate ? (
                <select
                  className="form-select"
                  value={newProtocol.name}
                  onChange={e => {
                    const template = PROTOCOL_TEMPLATES.find(t => t.name === e.target.value);
                    setNewProtocol({
                      ...newProtocol,
                      name: e.target.value,
                      category: template?.category || '',
                      description: template?.description || '',
                    });
                  }}
                >
                  <option value="">Select a protocol template...</option>
                  {PROTOCOL_TEMPLATES.map(t => (
                    <option key={t.name} value={t.name}>{t.name} ({t.category})</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter custom protocol name..."
                  value={newProtocol.name}
                  onChange={e => setNewProtocol({ ...newProtocol, name: e.target.value })}
                />
              )}
            </div>

            {!newProtocol.useTemplate && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Category</label>
                <select
                  className="form-select"
                  value={newProtocol.category}
                  onChange={e => setNewProtocol({ ...newProtocol, category: e.target.value })}
                >
                  <option value="">Select category...</option>
                  {PROTOCOL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__custom__">+ Add Custom Category</option>
                </select>
              </div>
            )}

            {!newProtocol.useTemplate && newProtocol.category === '__custom__' && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Custom Category *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Neuroscience, Virology..."
                  value={newProtocol.customCategory}
                  onChange={e => setNewProtocol({ ...newProtocol, customCategory: e.target.value })}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Version</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="1.0"
                  value={newProtocol.version}
                  onChange={e => setNewProtocol({ ...newProtocol, version: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  className="form-select"
                  value={newProtocol.status}
                  onChange={e => setNewProtocol({ ...newProtocol, status: e.target.value as 'draft' | 'active' })}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>

            <div style={inputGroupStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Description</label>
                <button
                  className="btn btn-sm"
                  onClick={() => generateAIProtocol(newProtocol.name)}
                  disabled={!newProtocol.name || aiGenerating}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    border: 'none',
                    fontSize: 11,
                    padding: '4px 10px',
                  }}
                >
                  {aiGenerating ? '⏳ Generating...' : '✨ AI Generate'}
                </button>
              </div>
              <textarea
                className="form-input"
                placeholder="Protocol description and procedures..."
                rows={6}
                value={newProtocol.description}
                onChange={e => setNewProtocol({ ...newProtocol, description: e.target.value })}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowProtocolModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateProtocol} disabled={!newProtocol.name} style={{ flex: 1 }}>
                Create Protocol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOP Modal - Enhanced with AI */}
      {showSOPModal && (
        <div style={modalStyle} onClick={() => setShowSOPModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Create New SOP</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Standard Operating Procedure with AI assistance</p>
              </div>
              <button onClick={() => setShowSOPModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            {/* Toggle: Template or Manual */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                className={`btn ${newSOP.useTemplate ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setNewSOP({ ...newSOP, useTemplate: true })}
                style={{ flex: 1 }}
              >
                📚 Use Template
              </button>
              <button
                className={`btn ${!newSOP.useTemplate ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setNewSOP({ ...newSOP, useTemplate: false, title: '' })}
                style={{ flex: 1 }}
              >
                ✏️ Create Manually
              </button>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>SOP Title *</label>
              {newSOP.useTemplate ? (
                <select
                  className="form-select"
                  value={newSOP.title}
                  onChange={e => {
                    const template = SOP_TEMPLATES.find(t => t.title === e.target.value);
                    setNewSOP({
                      ...newSOP,
                      title: e.target.value,
                      category: template?.category || 'Safety',
                      description: template?.description || '',
                    });
                  }}
                >
                  <option value="">Select an SOP template...</option>
                  {SOP_TEMPLATES.map(t => (
                    <option key={t.title} value={t.title}>{t.title} ({t.category})</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter custom SOP title..."
                  value={newSOP.title}
                  onChange={e => setNewSOP({ ...newSOP, title: e.target.value })}
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  className="form-select"
                  value={newSOP.category}
                  onChange={e => setNewSOP({ ...newSOP, category: e.target.value })}
                >
                  <option value="Safety">Safety</option>
                  <option value="Quality">Quality</option>
                  <option value="Operations">Operations</option>
                  <option value="Equipment">Equipment</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Version</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="1.0"
                  value={newSOP.version}
                  onChange={e => setNewSOP({ ...newSOP, version: e.target.value })}
                />
              </div>
            </div>

            <div style={inputGroupStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, margin: 0 }}>Description</label>
                <button
                  className="btn btn-sm"
                  onClick={() => generateAISOP(newSOP.title)}
                  disabled={!newSOP.title || aiGenerating}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    border: 'none',
                    fontSize: 11,
                    padding: '4px 10px',
                  }}
                >
                  {aiGenerating ? '⏳ Generating...' : '✨ AI Generate'}
                </button>
              </div>
              <textarea
                className="form-input"
                placeholder="SOP description and procedures..."
                rows={6}
                value={newSOP.description}
                onChange={e => setNewSOP({ ...newSOP, description: e.target.value })}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowSOPModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateSOP} disabled={!newSOP.title} style={{ flex: 1 }}>
                Create SOP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Instrument Modal */}
      {showInstrumentModal && (
        <div style={modalStyle} onClick={() => setShowInstrumentModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>Add New Instrument</h3>
              <button onClick={() => setShowInstrumentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Instrument Type</label>
              <select
                className="form-select"
                value={newInstrument.type}
                onChange={e => setNewInstrument({ ...newInstrument, type: e.target.value })}
              >
                <option value="">Select type...</option>
                {INSTRUMENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="__custom__">+ Add Custom Type</option>
              </select>
            </div>

            {newInstrument.type === '__custom__' && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Custom Instrument Type *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Cryostat, Microinjector..."
                  value={newInstrument.customType}
                  onChange={e => setNewInstrument({ ...newInstrument, customType: e.target.value })}
                />
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Instrument Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Centrifuge XR-500"
                value={newInstrument.name}
                onChange={e => setNewInstrument({ ...newInstrument, name: e.target.value })}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Location</label>
              <select
                className="form-select"
                value={newInstrument.location}
                onChange={e => setNewInstrument({ ...newInstrument, location: e.target.value })}
              >
                <option value="">Select location...</option>
                {LAB_LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
                <option value="__custom__">+ Add Custom Location</option>
              </select>
            </div>

            {newInstrument.location === '__custom__' && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Custom Location *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Building B, Room 305"
                  value={newInstrument.customLocation}
                  onChange={e => setNewInstrument({ ...newInstrument, customLocation: e.target.value })}
                />
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Initial Status</label>
              <select
                className="form-select"
                value={newInstrument.status}
                onChange={e => setNewInstrument({ ...newInstrument, status: e.target.value as 'available' | 'maintenance' })}
              >
                <option value="available">Available</option>
                <option value="in_use">In Use</option>
                <option value="maintenance">Under Maintenance</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowInstrumentModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateInstrument} disabled={!newInstrument.name} style={{ flex: 1 }}>
                Add Instrument
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal - Enhanced with dropdown + custom */}
      {showBookingModal && (
        <div style={modalStyle} onClick={() => setShowBookingModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>New Booking</h3>
              <button onClick={() => setShowBookingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Instrument *</label>
              <select
                className="form-select"
                value={newBooking.instrument}
                onChange={e => setNewBooking({ ...newBooking, instrument: e.target.value })}
              >
                <option value="">Select instrument...</option>
                {instruments.map(i => (
                  <option key={i.id} value={i.name} disabled={i.status !== 'available'}>
                    {i.name} {i.status !== 'available' ? `(${i.status})` : ''}
                  </option>
                ))}
                <option value="__custom__">+ Add New Instrument</option>
              </select>
            </div>

            {newBooking.instrument === '__custom__' && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>New Instrument Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter instrument name..."
                  value={newBooking.customInstrument}
                  onChange={e => setNewBooking({ ...newBooking, customInstrument: e.target.value })}
                />
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Your Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your name"
                value={newBooking.user}
                onChange={e => setNewBooking({ ...newBooking, user: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={newBooking.date}
                  onChange={e => setNewBooking({ ...newBooking, date: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Time Slot</label>
                <select
                  className="form-select"
                  value={newBooking.time}
                  onChange={e => setNewBooking({ ...newBooking, time: e.target.value })}
                >
                  <option value="">Select time...</option>
                  <optgroup label="1-Hour Slots">
                    <option value="06:00-07:00">06:00 - 07:00</option>
                    <option value="07:00-08:00">07:00 - 08:00</option>
                    <option value="08:00-09:00">08:00 - 09:00</option>
                    <option value="09:00-10:00">09:00 - 10:00</option>
                    <option value="10:00-11:00">10:00 - 11:00</option>
                    <option value="11:00-12:00">11:00 - 12:00</option>
                    <option value="12:00-13:00">12:00 - 13:00</option>
                    <option value="13:00-14:00">13:00 - 14:00</option>
                    <option value="14:00-15:00">14:00 - 15:00</option>
                    <option value="15:00-16:00">15:00 - 16:00</option>
                    <option value="16:00-17:00">16:00 - 17:00</option>
                    <option value="17:00-18:00">17:00 - 18:00</option>
                    <option value="18:00-19:00">18:00 - 19:00</option>
                    <option value="19:00-20:00">19:00 - 20:00</option>
                    <option value="20:00-21:00">20:00 - 21:00</option>
                    <option value="21:00-22:00">21:00 - 22:00</option>
                  </optgroup>
                  <optgroup label="2-Hour Slots">
                    <option value="08:00-10:00">08:00 - 10:00</option>
                    <option value="09:00-11:00">09:00 - 11:00</option>
                    <option value="10:00-12:00">10:00 - 12:00</option>
                    <option value="13:00-15:00">13:00 - 15:00</option>
                    <option value="14:00-16:00">14:00 - 16:00</option>
                    <option value="15:00-17:00">15:00 - 17:00</option>
                    <option value="16:00-18:00">16:00 - 18:00</option>
                  </optgroup>
                  <optgroup label="Half Day">
                    <option value="08:00-12:00">Morning (08:00 - 12:00)</option>
                    <option value="13:00-17:00">Afternoon (13:00 - 17:00)</option>
                    <option value="17:00-22:00">Evening (17:00 - 22:00)</option>
                  </optgroup>
                  <optgroup label="Full Day">
                    <option value="08:00-17:00">Business Hours (08:00 - 17:00)</option>
                    <option value="09:00-18:00">Standard Day (09:00 - 18:00)</option>
                    <option value="08:00-22:00">Extended Day (08:00 - 22:00)</option>
                    <option value="00:00-23:59">24 Hours</option>
                  </optgroup>
                  <option value="__custom__">+ Custom Time Slot</option>
                </select>
              </div>
            </div>

            {newBooking.time === '__custom__' && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Custom Time Slot *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., 10:30-14:45"
                  value={newBooking.customTime}
                  onChange={e => setNewBooking({ ...newBooking, customTime: e.target.value })}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Format: HH:MM-HH:MM (e.g., 09:30-11:45)
                </div>
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Purpose</label>
              <input
                type="text"
                className="form-input"
                placeholder="Brief description of your experiment"
                value={newBooking.purpose}
                onChange={e => setNewBooking({ ...newBooking, purpose: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowBookingModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateBooking}
                disabled={!(newBooking.instrument && newBooking.date) && !(newBooking.instrument === '__custom__' && newBooking.customInstrument && newBooking.date)}
                style={{ flex: 1 }}
              >
                Create Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modal - Enhanced with AI suggestions */}
      {showMaintenanceModal && (
        <div style={modalStyle} onClick={() => setShowMaintenanceModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Log Maintenance</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Record maintenance activities for instruments</p>
              </div>
              <button onClick={() => setShowMaintenanceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Instrument *</label>
              <select
                className="form-select"
                value={newMaintenance.instrument}
                onChange={e => {
                  setNewMaintenance({ ...newMaintenance, instrument: e.target.value });
                  if (e.target.value && e.target.value !== '__custom__') {
                    getAIMaintenanceSuggestions(e.target.value);
                  } else {
                    setAiSuggestions([]);
                  }
                }}
              >
                <option value="">Select instrument...</option>
                {instruments.map(i => (
                  <option key={i.id} value={i.name}>{i.name}</option>
                ))}
                <option value="__custom__">+ Add New Instrument</option>
              </select>
            </div>

            {newMaintenance.instrument === '__custom__' && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>New Instrument Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter instrument name..."
                  value={newMaintenance.customInstrument}
                  onChange={e => setNewMaintenance({ ...newMaintenance, customInstrument: e.target.value })}
                />
              </div>
            )}

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div style={{
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 8, padding: 12, marginBottom: 16
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ✨ AI Suggestions
                </div>
                {aiSuggestions.map((suggestion, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>• {suggestion}</div>
                ))}
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Maintenance Type *</label>
              <select
                className="form-select"
                value={newMaintenance.type}
                onChange={e => setNewMaintenance({ ...newMaintenance, type: e.target.value })}
              >
                <option value="">Select type...</option>
                {MAINTENANCE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="__custom__">+ Add Custom Type</option>
              </select>
            </div>

            {newMaintenance.type === '__custom__' && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Custom Maintenance Type *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter maintenance type..."
                  value={newMaintenance.customType}
                  onChange={e => setNewMaintenance({ ...newMaintenance, customType: e.target.value })}
                />
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Scheduled Date</label>
              <input
                type="date"
                className="form-input"
                value={newMaintenance.date}
                onChange={e => setNewMaintenance({ ...newMaintenance, date: e.target.value })}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Notes</label>
              <textarea
                className="form-input"
                placeholder="Additional notes or observations..."
                rows={3}
                value={newMaintenance.notes}
                onChange={e => setNewMaintenance({ ...newMaintenance, notes: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowMaintenanceModal(false); setAiSuggestions([]); }} style={{ flex: 1 }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateMaintenance}
                disabled={
                  !(newMaintenance.instrument && newMaintenance.type) &&
                  !(newMaintenance.instrument === '__custom__' && newMaintenance.customInstrument && newMaintenance.type) &&
                  !(newMaintenance.instrument && newMaintenance.type === '__custom__' && newMaintenance.customType)
                }
                style={{ flex: 1 }}
              >
                Log Maintenance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View/Edit Protocol Modal */}
      {viewProtocol && (
        <div style={modalStyle} onClick={() => { setViewProtocol(null); setEditMode(false); }}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>📋</span>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
                    {editMode ? 'Edit Protocol' : 'Protocol Details'}
                  </h3>
                  <span style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                    background: statusColors[viewProtocol.status].bg,
                    color: statusColors[viewProtocol.status].text
                  }}>
                    {viewProtocol.status.charAt(0).toUpperCase() + viewProtocol.status.slice(1)}
                  </span>
                </div>
              </div>
              <button onClick={() => { setViewProtocol(null); setEditMode(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            {editMode ? (
              <>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Protocol Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={viewProtocol.name}
                    onChange={e => setViewProtocol({ ...viewProtocol, name: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Version</label>
                    <input
                      type="text"
                      className="form-input"
                      value={viewProtocol.version}
                      onChange={e => setViewProtocol({ ...viewProtocol, version: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <input
                      type="text"
                      className="form-input"
                      value={viewProtocol.category || ''}
                      onChange={e => setViewProtocol({ ...viewProtocol, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select
                      className="form-select"
                      value={viewProtocol.status}
                      onChange={e => setViewProtocol({ ...viewProtocol, status: e.target.value as 'active' | 'draft' | 'archived' })}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    className="form-input"
                    rows={8}
                    value={viewProtocol.description || ''}
                    onChange={e => setViewProtocol({ ...viewProtocol, description: e.target.value })}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button className="btn btn-secondary" onClick={() => { setViewProtocol(null); setEditMode(false); }} style={{ flex: 1 }}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleUpdateProtocol(viewProtocol)}
                    style={{ flex: 1 }}
                  >
                    💾 Save Changes
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{viewProtocol.name}</h2>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
                    <span>📁 {viewProtocol.category || 'General'}</span>
                    <span>📌 Version {viewProtocol.version}</span>
                    <span>📅 Updated {new Date(viewProtocol.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-soft)' }}>Description</h4>
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                    fontSize: 14,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 300,
                    overflow: 'auto',
                  }}>
                    {viewProtocol.description || 'No description available. Click Edit to add one.'}
                  </div>
                </div>

                {/* Version History */}
                <div style={{ marginBottom: 16 }}>
                  <button
                    onClick={() => setShowVersionHistory(v => !v)}
                    style={{ all: 'unset', cursor: 'pointer', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}
                  >
                    {showVersionHistory ? '▲ Hide' : '▼ Show'} Version History ({protocolVersions.length} versions)
                  </button>
                  {showVersionHistory && (
                    <div style={{ marginTop: 10 }}>
                      {protocolVersions.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No saved versions yet. Save a version snapshot below.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                          {protocolVersions.map((v: any) => (
                            <div key={v.id} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid var(--accent)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>v{v.version}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(v.created_at).toLocaleDateString()} by {v.created_by}</span>
                              </div>
                              {v.change_summary && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{v.change_summary}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <input
                          placeholder={`Next version (current: v${viewProtocol.version})`}
                          value={newVersionNum}
                          onChange={e => setNewVersionNum(e.target.value)}
                          style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                        />
                        <input
                          placeholder="Change notes..."
                          value={newVersionNote}
                          onChange={e => setNewVersionNote(e.target.value)}
                          style={{ flex: 2, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                        />
                        <button
                          className="btn btn-sm btn-secondary"
                          disabled={!newVersionNum || savingVersion}
                          onClick={async () => {
                            if (!newVersionNum) return;
                            setSavingVersion(true);
                            try {
                              await protocolsApi.createVersion(viewProtocol.id, { version: newVersionNum, change_summary: newVersionNote });
                              const r = await protocolsApi.listVersions(viewProtocol.id);
                              setProtocolVersions(r.data);
                              setNewVersionNum(''); setNewVersionNote('');
                            } finally { setSavingVersion(false); }
                          }}
                        >{savingVersion ? '...' : '💾 Save'}</button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => { setViewProtocol(null); setEditMode(false); setShowVersionHistory(false); }} style={{ flex: 1 }}>Close</button>
                  <button className="btn btn-secondary" onClick={() => {
                    navigator.clipboard.writeText(`Protocol: ${viewProtocol.name}\nVersion: ${viewProtocol.version}\nCategory: ${viewProtocol.category}\n\n${viewProtocol.description || ''}`);
                  }} style={{ flex: 1 }}>
                    📋 Copy
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, background: '#6366f1' }}
                    onClick={() => { setExecutingProtocol(viewProtocol); setViewProtocol(null); setEditMode(false); }}
                  >
                    ▶ Execute
                  </button>
                  <button className="btn btn-primary" onClick={() => setEditMode(true)} style={{ flex: 1 }}>
                    ✏️ Edit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* View/Edit SOP Modal */}
      {viewSOP && (
        <div style={modalStyle} onClick={() => { setViewSOP(null); setEditMode(false); }}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>📚</span>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
                    {editMode ? 'Edit SOP' : 'SOP Details'}
                  </h3>
                  <span style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                    background: viewSOP.category === 'Safety' ? 'rgba(239,68,68,0.15)' : viewSOP.category === 'Quality' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                    color: viewSOP.category === 'Safety' ? '#f87171' : viewSOP.category === 'Quality' ? '#60a5fa' : '#4ade80',
                  }}>
                    {viewSOP.category}
                  </span>
                </div>
              </div>
              <button onClick={() => { setViewSOP(null); setEditMode(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            {editMode ? (
              <>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>SOP Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={viewSOP.title}
                    onChange={e => setViewSOP({ ...viewSOP, title: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select
                      className="form-select"
                      value={viewSOP.category}
                      onChange={e => setViewSOP({ ...viewSOP, category: e.target.value })}
                    >
                      <option value="Safety">Safety</option>
                      <option value="Quality">Quality</option>
                      <option value="Operations">Operations</option>
                      <option value="Equipment">Equipment</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Version</label>
                    <input
                      type="text"
                      className="form-input"
                      value={viewSOP.version}
                      onChange={e => setViewSOP({ ...viewSOP, version: e.target.value })}
                    />
                  </div>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    className="form-input"
                    rows={8}
                    value={viewSOP.description || ''}
                    onChange={e => setViewSOP({ ...viewSOP, description: e.target.value })}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button className="btn btn-secondary" onClick={() => { setViewSOP(null); setEditMode(false); }} style={{ flex: 1 }}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleUpdateSOP(viewSOP)}
                    style={{ flex: 1 }}
                  >
                    💾 Save Changes
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{viewSOP.title}</h2>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
                    <span>📁 {viewSOP.category}</span>
                    <span>📌 Version {viewSOP.version}</span>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-soft)' }}>Description</h4>
                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                    fontSize: 14,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 300,
                    overflow: 'auto',
                  }}>
                    {viewSOP.description || 'No description available. Click Edit to add one.'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => { setViewSOP(null); setEditMode(false); }} style={{ flex: 1 }}>Close</button>
                  <button className="btn btn-secondary" onClick={() => {
                    navigator.clipboard.writeText(`SOP: ${viewSOP.title}\nCategory: ${viewSOP.category}\nVersion: ${viewSOP.version}\n\n${viewSOP.description || ''}`);
                  }} style={{ flex: 1 }}>
                    📋 Copy
                  </button>
                  <button className="btn btn-primary" onClick={() => setEditMode(true)} style={{ flex: 1 }}>
                    ✏️ Edit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={modalStyle} onClick={() => setDeleteConfirm(null)}>
          <div style={{ ...modalContentStyle, width: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Confirm Delete</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
              Are you sure you want to delete this {deleteConfirm.type}?
            </p>
            <p style={{ fontWeight: 600, marginBottom: 24, color: 'var(--text-soft)' }}>
              "{deleteConfirm.name}"
            </p>
            <p style={{ fontSize: 12, color: '#f87171', marginBottom: 24 }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleDelete}
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div style={modalStyle} onClick={() => setBulkDeleteConfirm(null)}>
          <div style={{ ...modalContentStyle, width: 420, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Bulk Delete Confirmation</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              You are about to delete <strong style={{ color: '#ef4444' }}>{bulkDeleteConfirm.count}</strong> {bulkDeleteConfirm.type}(s).
            </p>
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 24,
            }}>
              <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>
                This action cannot be undone. All selected items will be permanently removed.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setBulkDeleteConfirm(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleBulkDelete}
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }}
              >
                Delete {bulkDeleteConfirm.count} Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Guide Modal */}
      {showHelpGuide && (
        <div style={modalStyle} onClick={() => setShowHelpGuide(false)}>
          <div style={{ ...modalContentStyle, width: 700, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32 }}>📖</span>
                <h2 style={{ fontSize: 24, fontWeight: 700 }}>How to Use Lab Operations</h2>
              </div>
              <button
                onClick={() => setShowHelpGuide(false)}
                style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                x
              </button>
            </div>

            {/* Quick Start */}
            <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.1))', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#22c55e' }}>Quick Start Guide</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Add New Protocol</h4>
                  <ol style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                    <li>Click "New Protocol" button</li>
                    <li>Choose template or create manually</li>
                    <li>Fill in details (name, category)</li>
                    <li>Click "AI Generate" for description</li>
                    <li>Click "Create Protocol"</li>
                  </ol>
                </div>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Add New Booking</h4>
                  <ol style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                    <li>Go to Bookings tab</li>
                    <li>Click "+ New Booking" button</li>
                    <li>Select instrument from dropdown</li>
                    <li>Choose date and time slot</li>
                    <li>Click "Create Booking"</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Protocols</h4>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                  <li>Create from 10+ templates</li>
                  <li>AI-generate descriptions</li>
                  <li>Track versions and status</li>
                  <li>Duplicate existing protocols</li>
                </ul>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📚</div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>SOPs</h4>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                  <li>Standard Operating Procedures</li>
                  <li>Categorize by type (Safety, Quality)</li>
                  <li>Version control</li>
                  <li>Quick duplicate feature</li>
                </ul>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔬</div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Instruments</h4>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                  <li>Track availability status</li>
                  <li>Quick booking from card</li>
                  <li>Custom locations and types</li>
                  <li>Maintenance tracking</li>
                </ul>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📅</div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Bookings</h4>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                  <li>Multiple time slot options</li>
                  <li>Custom time slots available</li>
                  <li>Confirm/pending status</li>
                  <li>Filter by date and status</li>
                </ul>
              </div>
            </div>

            {/* Bulk Actions */}
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#6366f1' }}>Bulk Actions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ background: 'white', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Select All</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select all items in tab</div>
                </div>
                <div style={{ background: 'white', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Change Status</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Update multiple items</div>
                </div>
                <div style={{ background: 'white', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Delete Selected</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Remove multiple items</div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div style={{ background: 'rgba(234,179,8,0.1)', borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#ca8a04' }}>Pro Tips</h4>
              <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 16, margin: 0 }}>
                <li>Use the search bar to quickly find items across all data</li>
                <li>Export data to CSV for reports and analysis</li>
                <li>Duplicate protocols/SOPs to save time on similar entries</li>
                <li>Use AI Generate to create professional descriptions automatically</li>
              </ul>
            </div>

            <button
              onClick={() => setShowHelpGuide(false)}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 20, padding: '14px', fontSize: 15 }}
            >
              Got it, Let's Start!
            </button>
          </div>
        </div>
      )}

      {/* Protocol Execution Modal */}
      {executingProtocol && (
        <ProtocolExecutionModal
          protocolTitle={executingProtocol.name}
          protocolContent={executingProtocol.description || ''}
          onClose={() => setExecutingProtocol(null)}
        />
      )}
    </div>
  );
}
