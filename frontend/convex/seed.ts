/**
 * Seed demo users for development/demo purposes.
 * Run with: npx convex run seed:seedDemoUsers
 */
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const DEMO_USERS = [
  { email: "admin@lab.local", password: "Admin123!", full_name: "Admin User", role: "admin" as const },
  { email: "pi@lab.local", password: "Pi123!", full_name: "Principal Investigator", role: "pi" as const },
  { email: "manager@lab.local", password: "Manager123!", full_name: "Lab Manager", role: "manager" as const },
  { email: "staff@lab.local", password: "Staff123!", full_name: "Staff Scientist", role: "staff" as const },
  { email: "trainee@lab.local", password: "Trainee123!", full_name: "Graduate Trainee", role: "trainee" as const },
];

export const seedDemoUsers = internalAction({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const bcrypt = await import("bcryptjs");
    const results: string[] = [];

    for (const demo of DEMO_USERS) {
      const hashed_password = await bcrypt.hash(demo.password, 10);
      const result = await ctx.runMutation(internal.seed.insertUserIfMissing, {
        email: demo.email,
        hashed_password,
        full_name: demo.full_name,
        role: demo.role,
      });
      results.push(result);
    }

    return results;
  },
});

export const insertUserIfMissing = internalMutation({
  args: {
    email: v.string(),
    hashed_password: v.string(),
    full_name: v.string(),
    role: v.union(
      v.literal("superadmin"), v.literal("admin"), v.literal("pi"),
      v.literal("manager"), v.literal("staff"), v.literal("trainee")
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) return `SKIP ${args.email} (already exists)`;

    await ctx.db.insert("users", {
      email: args.email,
      hashed_password: args.hashed_password,
      full_name: args.full_name,
      role: args.role,
      is_active: true,
      totp_enabled: false,
      failed_login_attempts: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    return `CREATED ${args.email} (${args.role})`;
  },
});

// ── Seed all demo data ──────────────────────────────────────────────────────
export const seedAllData = internalAction({
  args: {},
  handler: async (ctx): Promise<string> => {
    const result = await ctx.runMutation(internal.seed.insertDemoData);
    return result;
  },
});

export const insertDemoData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const DAY = 86400000;

    const users = await ctx.db.query("users").collect();
    if (users.length === 0) return "No users found — run seedDemoUsers first";
    const admin = users.find(u => u.role === "admin" || u.role === "superadmin")!;
    const pi = users.find(u => u.role === "pi")!;
    const manager = users.find(u => u.role === "manager")!;
    const staff = users.find(u => u.role === "staff")!;
    const trainee = users.find(u => u.role === "trainee")!;

    const existing = await ctx.db.query("tasks").first();
    if (existing) return "SKIP — demo data already seeded";

    // ── Tasks ──
    const taskData = [
      { title: "Western blot for BRCA1 expression", description: "Run western blot on lysates from cell lines A-F. Use anti-BRCA1 (Santa Cruz sc-6954).", status: "in_progress", priority: "high", assigned_to: staff._id, created_by: pi._id, due_date: now + 2 * DAY, tags: "molecular,protein" },
      { title: "Submit IACUC protocol renewal", description: "Annual renewal for mouse colony protocol #2024-0312.", status: "pending", priority: "high", assigned_to: manager._id, created_by: pi._id, due_date: now + 5 * DAY, tags: "compliance" },
      { title: "Calibrate pH meter", description: "Monthly calibration using pH 4, 7, 10 standards.", status: "pending", priority: "medium", assigned_to: trainee._id, created_by: manager._id, due_date: now + 1 * DAY, tags: "maintenance" },
      { title: "Order new pipette tips (200 µL)", description: "Stock running low. Preferred: Rainin LTS 200 µL.", status: "pending", priority: "low", assigned_to: trainee._id, created_by: staff._id, due_date: now + 7 * DAY, tags: "inventory" },
      { title: "Analyze RNA-seq results batch 3", description: "DESeq2 analysis on batch 3 samples. Compare treatment vs control.", status: "completed", priority: "high", assigned_to: staff._id, created_by: pi._id, completed_at: now - 1 * DAY, tags: "bioinformatics" },
      { title: "Safety inspection prep — Lab 204", description: "Ensure all chemical labels current, SDS binders updated, eyewash tested.", status: "in_progress", priority: "high", assigned_to: manager._id, created_by: admin._id, due_date: now + 3 * DAY, tags: "safety" },
      { title: "Train new postdoc on BSC procedures", description: "Biosafety cabinet training for Dr. Chen — SOP-BIO-003.", status: "pending", priority: "medium", assigned_to: staff._id, created_by: manager._id, due_date: now + 10 * DAY, tags: "training" },
      { title: "Prepare grant progress report", description: "NIH R01 annual progress report due June 15.", status: "in_progress", priority: "high", assigned_to: pi._id, created_by: pi._id, due_date: now + 14 * DAY, tags: "grants" },
    ];
    for (const t of taskData) {
      await ctx.db.insert("tasks", { ...t, created_at: now, updated_at: now });
    }

    // ── Protocols ──
    const protocols = [
      { title: "DNA Extraction — Blood Samples", category: "Molecular Biology", version: "3.1", status: "approved", content: "1. Collect 5mL whole blood in EDTA tube\n2. Lyse RBCs with ACK buffer\n3. Proteinase K digestion\n4. Phenol-chloroform extraction\n5. Ethanol precipitation\n6. Resuspend in TE buffer", steps: "6", author_id: pi._id, tags: "DNA,extraction,blood", estimated_duration: 180 },
      { title: "Cell Culture — HeLa Maintenance", category: "Cell Biology", version: "2.0", status: "approved", content: "1. Warm media to 37°C\n2. Aspirate old media\n3. Wash with PBS\n4. Add trypsin, incubate 3 min\n5. Neutralize, centrifuge\n6. Resuspend and plate at 1:10 split", steps: "6", author_id: staff._id, tags: "cell culture,HeLa", estimated_duration: 45 },
      { title: "ELISA — IL-6 Quantification", category: "Immunology", version: "1.2", status: "draft", content: "Sandwich ELISA protocol for measuring IL-6 in serum and cell culture supernatants using R&D Systems DuoSet.", steps: "12", author_id: staff._id, tags: "ELISA,cytokine,IL-6", estimated_duration: 360 },
      { title: "Mouse Genotyping — Cre-lox", category: "Animal Models", version: "1.0", status: "in_review", content: "Tail snip DNA extraction followed by PCR for Cre and floxed alleles.", steps: "8", author_id: trainee._id, tags: "genotyping,mouse,PCR", estimated_duration: 240 },
    ];
    for (const p of protocols) {
      await ctx.db.insert("protocols", { ...p, created_at: now, updated_at: now });
    }

    // ── Instruments ──
    const instruments = [
      { name: "Thermo Fisher NanoDrop 2000", model: "ND-2000", serial_number: "ND2K-7834", location: "Room 204, Bench 3", status: "available", last_calibrated: now - 15 * DAY, next_calibration: now + 75 * DAY },
      { name: "Bio-Rad CFX96 qPCR", model: "CFX96 Touch", serial_number: "BR-CFX-2291", location: "Room 206", status: "available", last_calibrated: now - 30 * DAY, next_calibration: now + 60 * DAY },
      { name: "Beckman Coulter Optima XPN", model: "XPN-100", serial_number: "BC-XPN-0445", location: "Room 210, Cold Room", status: "in_use", last_calibrated: now - 60 * DAY, next_calibration: now + 30 * DAY },
      { name: "Zeiss LSM 880 Confocal", model: "LSM 880", serial_number: "ZS-LSM-1102", location: "Imaging Core, Room 301", status: "maintenance", last_calibrated: now - 90 * DAY, next_calibration: now + 1 * DAY, notes: "Laser alignment needed" },
      { name: "Eppendorf 5425 R Centrifuge", model: "5425 R", serial_number: "EP-5425-8812", location: "Room 204", status: "available", last_calibrated: now - 10 * DAY, next_calibration: now + 170 * DAY },
    ];
    for (const i of instruments) {
      await ctx.db.insert("instruments", { ...i, created_at: now, updated_at: now });
    }

    // ── Inventory ──
    const inventory = [
      { name: "Tris-HCl pH 8.0 (1M)", catalog_number: "T2694", supplier: "Sigma-Aldrich", category: "Buffers", quantity: 3, unit: "500 mL bottles", location: "Room 204, Shelf A2", minimum_quantity: 2, cost_per_unit: 42.50 },
      { name: "Fetal Bovine Serum (FBS)", catalog_number: "26140079", supplier: "Gibco", category: "Cell Culture", quantity: 8, unit: "500 mL bottles", location: "Walk-in freezer, Rack 2", minimum_quantity: 4, cost_per_unit: 285.00, expiry_date: now + 180 * DAY },
      { name: "SYBR Green qPCR Master Mix", catalog_number: "4385612", supplier: "Applied Biosystems", category: "Molecular Biology", quantity: 1, unit: "5 mL kit", location: "Room 206, -20°C Freezer", minimum_quantity: 2, cost_per_unit: 495.00, expiry_date: now + 90 * DAY },
      { name: "Anti-GAPDH antibody", catalog_number: "ab9485", supplier: "Abcam", category: "Antibodies", quantity: 2, unit: "100 µL vials", location: "Room 204, -20°C", minimum_quantity: 1, cost_per_unit: 320.00, expiry_date: now + 365 * DAY },
      { name: "Nitrile Gloves (Medium)", catalog_number: "N8130", supplier: "VWR", category: "Consumables", quantity: 15, unit: "boxes (100ct)", location: "Supply closet", minimum_quantity: 5, cost_per_unit: 12.99 },
      { name: "Ethanol 200 proof", catalog_number: "E7023", supplier: "Sigma-Aldrich", category: "Solvents", quantity: 4, unit: "1L bottles", location: "Flammables cabinet", minimum_quantity: 2, cost_per_unit: 65.00, hazards: "Flammable" },
    ];
    for (const item of inventory) {
      await ctx.db.insert("inventory", { ...item, created_at: now, updated_at: now });
    }

    // ── Samples ──
    const samples = [
      { sample_id: "BLD-2024-001", name: "Patient Blood — Study 4401 (Visit 1)", type: "Blood", status: "stored", location: "Freezer A, Rack 3, Box 12", collected_by: staff._id, collected_at: now - 5 * DAY, barcode: "BLD2024001" },
      { sample_id: "TIS-2024-015", name: "Tumor Biopsy — Cohort B", type: "Tissue", status: "processing", location: "Histology Lab", collected_by: staff._id, collected_at: now - 1 * DAY, barcode: "TIS2024015" },
      { sample_id: "RNA-2024-042", name: "Total RNA — HeLa treated", type: "RNA", status: "stored", location: "Room 204, -80°C, Box 5", collected_by: trainee._id, collected_at: now - 3 * DAY, barcode: "RNA2024042" },
      { sample_id: "DNA-2024-089", name: "Genomic DNA — Mouse tail #23", type: "DNA", status: "stored", location: "Room 204, -20°C", collected_by: trainee._id, collected_at: now - 2 * DAY, barcode: "DNA2024089" },
      { sample_id: "SER-2024-007", name: "Serum Pool — Control Group", type: "Serum", status: "shipped", location: "Shipped to Core Lab", collected_by: staff._id, collected_at: now - 10 * DAY, barcode: "SER2024007" },
    ];
    for (const s of samples) {
      await ctx.db.insert("samples", { ...s, created_at: now, updated_at: now });
    }

    // ── Incidents ──
    const incidents = [
      { title: "Chemical spill — Ethidium Bromide", description: "Small EtBr spill on bench in Room 204. Area decontaminated per SOP-HAZ-007.", severity: "medium", status: "resolved", reported_by: trainee._id, assigned_to: manager._id, occurred_at: now - 3 * DAY, resolved_at: now - 2 * DAY, corrective_action: "Retrained on EtBr handling. Added secondary containment tray." },
      { title: "Freezer temperature excursion — Unit B", description: "-80°C freezer rose to -65°C overnight. Alarm triggered. Compressor fault.", severity: "high", status: "investigating", reported_by: staff._id, assigned_to: manager._id, occurred_at: now - 1 * DAY, root_cause: "Compressor relay failure" },
    ];
    for (const inc of incidents) {
      await ctx.db.insert("incidents", { ...inc, created_at: now, updated_at: now });
    }

    // ── SOPs ──
    const sops = [
      { title: "Biosafety Cabinet Operation", content: "Standard procedure for BSC use including UV decontamination, airflow verification, and proper technique.", category: "Safety", version: "4.0", status: "approved", author_id: manager._id, approved_by: pi._id, approved_at: now - 30 * DAY, review_date: now + 335 * DAY },
      { title: "Chemical Waste Disposal", content: "Segregation, labeling, and pickup procedures for chemical waste streams.", category: "Safety", version: "3.2", status: "approved", author_id: manager._id, approved_by: admin._id, approved_at: now - 60 * DAY, review_date: now + 305 * DAY },
      { title: "Autoclave Operation & Validation", content: "Loading, cycle selection, biological indicator placement, and log documentation.", category: "Equipment", version: "2.1", status: "approved", author_id: staff._id, approved_by: manager._id, approved_at: now - 15 * DAY, review_date: now + 350 * DAY },
    ];
    for (const s of sops) {
      await ctx.db.insert("sops", { ...s, created_at: now, updated_at: now });
    }

    // ── Suppliers ──
    const suppliers = [
      { name: "Sigma-Aldrich / MilliporeSigma", contact_email: "orders@sigmaaldrich.com", contact_phone: "800-325-3010", website: "https://www.sigmaaldrich.com", category: "Chemicals & Reagents", approval_status: "approved", rating: 5, notes: "Primary chemicals supplier. Volume discount 15%." },
      { name: "Thermo Fisher Scientific", contact_email: "orders@thermofisher.com", contact_phone: "800-766-7000", website: "https://www.thermofisher.com", category: "Life Sciences", approval_status: "approved", rating: 5, notes: "Cell culture, molecular biology, instruments." },
      { name: "Bio-Rad Laboratories", contact_email: "support@bio-rad.com", contact_phone: "800-424-6723", website: "https://www.bio-rad.com", category: "Life Sciences", approval_status: "approved", rating: 4, notes: "Electrophoresis, western blot, qPCR systems." },
      { name: "VWR International", contact_email: "orders@vwr.com", contact_phone: "800-932-5000", website: "https://www.vwr.com", category: "General Lab Supplies", approval_status: "approved", rating: 4, notes: "Consumables, plasticware, PPE." },
      { name: "New England Biolabs", contact_email: "info@neb.com", contact_phone: "800-632-5227", website: "https://www.neb.com", category: "Molecular Biology", approval_status: "approved", rating: 5, notes: "Restriction enzymes, cloning kits, competent cells." },
    ];
    for (const s of suppliers) {
      await ctx.db.insert("suppliers", { ...s, created_at: now, updated_at: now });
    }

    // ── Maintenance ──
    const maintenance = [
      { maintenance_type: "certification", status: "scheduled", scheduled_date: now + 14 * DAY, performed_by: manager._id, notes: "Annual BSC certification — Room 204. Vendor: Baker." },
      { maintenance_type: "repair", status: "in_progress", scheduled_date: now, performed_by: staff._id, notes: "Confocal laser alignment — 405nm and 561nm lasers need realignment." },
      { maintenance_type: "preventive", status: "completed", scheduled_date: now - 7 * DAY, performed_by: staff._id, completed_date: now - 7 * DAY, notes: "Centrifuge rotor inspection — Beckman Optima XPN" },
    ];
    for (const m of maintenance) {
      await ctx.db.insert("maintenance", { ...m, created_at: now });
    }

    // ── Lab Notebook Entries ──
    const entries = [
      { title: "BRCA1 Western Blot — Cell Lines A-C", content: "Lysed cells with RIPA buffer + protease inhibitors. Loaded 30µg total protein per lane on 8% SDS-PAGE. Transferred to PVDF. Primary: anti-BRCA1 1:500 overnight at 4°C.\n\nResult: Strong band at ~220 kDa in lines A and B. Line C shows reduced expression (~40% by densitometry).", tags: "BRCA1,protein,western", author_id: staff._id, is_locked: false },
      { title: "RNA-seq Library Prep — Batch 3", content: "Prepared libraries from 12 RNA samples using NEBNext Ultra II kit. Input: 500ng total RNA. Fragmentation: 15 min at 94°C. 12 cycles PCR amplification.\n\nQC: Bioanalyzer traces show expected 200-400bp distribution. Average concentration 15 nM.", tags: "RNA-seq,NGS,library prep", author_id: trainee._id, is_locked: false },
    ];
    for (const e of entries) {
      await ctx.db.insert("lab_notebook", { ...e, created_at: now, updated_at: now });
    }

    // ── IoT Sensors ──
    const sensors = [
      { name: "Freezer A (-80°C)", sensor_type: "temperature", location: "Room 210, Freezer A", unit: "°C", is_active: true, min_threshold: -85, max_threshold: -75 },
      { name: "Incubator CO₂", sensor_type: "co2", location: "Room 204, Incubator 1", unit: "%", is_active: true, min_threshold: 4.5, max_threshold: 5.5 },
      { name: "Room 204 Temperature", sensor_type: "temperature", location: "Room 204", unit: "°C", is_active: true, min_threshold: 19, max_threshold: 25 },
      { name: "Room 204 Humidity", sensor_type: "humidity", location: "Room 204", unit: "%RH", is_active: true, min_threshold: 30, max_threshold: 60 },
    ];
    for (const s of sensors) {
      await ctx.db.insert("iot_sensors", { ...s, created_at: now });
    }

    // ── Costs ──
    const costs = [
      { title: "FBS order — 10 bottles", category: "Reagents", amount: 2850.00, currency: "USD", status: "approved", submitted_by: staff._id, approved_by: pi._id, grant_id: "R01-CA-234567", description: "10x 500mL FBS bottles for cell culture" },
      { title: "Confocal laser repair", category: "Equipment Maintenance", amount: 4200.00, currency: "USD", status: "pending", submitted_by: manager._id, grant_id: "R01-CA-234567", description: "Laser realignment service call" },
      { title: "Conference registration — AACR 2026", category: "Travel", amount: 750.00, currency: "USD", status: "approved", submitted_by: trainee._id, approved_by: pi._id, grant_id: "T32-CA-112233", description: "Annual AACR meeting registration" },
    ];
    for (const c of costs) {
      await ctx.db.insert("costs", { ...c, created_at: now });
    }

    // ── Freezers ──
    const freezers = [
      { name: "Freezer A (-80°C)", location: "Room 210", temperature: -80, capacity_racks: 5, capacity_boxes: 20 },
      { name: "Freezer B (-20°C)", location: "Room 204", temperature: -20, capacity_racks: 3, capacity_boxes: 12 },
      { name: "LN₂ Tank 1", location: "Room 210", temperature: -196, capacity_racks: 2, capacity_boxes: 10, notes: "Liquid nitrogen dewar" },
    ];
    for (const f of freezers) {
      await ctx.db.insert("freezers", { ...f, created_at: now });
    }

    // ── Settings ──
    const settings = [
      { key: "lab_name", value: "Molecular Oncology Research Lab", category: "general", label: "Lab Name" },
      { key: "institution", value: "University Medical Center", category: "general", label: "Institution" },
      { key: "pi_name", value: "Dr. Sarah Chen", category: "general", label: "Principal Investigator" },
      { key: "timezone", value: "America/New_York", category: "general", label: "Timezone" },
      { key: "low_stock_threshold", value: "2", category: "inventory", label: "Low Stock Alert Threshold" },
      { key: "sample_id_prefix", value: "MOL", category: "samples", label: "Sample ID Prefix" },
    ];
    for (const s of settings) {
      await ctx.db.insert("settings", { ...s, created_at: now, updated_at: now });
    }

    return "SEEDED: 8 tasks, 4 protocols, 5 instruments, 6 inventory, 5 samples, 2 incidents, 3 SOPs, 5 suppliers, 3 maintenance, 2 notebook entries, 4 IoT sensors, 3 costs, 3 freezers, 6 settings";
  },
});
