import type { Meeting, ActionItem } from '../types/meeting.types'

// Base date: 2026-04-02 (today)
const T = (offsetDays: number, hour = 10, min = 0) => {
  const d = new Date('2026-04-02T00:00:00Z')
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

export const MOCK_MEETINGS: Meeting[] = [
  // ─── UPCOMING ────────────────────────────────────────────────────────────
  {
    id: 'mtg-001',
    title: 'Weekly Lab Meeting — Week 14',
    type: 'weekly',
    scheduledAt: T(5, 10, 0),
    endTime: T(5, 12, 0),
    location: 'Conference Room B / Zoom',
    zoomLink: 'https://zoom.us/j/example',
    status: 'scheduled',
    organizer: 'Dr. Sarah Chen',
    organizerRole: 'pi',
    description: 'Weekly lab meeting covering research updates, protocol discussions, and action item follow-ups.',
    isRecurring: true,
    recurringPattern: 'weekly',
    tags: ['weekly', 'research', 'updates'],
    minutes: '',
    minutesPublished: false,
    progressReports: [
      {
        id: 'pr-001-1',
        meetingId: 'mtg-001',
        submittedBy: 'user-3',
        submitterName: 'Alex Kim',
        submitterRole: 'staff',
        summary: 'Completed PBMC isolation optimization runs, achieving 92% viability. Started RNA-seq library prep.',
        accomplishments: [
          'Optimized Ficoll gradient protocol — 92% cell viability (up from 78%)',
          'Submitted 6 samples for sequencing (Batch SQ-042)',
          'Completed BSL-2 refresher training'
        ],
        challenges: [
          'RNA degradation in 2 of 8 samples — investigating extraction step',
          'BD FACSCalibur booked solid — need to plan ahead'
        ],
        nextSteps: [
          'Troubleshoot RNA extraction with Dr. Chen on Mon',
          'Run pilot flow panel for NK cell phenotyping',
          'Submit reorder request for Ficoll (stock low)'
        ],
        papersRead: ['Zheng et al. 2022 Nat Methods — PBMC atlas', 'Sallusto & Lanzavecchia 1994 (classic)'],
        submittedAt: T(3, 16, 30),
        status: 'submitted',
      },
      {
        id: 'pr-001-2',
        meetingId: 'mtg-001',
        submittedBy: 'user-4',
        submitterName: 'Priya Patel',
        submitterRole: 'trainee',
        summary: 'Working through CRISPR knock-in protocol training. Completed cell line authentication.',
        accomplishments: [
          'Authenticated HEK293T and Jurkat cell lines by STR profiling',
          'Completed plasmid cloning training module with Dr. Wright',
          'Prepared gRNA library (32 targets)'
        ],
        challenges: [
          'Transfection efficiency low in Jurkat cells (~18%) — trying electroporation',
          'Need guidance on selecting HDR vs NHEJ strategy'
        ],
        nextSteps: [
          'Present gRNA design rationale at next meeting',
          'Test electroporation conditions (3 voltages × 2 pulse durations)',
          'Complete lab safety quiz by Friday'
        ],
        submittedAt: T(4, 9, 0),
        status: 'submitted',
      },
    ],
    agenda: [
      {
        id: 'ag-001-1',
        meetingId: 'mtg-001',
        title: 'Action Item Follow-ups from Week 13',
        description: 'Review outstanding action items from last meeting',
        presenter: 'Dr. Sarah Chen',
        presenterRole: 'pi',
        durationMinutes: 10,
        order: 1,
        status: 'approved',
        category: 'lab_business',
        submittedBy: 'Dr. Sarah Chen',
        submittedByRole: 'pi',
        submittedAt: T(-2, 9, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-2, 9, 5),
      },
      {
        id: 'ag-001-2',
        meetingId: 'mtg-001',
        title: 'PBMC Isolation Optimization — Results & Next Steps',
        description: 'Alex presents viability data from 3 protocol variants and proposes finalized SOP',
        presenter: 'Alex Kim',
        presenterRole: 'staff',
        durationMinutes: 20,
        order: 2,
        status: 'approved',
        category: 'research_update',
        slideLink: 'https://docs.google.com/presentation/example-pbmc',
        submittedBy: 'Alex Kim',
        submittedByRole: 'staff',
        submittedAt: T(-1, 11, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-1, 14, 0),
        piNotes: 'Include the viability comparison chart. Bring printed copies.',
      },
      {
        id: 'ag-001-3',
        meetingId: 'mtg-001',
        title: 'gRNA Design Strategy for CRISPR Jurkat Screen',
        description: 'Priya presents rationale for selected gRNA targets and asks for PI feedback on HDR vs NHEJ choice',
        presenter: 'Priya Patel',
        presenterRole: 'trainee',
        durationMinutes: 15,
        order: 3,
        status: 'approved',
        category: 'research_update',
        submittedBy: 'Priya Patel',
        submittedByRole: 'trainee',
        submittedAt: T(-1, 10, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-1, 14, 0),
      },
      {
        id: 'ag-001-4',
        meetingId: 'mtg-001',
        title: 'Lab Inventory & Budget Update',
        description: 'Low stock alerts and Q2 budget allocation discussion',
        presenter: 'Dr. Sarah Chen',
        presenterRole: 'pi',
        durationMinutes: 10,
        order: 4,
        status: 'approved',
        category: 'lab_business',
        submittedBy: 'Dr. Sarah Chen',
        submittedByRole: 'pi',
        submittedAt: T(-2, 9, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-2, 9, 5),
      },
      {
        id: 'ag-001-5',
        meetingId: 'mtg-001',
        title: 'Request: Add RNA extraction QC step to SOP-004',
        description: 'Proposing a mandatory RIN number check after extraction to catch degraded samples earlier',
        presenter: 'Alex Kim',
        presenterRole: 'staff',
        durationMinutes: 5,
        order: 5,
        status: 'pending_approval',
        category: 'lab_business',
        submittedBy: 'Alex Kim',
        submittedByRole: 'staff',
        submittedAt: T(4, 15, 0),
      },
    ],
    attendees: [
      { userId: 'user-1', name: 'Dr. Sarah Chen', role: 'pi', status: 'present' },
      { userId: 'user-2', name: 'Dr. James Wright', role: 'manager', status: 'present' },
      { userId: 'user-3', name: 'Alex Kim', role: 'staff', status: 'present' },
      { userId: 'user-4', name: 'Priya Patel', role: 'trainee', status: 'present' },
      { userId: 'user-5', name: 'Marcus Lee', role: 'trainee', status: 'present' },
    ],
    actionItems: [],
    createdAt: T(-7, 9, 0),
    updatedAt: T(4, 16, 0),
  },

  {
    id: 'mtg-002',
    title: 'Journal Club — Spatial Transcriptomics in Tumour Microenvironment',
    type: 'journal_club',
    scheduledAt: T(12, 14, 0),
    endTime: T(12, 15, 30),
    location: 'Seminar Room A',
    status: 'scheduled',
    organizer: 'Dr. Sarah Chen',
    organizerRole: 'pi',
    description: 'Monthly journal club. Presenter reviews 2 recent papers on spatial transcriptomics in cancer biology.',
    isRecurring: true,
    recurringPattern: 'monthly',
    tags: ['journal club', 'spatial transcriptomics', 'cancer'],
    minutes: '',
    minutesPublished: false,
    progressReports: [],
    agenda: [
      {
        id: 'ag-002-1',
        meetingId: 'mtg-002',
        title: 'Paper 1: "Spatially resolved multiomics of single cells in the tumour microenvironment" (Nature 2022)',
        description: 'Critical review of methods, findings, and limitations. Discussion of relevance to lab projects.',
        presenter: 'Marcus Lee',
        presenterRole: 'trainee',
        durationMinutes: 40,
        order: 1,
        status: 'approved',
        category: 'journal_club',
        slideLink: 'https://docs.google.com/presentation/example-jc1',
        submittedBy: 'Dr. Sarah Chen',
        submittedByRole: 'pi',
        submittedAt: T(-14, 9, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-14, 9, 0),
      },
      {
        id: 'ag-002-2',
        meetingId: 'mtg-002',
        title: 'Paper 2: "MERFISH imaging of the tumour immune contexture" (Cell 2023)',
        description: 'Follow-up paper from same group. Compare methodological improvements.',
        presenter: 'Marcus Lee',
        presenterRole: 'trainee',
        durationMinutes: 30,
        order: 2,
        status: 'approved',
        category: 'journal_club',
        submittedBy: 'Dr. Sarah Chen',
        submittedByRole: 'pi',
        submittedAt: T(-14, 9, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-14, 9, 0),
      },
      {
        id: 'ag-002-3',
        meetingId: 'mtg-002',
        title: 'Can we adopt Visium HD in our lab? Resource/feasibility discussion',
        description: 'PI leads discussion on whether to add spatial transcriptomics to lab capabilities',
        presenter: 'Dr. Sarah Chen',
        presenterRole: 'pi',
        durationMinutes: 20,
        order: 3,
        status: 'approved',
        category: 'lab_business',
        submittedBy: 'Dr. Sarah Chen',
        submittedByRole: 'pi',
        submittedAt: T(-14, 9, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-14, 9, 0),
      },
    ],
    attendees: [
      { userId: 'user-1', name: 'Dr. Sarah Chen', role: 'pi', status: 'present' },
      { userId: 'user-2', name: 'Dr. James Wright', role: 'manager', status: 'present' },
      { userId: 'user-3', name: 'Alex Kim', role: 'staff', status: 'present' },
      { userId: 'user-4', name: 'Priya Patel', role: 'trainee', status: 'present' },
      { userId: 'user-5', name: 'Marcus Lee', role: 'trainee', status: 'present' },
    ],
    actionItems: [],
    createdAt: T(-14, 9, 0),
    updatedAt: T(-14, 9, 0),
  },

  {
    id: 'mtg-003',
    title: '1:1 — Alex Kim Progress Review',
    type: 'one_on_one',
    scheduledAt: T(7, 14, 0),
    endTime: T(7, 15, 0),
    location: 'PI Office',
    status: 'scheduled',
    organizer: 'Dr. Sarah Chen',
    organizerRole: 'pi',
    description: 'Monthly 1:1 with Alex Kim to review project milestones and career development.',
    isRecurring: true,
    recurringPattern: 'monthly',
    tags: ['1:1', 'mentoring'],
    minutes: '',
    minutesPublished: false,
    progressReports: [],
    agenda: [
      {
        id: 'ag-003-1',
        meetingId: 'mtg-003',
        title: 'Project milestone review — Q1 targets',
        description: '',
        presenter: 'Dr. Sarah Chen',
        presenterRole: 'pi',
        durationMinutes: 20,
        order: 1,
        status: 'approved',
        category: 'research_update',
        submittedBy: 'Dr. Sarah Chen',
        submittedByRole: 'pi',
        submittedAt: T(-3, 9, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-3, 9, 0),
      },
      {
        id: 'ag-003-2',
        meetingId: 'mtg-003',
        title: 'Career development — fellowship applications',
        description: 'Review draft for NIH F31 application. Discuss timeline.',
        presenter: 'Alex Kim',
        presenterRole: 'staff',
        durationMinutes: 30,
        order: 2,
        status: 'approved',
        category: 'other',
        submittedBy: 'Alex Kim',
        submittedByRole: 'staff',
        submittedAt: T(-2, 11, 0),
        approvedBy: 'Dr. Sarah Chen',
        approvedAt: T(-2, 13, 0),
      },
    ],
    attendees: [
      { userId: 'user-1', name: 'Dr. Sarah Chen', role: 'pi', status: 'present' },
      { userId: 'user-3', name: 'Alex Kim', role: 'staff', status: 'present' },
    ],
    actionItems: [],
    createdAt: T(-3, 9, 0),
    updatedAt: T(-3, 9, 0),
  },

  // ─── COMPLETED ───────────────────────────────────────────────────────────
  {
    id: 'mtg-004',
    title: 'Weekly Lab Meeting — Week 13',
    type: 'weekly',
    scheduledAt: T(-2, 10, 0),
    endTime: T(-2, 12, 0),
    location: 'Conference Room B / Zoom',
    zoomLink: 'https://zoom.us/j/example',
    status: 'completed',
    organizer: 'Dr. Sarah Chen',
    organizerRole: 'pi',
    description: 'Weekly lab meeting — Week 13.',
    isRecurring: true,
    recurringPattern: 'weekly',
    tags: ['weekly', 'research'],
    minutes: `## Lab Meeting Minutes — Week 13 (31 Mar 2026)

**Attendees:** Dr. Sarah Chen (PI), Dr. James Wright (Manager), Alex Kim, Priya Patel, Marcus Lee

---

### 1. Action Items from Week 12

- ✅ Alex: Ordered new Ficoll (arrived, in storage)
- ✅ Priya: Completed STR profiling — all cell lines authenticated
- ⏳ Marcus: Journal club paper selection — due by 3 Apr (in progress)

---

### 2. Flow Cytometry Panel Optimisation (Alex Kim)

Alex presented 3 panel variants for NK cell phenotyping. Variant B (12-colour) gave cleanest separation.

**Decision:** Adopt Variant B as lab standard. Alex to write up as SOP-012.

**Action:** Alex to finalise SOP-012 draft by 9 Apr.

---

### 3. CRISPR Screen Design (Priya Patel)

Priya showed gRNA coverage map. PI recommended testing positive controls in parallel.

**Action:** Priya to add positive control gRNAs (ROSA26 targeting) to library by 7 Apr.

---

### 4. Sequencing Results — Batch SQ-041

Results back from core. 5/6 samples passed QC. 1 sample (SMP-0042) failed — low complexity.

**Action:** Dr. Wright to investigate SMP-0042 extraction records. Report back Week 14.

---

### 5. Budget & Inventory

Q1 underspend: $4,200. PI approved rolling over to cover Visium HD pilot (discussed in JC next week).

---

*Minutes recorded by Dr. James Wright. Published by Dr. Sarah Chen on 1 Apr 2026.*`,
    minutesPublished: true,
    minutesPublishedAt: T(-1, 9, 0),
    progressReports: [
      {
        id: 'pr-004-1',
        meetingId: 'mtg-004',
        submittedBy: 'user-3',
        submitterName: 'Alex Kim',
        submitterRole: 'staff',
        summary: 'Finalized NK cell flow cytometry panel variants for comparison.',
        accomplishments: ['Ran 3 panel variants on healthy donor PBMCs', 'Collected viability and compensation data'],
        challenges: ['Spectral overlap in channel 7 still suboptimal'],
        nextSteps: ['Present comparison at Week 13 meeting', 'Write SOP-012 draft'],
        submittedAt: T(-4, 10, 0),
        status: 'acknowledged',
        piComment: 'Great progress. Variant B looks solid — go with it.',
      },
    ],
    agenda: [
      {
        id: 'ag-004-1', meetingId: 'mtg-004',
        title: 'Action Items from Week 12', presenter: 'Dr. Sarah Chen', presenterRole: 'pi',
        description: '', durationMinutes: 10, order: 1, status: 'presented', category: 'lab_business',
        submittedBy: 'Dr. Sarah Chen', submittedByRole: 'pi', submittedAt: T(-9, 9, 0),
        approvedBy: 'Dr. Sarah Chen', approvedAt: T(-9, 9, 0),
      },
      {
        id: 'ag-004-2', meetingId: 'mtg-004',
        title: 'Flow Cytometry Panel Optimisation Results', presenter: 'Alex Kim', presenterRole: 'staff',
        description: 'NK cell panel comparison', durationMinutes: 25, order: 2, status: 'presented',
        category: 'research_update', slideLink: 'https://docs.google.com/presentation/example-flow',
        submittedBy: 'Alex Kim', submittedByRole: 'staff', submittedAt: T(-8, 11, 0),
        approvedBy: 'Dr. Sarah Chen', approvedAt: T(-7, 8, 0),
      },
      {
        id: 'ag-004-3', meetingId: 'mtg-004',
        title: 'CRISPR Screen Design Update', presenter: 'Priya Patel', presenterRole: 'trainee',
        description: 'gRNA library overview', durationMinutes: 20, order: 3, status: 'presented',
        category: 'research_update', submittedBy: 'Priya Patel', submittedByRole: 'trainee',
        submittedAt: T(-6, 10, 0), approvedBy: 'Dr. Sarah Chen', approvedAt: T(-5, 9, 0),
      },
    ],
    attendees: [
      { userId: 'user-1', name: 'Dr. Sarah Chen', role: 'pi', status: 'present' },
      { userId: 'user-2', name: 'Dr. James Wright', role: 'manager', status: 'present' },
      { userId: 'user-3', name: 'Alex Kim', role: 'staff', status: 'present' },
      { userId: 'user-4', name: 'Priya Patel', role: 'trainee', status: 'present' },
      { userId: 'user-5', name: 'Marcus Lee', role: 'trainee', status: 'remote' },
    ],
    actionItems: [],
    createdAt: T(-9, 9, 0),
    updatedAt: T(-1, 9, 0),
  },

  {
    id: 'mtg-005',
    title: 'Lab Retreat Planning Session',
    type: 'lab_retreat',
    scheduledAt: T(21, 9, 0),
    endTime: T(21, 12, 0),
    location: 'Boardroom 3',
    status: 'scheduled',
    organizer: 'Dr. Sarah Chen',
    organizerRole: 'pi',
    description: 'Planning session for annual lab retreat. Venue selection, agenda topics, and invited speakers.',
    isRecurring: false,
    tags: ['retreat', 'planning'],
    minutes: '',
    minutesPublished: false,
    progressReports: [],
    agenda: [
      {
        id: 'ag-005-1', meetingId: 'mtg-005',
        title: 'Venue options review (3 candidates)', presenter: 'Dr. James Wright', presenterRole: 'manager',
        description: '', durationMinutes: 20, order: 1, status: 'approved', category: 'lab_business',
        submittedBy: 'Dr. James Wright', submittedByRole: 'manager', submittedAt: T(-5, 9, 0),
        approvedBy: 'Dr. Sarah Chen', approvedAt: T(-4, 10, 0),
      },
      {
        id: 'ag-005-2', meetingId: 'mtg-005',
        title: 'Scientific agenda — talk slots and workshops', presenter: 'Dr. Sarah Chen', presenterRole: 'pi',
        description: '', durationMinutes: 30, order: 2, status: 'approved', category: 'lab_business',
        submittedBy: 'Dr. Sarah Chen', submittedByRole: 'pi', submittedAt: T(-5, 9, 0),
        approvedBy: 'Dr. Sarah Chen', approvedAt: T(-5, 9, 0),
      },
      {
        id: 'ag-005-3', meetingId: 'mtg-005',
        title: 'Request: team-building activity (escape room or kayaking vote)',
        description: 'Team vote on preferred activity',
        presenter: 'Marcus Lee', presenterRole: 'trainee',
        durationMinutes: 10, order: 3, status: 'pending_approval', category: 'other',
        submittedBy: 'Marcus Lee', submittedByRole: 'trainee', submittedAt: T(0, 9, 30),
      },
    ],
    attendees: [
      { userId: 'user-1', name: 'Dr. Sarah Chen', role: 'pi', status: 'present' },
      { userId: 'user-2', name: 'Dr. James Wright', role: 'manager', status: 'present' },
      { userId: 'user-3', name: 'Alex Kim', role: 'staff', status: 'present' },
      { userId: 'user-4', name: 'Priya Patel', role: 'trainee', status: 'present' },
      { userId: 'user-5', name: 'Marcus Lee', role: 'trainee', status: 'present' },
    ],
    actionItems: [],
    createdAt: T(-5, 9, 0),
    updatedAt: T(0, 9, 30),
  },
]

export const MOCK_ACTION_ITEMS: ActionItem[] = [
  {
    id: 'ai-001',
    meetingId: 'mtg-004',
    meetingTitle: 'Weekly Lab Meeting — Week 13',
    title: 'Finalise SOP-012 draft (NK cell flow panel)',
    description: 'Write up Variant B as official lab SOP. Include reagent list, compensation protocol, and gating strategy.',
    assignedTo: 'user-3',
    assignedToName: 'Alex Kim',
    assignedToRole: 'staff',
    assignedBy: 'Dr. Sarah Chen',
    dueDate: new Date('2026-04-09').toISOString(),
    status: 'in_progress',
    priority: 'high',
    notes: 'Use the NK panel template from SOP-009 as a starting point',
    createdAt: T(-2, 12, 0),
  },
  {
    id: 'ai-002',
    meetingId: 'mtg-004',
    meetingTitle: 'Weekly Lab Meeting — Week 13',
    title: 'Add positive control gRNAs to CRISPR library',
    description: 'Include ROSA26-targeting gRNAs as non-essential positive control to validate screen performance.',
    assignedTo: 'user-4',
    assignedToName: 'Priya Patel',
    assignedToRole: 'trainee',
    assignedBy: 'Dr. Sarah Chen',
    dueDate: new Date('2026-04-07').toISOString(),
    status: 'open',
    priority: 'urgent',
    createdAt: T(-2, 12, 0),
  },
  {
    id: 'ai-003',
    meetingId: 'mtg-004',
    meetingTitle: 'Weekly Lab Meeting — Week 13',
    title: 'Investigate SMP-0042 extraction records',
    description: 'Low complexity failure in sequencing. Review chain of custody, extraction conditions, and storage log.',
    assignedTo: 'user-2',
    assignedToName: 'Dr. James Wright',
    assignedToRole: 'manager',
    assignedBy: 'Dr. Sarah Chen',
    dueDate: new Date('2026-04-07').toISOString(),
    status: 'in_progress',
    priority: 'high',
    createdAt: T(-2, 12, 0),
  },
  {
    id: 'ai-004',
    meetingId: 'mtg-004',
    meetingTitle: 'Weekly Lab Meeting — Week 13',
    title: 'Select and distribute JC papers for 14 Apr session',
    description: 'Choose 2 papers on spatial transcriptomics in tumour microenvironment. Send to lab by 5 Apr.',
    assignedTo: 'user-5',
    assignedToName: 'Marcus Lee',
    assignedToRole: 'trainee',
    assignedBy: 'Dr. Sarah Chen',
    dueDate: new Date('2026-04-05').toISOString(),
    status: 'completed',
    priority: 'medium',
    completedAt: T(1, 11, 0),
    notes: 'Papers sent via email. Slides in progress.',
    createdAt: T(-2, 12, 0),
  },
  {
    id: 'ai-005',
    meetingId: 'mtg-001',
    meetingTitle: 'Weekly Lab Meeting — Week 14',
    title: 'Submit Ficoll reorder request to purchasing',
    description: 'Stock below threshold. Order 6 × 500 mL Ficoll-Paque PLUS.',
    assignedTo: 'user-3',
    assignedToName: 'Alex Kim',
    assignedToRole: 'staff',
    assignedBy: 'Dr. James Wright',
    dueDate: new Date('2026-04-10').toISOString(),
    status: 'open',
    priority: 'medium',
    createdAt: T(0, 9, 0),
  },
  {
    id: 'ai-006',
    meetingId: 'mtg-001',
    meetingTitle: 'Weekly Lab Meeting — Week 14',
    title: 'Complete lab safety quiz (BSL-2 refresher)',
    description: 'Required before operating centrifuge in BSL-2 suite.',
    assignedTo: 'user-4',
    assignedToName: 'Priya Patel',
    assignedToRole: 'trainee',
    assignedBy: 'Dr. James Wright',
    dueDate: new Date('2026-04-04').toISOString(),
    status: 'overdue',
    priority: 'urgent',
    createdAt: T(-2, 12, 0),
  },
]
