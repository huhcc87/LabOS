import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { inventoryApi, suppliersApi } from '../lib/api';
import type { InventoryItem } from '../lib/types';
import { Table, Pagination } from '../components/Table';
import type { Column } from '../components/Table';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { usePagedApi } from '../hooks/useApi';

type TabType = 'dashboard' | 'inventory' | 'suppliers' | 'orders' | 'analytics' | 'storage' | 'iot' | 'compliance' | 'waste' | 'labels' | 'sds' | 'coa' | 'calculator' | 'sharing' | 'recurring';
type ViewMode = 'table' | 'grid' | 'kanban';

// IoT Freezer/Equipment Monitoring Data
interface IoTDevice {
  id: string;
  name: string;
  type: 'freezer' | 'fridge' | 'incubator' | 'ln2' | 'room';
  targetTemp: number;
  currentTemp: number;
  humidity?: number;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  lastReading: string;
  alerts: { type: string; message: string; time: string }[];
  history: { time: string; temp: number }[];
}

// Chemical Compatibility Matrix
const CHEMICAL_COMPATIBILITY: Record<string, string[]> = {
  'Flammable': ['Oxidizer', 'Corrosive'],
  'Oxidizer': ['Flammable', 'Toxic'],
  'Corrosive': ['Flammable', 'Toxic'],
  'Toxic': ['Oxidizer', 'Corrosive'],
};

// Waste Categories
interface WasteRecord {
  id: number;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  hazardClass: string;
  generatedBy: string;
  generatedDate: string;
  status: 'pending' | 'scheduled' | 'disposed';
  disposalDate?: string;
  containerLocation: string;
}

interface Supplier {
  id: number;
  supplier_id: string;
  company: string;
  category: string;
  subcategory: string;
  description: string;
  market_segment: string;
  research_use: boolean;
  clinical_use: boolean;
  primary_offerings: string;
  ai_recommendation_tags: string;
  procurement_priority: string;
  approval_status: string;
  is_preferred: boolean;
  website: string;
  budget_tier: string;
  rating: number;
  total_orders: number;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  status: string;
  items: any[];
  total: number;
  requested_by: string;
  created_at: string;
  urgency: string;
}

// GHS Hazard pictograms mapping
const GHS_HAZARDS: Record<string, { icon: string; color: string; label: string; description: string }> = {
  'Flammable': { icon: '🔥', color: '#dc2626', label: 'Flammable', description: 'May catch fire easily' },
  'Corrosive': { icon: '⚗️', color: '#f97316', label: 'Corrosive', description: 'Can cause severe burns' },
  'Toxic': { icon: '☠️', color: '#7c3aed', label: 'Toxic', description: 'Fatal or toxic if exposed' },
  'Oxidizer': { icon: '⭕', color: '#0ea5e9', label: 'Oxidizer', description: 'May intensify fire' },
  'Biohazard': { icon: '☣️', color: '#ec4899', label: 'Biohazard', description: 'Biological hazard' },
  'Radioactive': { icon: '☢️', color: '#eab308', label: 'Radioactive', description: 'Radioactive material' },
  'Irritant': { icon: '⚠️', color: '#6b7280', label: 'Irritant', description: 'May cause irritation' },
  'Health Hazard': { icon: '🫁', color: '#be123c', label: 'Health Hazard', description: 'May cause serious health effects' },
  'Environmental': { icon: '🌊', color: '#059669', label: 'Environmental', description: 'Hazardous to environment' },
  'Compressed Gas': { icon: '🔵', color: '#2563eb', label: 'Compressed Gas', description: 'Gas under pressure' },
};

const STORAGE_TEMPS = ['', 'RT', '4C', '-20C', '-80C', 'LN2'];
const HAZARD_CLASSES = ['', 'None', ...Object.keys(GHS_HAZARDS)];

// Inventory Categories
const INVENTORY_CATEGORIES = [
  { value: '', label: '-- Select Category --', icon: '' },
  { value: 'Enzymes', label: 'Enzymes', icon: '🧬' },
  { value: 'Reagents', label: 'Reagents', icon: '🧪' },
  { value: 'Antibodies', label: 'Antibodies', icon: '🔬' },
  { value: 'Primers', label: 'Primers & Oligos', icon: '🧬' },
  { value: 'Cell Culture', label: 'Cell Culture Media', icon: '🦠' },
  { value: 'Buffers', label: 'Buffers & Solutions', icon: '💧' },
  { value: 'Chemicals', label: 'Chemicals', icon: '⚗️' },
  { value: 'Plasticware', label: 'Plasticware', icon: '🥤' },
  { value: 'Glassware', label: 'Glassware', icon: '🧫' },
  { value: 'PPE', label: 'PPE & Safety', icon: '🧤' },
  { value: 'Kits', label: 'Assay Kits', icon: '📦' },
  { value: 'Consumables', label: 'Consumables', icon: '📋' },
  { value: 'Standards', label: 'Standards & Controls', icon: '📊' },
  { value: 'Equipment', label: 'Equipment Parts', icon: '⚙️' },
  { value: 'Samples', label: 'Sample Storage', icon: '🧊' },
  { value: 'Other', label: 'Other', icon: '📁' },
];

// Common Units
const INVENTORY_UNITS = [
  { value: '', label: '-- Select Unit --', category: '' },
  // Volume
  { value: 'mL', label: 'mL (milliliters)', category: 'Volume' },
  { value: 'L', label: 'L (liters)', category: 'Volume' },
  { value: 'µL', label: 'µL (microliters)', category: 'Volume' },
  // Mass
  { value: 'g', label: 'g (grams)', category: 'Mass' },
  { value: 'mg', label: 'mg (milligrams)', category: 'Mass' },
  { value: 'µg', label: 'µg (micrograms)', category: 'Mass' },
  { value: 'kg', label: 'kg (kilograms)', category: 'Mass' },
  // Count
  { value: 'units', label: 'units', category: 'Count' },
  { value: 'pcs', label: 'pieces', category: 'Count' },
  { value: 'boxes', label: 'boxes', category: 'Count' },
  { value: 'packs', label: 'packs', category: 'Count' },
  { value: 'bags', label: 'bags', category: 'Count' },
  { value: 'bottles', label: 'bottles', category: 'Count' },
  { value: 'vials', label: 'vials', category: 'Count' },
  { value: 'tubes', label: 'tubes', category: 'Count' },
  { value: 'plates', label: 'plates', category: 'Count' },
  { value: 'flasks', label: 'flasks', category: 'Count' },
  { value: 'kits', label: 'kits', category: 'Count' },
  // Concentration
  { value: 'rxn', label: 'reactions', category: 'Applications' },
  { value: 'tests', label: 'tests', category: 'Applications' },
  { value: 'assays', label: 'assays', category: 'Applications' },
  { value: 'U', label: 'U (enzyme units)', category: 'Activity' },
  { value: 'nmol', label: 'nmol (nanomoles)', category: 'Amount' },
  { value: 'pmol', label: 'pmol (picomoles)', category: 'Amount' },
];

// Storage locations for the visual map
const STORAGE_LOCATIONS = [
  { id: 'freezer-80-1', name: '-80°C Freezer 1', type: '-80C', capacity: 50, icon: '🧊' },
  { id: 'freezer-80-2', name: '-80°C Freezer 2', type: '-80C', capacity: 50, icon: '🧊' },
  { id: 'freezer-20-1', name: '-20°C Freezer 1', type: '-20C', capacity: 100, icon: '❄️' },
  { id: 'freezer-20-2', name: '-20°C Freezer 2', type: '-20C', capacity: 100, icon: '❄️' },
  { id: 'fridge-1', name: 'Refrigerator 1', type: '4C', capacity: 80, icon: '🌡️' },
  { id: 'fridge-2', name: 'Refrigerator 2', type: '4C', capacity: 80, icon: '🌡️' },
  { id: 'shelf-rt-1', name: 'RT Shelf A', type: 'RT', capacity: 200, icon: '📦' },
  { id: 'shelf-rt-2', name: 'RT Shelf B', type: 'RT', capacity: 200, icon: '📦' },
  { id: 'chemical-cabinet', name: 'Chemical Cabinet', type: 'RT', capacity: 100, icon: '🧪' },
  { id: 'flammable-cabinet', name: 'Flammable Cabinet', type: 'RT', capacity: 50, icon: '🔥' },
  { id: 'ln2-tank', name: 'LN2 Tank', type: 'LN2', capacity: 30, icon: '🥶' },
];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Inventory
  const { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload } = usePagedApi<InventoryItem>(
    (p, pp, s) => inventoryApi.list(p, pp, s)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Custom input states for "Add manually" options
  const [customCategory, setCustomCategory] = useState(false);
  const [customUnit, setCustomUnit] = useState(false);
  const [customLocation, setCustomLocation] = useState(false);
  const [customTemp, setCustomTemp] = useState(false);
  const [customHazard, setCustomHazard] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tempFilter, setTempFilter] = useState<string>('all');
  const [hazardFilter, setHazardFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('inventory_favorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const { register, handleSubmit, reset, setValue, watch } = useForm<any>();

  // Saved Filters
  interface SavedFilter {
    id: string;
    name: string;
    search: string;
    category: string;
    temp: string;
    hazard: string;
    stock: string;
    createdAt: string;
  }
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    const saved = localStorage.getItem('inventory_saved_filters');
    return saved ? JSON.parse(saved) : [];
  });
  const [filterNameInput, setFilterNameInput] = useState('');
  const [showSaveFilterInput, setShowSaveFilterInput] = useState(false);

  // Usage logging
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [usageItem, setUsageItem] = useState<InventoryItem | null>(null);
  const [usageAmount, setUsageAmount] = useState(1);
  const [usagePurpose, setUsagePurpose] = useState('');

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierStats, setSupplierStats] = useState<any>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Purchase Orders
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [orderStats, setOrderStats] = useState<any>(null);
  const [orderModal, setOrderModal] = useState(false);
  const [selectedSupplierForOrder, setSelectedSupplierForOrder] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);

  // Quick reorder
  const [quickReorderOpen, setQuickReorderOpen] = useState(false);

  // Smart Reorder AI predictions
  const [smartReorderExpanded, setSmartReorderExpanded] = useState(true);

  // IoT Monitoring
  const [iotDevices, setIotDevices] = useState<IoTDevice[]>([
    {
      id: 'freezer-80-1',
      name: '-80°C Freezer 1 (Thermo)',
      type: 'freezer',
      targetTemp: -80,
      currentTemp: -79.2,
      humidity: 15,
      status: 'normal',
      lastReading: new Date().toISOString(),
      alerts: [],
      history: Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, temp: -80 + (Math.random() * 2 - 1) })),
    },
    {
      id: 'freezer-80-2',
      name: '-80°C Freezer 2 (Eppendorf)',
      type: 'freezer',
      targetTemp: -80,
      currentTemp: -78.5,
      humidity: 18,
      status: 'warning',
      lastReading: new Date().toISOString(),
      alerts: [{ type: 'warning', message: 'Temperature 1.5°C above target', time: new Date().toISOString() }],
      history: Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, temp: -79 + (Math.random() * 3 - 1) })),
    },
    {
      id: 'freezer-20-1',
      name: '-20°C Freezer 1',
      type: 'freezer',
      targetTemp: -20,
      currentTemp: -19.8,
      status: 'normal',
      lastReading: new Date().toISOString(),
      alerts: [],
      history: Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, temp: -20 + (Math.random() * 2 - 1) })),
    },
    {
      id: 'fridge-1',
      name: '4°C Refrigerator 1',
      type: 'fridge',
      targetTemp: 4,
      currentTemp: 4.2,
      humidity: 45,
      status: 'normal',
      lastReading: new Date().toISOString(),
      alerts: [],
      history: Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, temp: 4 + (Math.random() * 1 - 0.5) })),
    },
    {
      id: 'incubator-1',
      name: 'CO2 Incubator 1',
      type: 'incubator',
      targetTemp: 37,
      currentTemp: 37.1,
      humidity: 95,
      status: 'normal',
      lastReading: new Date().toISOString(),
      alerts: [],
      history: Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, temp: 37 + (Math.random() * 0.5 - 0.25) })),
    },
    {
      id: 'ln2-tank-1',
      name: 'LN2 Tank (Samples)',
      type: 'ln2',
      targetTemp: -196,
      currentTemp: -195,
      status: 'normal',
      lastReading: new Date().toISOString(),
      alerts: [],
      history: Array.from({ length: 24 }, (_, i) => ({ time: `${i}:00`, temp: -196 + (Math.random() * 2) })),
    },
  ]);

  // Waste Tracking
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([
    { id: 1, category: 'Chemical Waste', description: 'Spent solvents from HPLC', quantity: 5, unit: 'L', hazardClass: 'Flammable', generatedBy: 'Lab A', generatedDate: '2024-04-01', status: 'pending', containerLocation: 'Waste Room A' },
    { id: 2, category: 'Biohazard', description: 'Cell culture waste', quantity: 2, unit: 'L', hazardClass: 'Biohazard', generatedBy: 'Cell Culture', generatedDate: '2024-04-05', status: 'scheduled', disposalDate: '2024-04-15', containerLocation: 'Biohazard Cabinet' },
    { id: 3, category: 'Sharps', description: 'Used needles and syringes', quantity: 1, unit: 'container', hazardClass: 'Biohazard', generatedBy: 'Animal Facility', generatedDate: '2024-04-03', status: 'pending', containerLocation: 'Sharps Station 1' },
  ]);
  const [wasteModalOpen, setWasteModalOpen] = useState(false);

  // Label Printing
  const [labelItems, setLabelItems] = useState<InventoryItem[]>([]);
  const [labelTemplate, setLabelTemplate] = useState<'standard' | 'small' | 'freezer' | 'chemical'>('standard');
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);

  // SDS (Safety Data Sheet) Library
  interface SDSDocument {
    id: number;
    chemicalName: string;
    casNumber: string;
    manufacturer: string;
    hazardClass: string;
    uploadDate: string;
    expiryDate: string;
    fileUrl: string;
    linkedItems: number[];
  }
  const [sdsDocuments, setSdsDocuments] = useState<SDSDocument[]>([
    { id: 1, chemicalName: 'Ethanol (95%)', casNumber: '64-17-5', manufacturer: 'Sigma-Aldrich', hazardClass: 'Flammable', uploadDate: '2024-01-15', expiryDate: '2027-01-15', fileUrl: '#', linkedItems: [1, 5, 12] },
    { id: 2, chemicalName: 'Hydrochloric Acid', casNumber: '7647-01-0', manufacturer: 'Fisher Scientific', hazardClass: 'Corrosive', uploadDate: '2024-02-20', expiryDate: '2027-02-20', fileUrl: '#', linkedItems: [3, 8] },
    { id: 3, chemicalName: 'Sodium Hydroxide', casNumber: '1310-73-2', manufacturer: 'VWR', hazardClass: 'Corrosive', uploadDate: '2024-03-10', expiryDate: '2027-03-10', fileUrl: '#', linkedItems: [7] },
    { id: 4, chemicalName: 'Acetone', casNumber: '67-64-1', manufacturer: 'Sigma-Aldrich', hazardClass: 'Flammable', uploadDate: '2024-01-05', expiryDate: '2027-01-05', fileUrl: '#', linkedItems: [2, 4, 9] },
    { id: 5, chemicalName: 'Formaldehyde (37%)', casNumber: '50-00-0', manufacturer: 'Thermo Fisher', hazardClass: 'Toxic', uploadDate: '2024-04-01', expiryDate: '2027-04-01', fileUrl: '#', linkedItems: [6] },
  ]);
  const [sdsSearch, setSdsSearch] = useState('');
  const [sdsModalOpen, setSdsModalOpen] = useState(false);

  // COA (Certificate of Analysis) Documents
  interface COADocument {
    id: number;
    lotNumber: string;
    productName: string;
    manufacturer: string;
    analysisDate: string;
    expiryDate: string;
    status: 'valid' | 'expiring' | 'expired';
    fileUrl: string;
    inventoryItemId: number;
  }
  const [coaDocuments, setCoaDocuments] = useState<COADocument[]>([
    { id: 1, lotNumber: 'LOT-2024-001', productName: 'PCR Master Mix', manufacturer: 'Thermo Fisher', analysisDate: '2024-01-10', expiryDate: '2025-01-10', status: 'valid', fileUrl: '#', inventoryItemId: 1 },
    { id: 2, lotNumber: 'LOT-2024-002', productName: 'Cell Culture Media', manufacturer: 'Gibco', analysisDate: '2024-02-15', expiryDate: '2024-08-15', status: 'expiring', fileUrl: '#', inventoryItemId: 2 },
    { id: 3, lotNumber: 'LOT-2023-089', productName: 'Trypsin-EDTA', manufacturer: 'Sigma', analysisDate: '2023-06-20', expiryDate: '2024-03-20', status: 'expired', fileUrl: '#', inventoryItemId: 3 },
  ]);
  const [coaModalOpen, setCoaModalOpen] = useState(false);

  // Protocol Material Calculator
  interface ProtocolMaterial {
    itemId: number;
    itemName: string;
    quantityPerRun: number;
    unit: string;
    currentStock: number;
    needed: number;
    sufficient: boolean;
  }
  const [selectedProtocol, setSelectedProtocol] = useState<string>('');
  const [numberOfRuns, setNumberOfRuns] = useState(1);
  const [calculatedMaterials, setCalculatedMaterials] = useState<ProtocolMaterial[]>([]);

  // Mock protocols for calculator
  const protocols = [
    { id: 'pcr', name: 'PCR Amplification', materials: [{ itemName: 'PCR Master Mix', qty: 25, unit: 'µL' }, { itemName: 'Primers', qty: 2, unit: 'µL' }, { itemName: 'Template DNA', qty: 1, unit: 'µL' }, { itemName: 'PCR Tubes', qty: 1, unit: 'pcs' }] },
    { id: 'western', name: 'Western Blot', materials: [{ itemName: 'PVDF Membrane', qty: 1, unit: 'sheet' }, { itemName: 'Transfer Buffer', qty: 100, unit: 'mL' }, { itemName: 'Blocking Buffer', qty: 50, unit: 'mL' }, { itemName: 'Primary Antibody', qty: 10, unit: 'µL' }] },
    { id: 'cellculture', name: 'Cell Culture Passage', materials: [{ itemName: 'Trypsin-EDTA', qty: 2, unit: 'mL' }, { itemName: 'Cell Culture Media', qty: 10, unit: 'mL' }, { itemName: 'PBS', qty: 5, unit: 'mL' }, { itemName: 'Culture Flask', qty: 1, unit: 'pcs' }] },
    { id: 'elisa', name: 'ELISA Assay', materials: [{ itemName: 'ELISA Plate', qty: 1, unit: 'plate' }, { itemName: 'Wash Buffer', qty: 500, unit: 'mL' }, { itemName: 'Substrate Solution', qty: 10, unit: 'mL' }, { itemName: 'Stop Solution', qty: 10, unit: 'mL' }] },
  ];

  // Recurring Order Templates
  interface RecurringOrder {
    id: number;
    name: string;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
    items: { itemId: number; itemName: string; quantity: number; unit: string }[];
    nextOrder: string;
    supplier: string;
    estimatedCost: number;
    active: boolean;
  }
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrder[]>([
    { id: 1, name: 'Monthly Lab Consumables', frequency: 'monthly', items: [{ itemId: 1, itemName: 'Pipette Tips (1000µL)', quantity: 10, unit: 'boxes' }, { itemId: 2, itemName: 'Gloves (M)', quantity: 5, unit: 'boxes' }], nextOrder: '2024-05-01', supplier: 'VWR', estimatedCost: 450, active: true },
    { id: 2, name: 'Weekly Cell Culture', frequency: 'weekly', items: [{ itemId: 3, itemName: 'Cell Culture Media', quantity: 6, unit: 'bottles' }, { itemId: 4, itemName: 'FBS', quantity: 1, unit: 'bottle' }], nextOrder: '2024-04-15', supplier: 'Gibco', estimatedCost: 280, active: true },
    { id: 3, name: 'Quarterly Equipment Maintenance', frequency: 'quarterly', items: [{ itemId: 5, itemName: 'HEPA Filters', quantity: 2, unit: 'pcs' }, { itemId: 6, itemName: 'Calibration Kit', quantity: 1, unit: 'set' }], nextOrder: '2024-07-01', supplier: 'Thermo Fisher', estimatedCost: 1200, active: false },
  ]);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);

  // Material Sharing Between Labs
  interface SharedMaterial {
    id: number;
    itemName: string;
    quantity: number;
    unit: string;
    fromLab: string;
    toLab: string;
    status: 'available' | 'requested' | 'approved' | 'transferred';
    expiresOn: string;
    requestedBy?: string;
    requestDate?: string;
  }
  const [sharedMaterials, setSharedMaterials] = useState<SharedMaterial[]>([
    { id: 1, itemName: 'Anti-CD45 Antibody', quantity: 50, unit: 'µL', fromLab: 'Chen Lab', toLab: '', status: 'available', expiresOn: '2024-08-15' },
    { id: 2, itemName: 'CRISPR Cas9 Protein', quantity: 10, unit: 'µg', fromLab: 'Smith Lab', toLab: 'Your Lab', status: 'requested', expiresOn: '2024-06-20', requestedBy: 'Dr. Johnson', requestDate: '2024-04-10' },
    { id: 3, itemName: 'GFP Plasmid', quantity: 5, unit: 'µg', fromLab: 'Your Lab', toLab: 'Park Lab', status: 'approved', expiresOn: '2024-12-01' },
    { id: 4, itemName: 'RNA Extraction Kit', quantity: 1, unit: 'kit', fromLab: 'Wong Lab', toLab: '', status: 'available', expiresOn: '2024-09-30' },
  ]);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // AI Substitution Suggestions
  interface Substitution {
    originalItem: string;
    alternatives: { name: string; manufacturer: string; similarity: number; priceDiff: string; inStock: boolean }[];
  }
  const [substitutionItem, setSubstitutionItem] = useState<string>('');
  const [substitutions, setSubstitutions] = useState<Substitution | null>(null);
  const [substitutionLoading, setSubstitutionLoading] = useState(false);

  // Experiment Cost Calculator
  interface ExperimentCost {
    materials: { name: string; quantity: number; unit: string; unitCost: number; totalCost: number }[];
    laborHours: number;
    laborRate: number;
    equipmentCost: number;
    totalCost: number;
  }
  const [experimentName, setExperimentName] = useState('');
  const [experimentCost, setExperimentCost] = useState<ExperimentCost | null>(null);

  // Mobile Quick Actions state
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  // 21 CFR Part 11 Audit Trail
  interface AuditEntry {
    id: number;
    timestamp: string;
    user: string;
    action: string;
    entity: string;
    entityId: string;
    oldValue?: string;
    newValue?: string;
    signature?: string;
    reason?: string;
    ipAddress: string;
  }
  const [auditEntries] = useState<AuditEntry[]>([
    { id: 1, timestamp: '2024-04-10 14:32:15', user: 'Dr. Sarah Chen', action: 'UPDATE', entity: 'Inventory', entityId: 'INV-001', oldValue: 'Qty: 50', newValue: 'Qty: 45', signature: 'eSig-SC-2024-001', reason: 'Used for experiment EXP-2024-042', ipAddress: '192.168.1.100' },
    { id: 2, timestamp: '2024-04-10 13:15:42', user: 'Lab Tech Mike', action: 'CREATE', entity: 'Sample', entityId: 'SMP-456', newValue: 'Blood sample - Patient 1042', signature: 'eSig-MT-2024-089', ipAddress: '192.168.1.105' },
    { id: 3, timestamp: '2024-04-10 11:08:33', user: 'Dr. Emily Park', action: 'APPROVE', entity: 'Protocol', entityId: 'PROT-012', newValue: 'PCR Protocol v2.1 approved', signature: 'eSig-EP-2024-023', reason: 'Reviewed and validated', ipAddress: '192.168.1.110' },
    { id: 4, timestamp: '2024-04-09 16:45:00', user: 'Admin', action: 'DELETE', entity: 'Inventory', entityId: 'INV-089', oldValue: 'Expired reagent - Lot 2023-001', signature: 'eSig-AD-2024-015', reason: 'Expired material disposal', ipAddress: '192.168.1.101' },
  ]);

  // Vendor Scorecards
  const [vendorScoreModalOpen, setVendorScoreModalOpen] = useState(false);
  const [scoringSupplier, setScoringSupplier] = useState<Supplier | null>(null);

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('inventory_favorites', JSON.stringify([...favorites]));
  }, [favorites]);

  // Save saved filters to localStorage
  useEffect(() => {
    localStorage.setItem('inventory_saved_filters', JSON.stringify(savedFilters));
  }, [savedFilters]);

  // Check if current filter is active
  const hasActiveFilter = search || categoryFilter !== 'all' || tempFilter !== 'all' || hazardFilter !== 'all' || stockFilter !== 'all';

  function saveCurrentFilter() {
    if (!filterNameInput.trim()) {
      toast.error('Please enter a filter name');
      return;
    }
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterNameInput.trim(),
      search,
      category: categoryFilter,
      temp: tempFilter,
      hazard: hazardFilter,
      stock: stockFilter,
      createdAt: new Date().toISOString(),
    };
    setSavedFilters(prev => [...prev, newFilter]);
    setFilterNameInput('');
    setShowSaveFilterInput(false);
    toast.success(`Filter "${newFilter.name}" saved!`);
  }

  function loadSavedFilter(filter: SavedFilter) {
    setSearch(filter.search);
    setCategoryFilter(filter.category);
    setTempFilter(filter.temp);
    setHazardFilter(filter.hazard);
    setStockFilter(filter.stock);
    setPage(1);
    toast.success(`Loaded filter "${filter.name}"`);
  }

  function deleteSavedFilter(id: string) {
    setSavedFilters(prev => prev.filter(f => f.id !== id));
    toast.success('Filter deleted');
  }

  function clearAllFilters() {
    setSearch('');
    setCategoryFilter('all');
    setTempFilter('all');
    setHazardFilter('all');
    setStockFilter('all');
    setPage(1);
  }

  // Fetch data
  useEffect(() => {
    if (activeTab === 'suppliers' || activeTab === 'orders' || activeTab === 'analytics' || activeTab === 'dashboard') {
      loadSuppliers();
      loadSupplierStats();
    }
    if (activeTab === 'orders' || activeTab === 'dashboard') {
      loadOrders();
      loadOrderStats();
    }
  }, [activeTab]);

  async function loadSuppliers() {
    try {
      const res = await suppliersApi.list(1, 100, supplierSearch);
      setSuppliers(res.data.items);
    } catch (e) { console.error(e); }
  }

  async function loadSupplierStats() {
    try {
      const res = await suppliersApi.stats();
      setSupplierStats(res.data);
    } catch (e) { console.error(e); }
  }

  async function loadOrders() {
    try {
      const res = await suppliersApi.listOrders(1, 50);
      setOrders(res.data.items);
    } catch (e) { console.error(e); }
  }

  async function loadOrderStats() {
    try {
      const res = await suppliersApi.orderStats();
      setOrderStats(res.data);
    } catch (e) { console.error(e); }
  }

  async function handleAiSearch() {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const res = await suppliersApi.aiRecommend(aiQuery);
      setAiRecommendations(res.data.recommendations || []);
      if (res.data.recommendations?.length === 0) {
        toast.error('No matching suppliers found');
      }
    } catch (e) {
      toast.error('AI search failed');
    } finally {
      setAiLoading(false);
    }
  }

  // Advanced stats calculations
  const stats = useMemo(() => {
    const lowStock = items.filter(r => r.quantity > 0 && r.quantity <= r.reorder_threshold);
    const outOfStock = items.filter(r => r.quantity === 0);
    const expiredItems = items.filter(r => r.expires_on && new Date(r.expires_on) < now);
    const expiringIn7 = items.filter(r => {
      if (!r.expires_on) return false;
      const d = new Date(r.expires_on);
      return d >= now && d <= in7;
    });
    const expiringIn30 = items.filter(r => {
      if (!r.expires_on) return false;
      const d = new Date(r.expires_on);
      return d > in7 && d <= in30;
    });
    const expiringIn90 = items.filter(r => {
      if (!r.expires_on) return false;
      const d = new Date(r.expires_on);
      return d > in30 && d <= in90;
    });
    const hazardous = items.filter(r => r.hazard_class && r.hazard_class !== 'None');
    const totalValue = items.reduce((sum, r) => sum + (r.quantity * (r.unit_price || 0)), 0);

    // Storage distribution
    const byTemp: Record<string, number> = {};
    items.forEach(i => {
      const temp = i.storage_temp || 'RT';
      byTemp[temp] = (byTemp[temp] || 0) + 1;
    });

    // Category distribution
    const byCategory: Record<string, number> = {};
    items.forEach(i => {
      byCategory[i.category] = (byCategory[i.category] || 0) + 1;
    });

    return {
      total: items.length,
      lowStock,
      outOfStock,
      expiredItems,
      expiringIn7,
      expiringIn30,
      expiringIn90,
      hazardous,
      totalValue,
      byTemp,
      byCategory,
      healthyStock: items.length - lowStock.length - outOfStock.length,
    };
  }, [items]);

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))), [items]);

  // Smart Reorder AI Predictions
  const smartReorderPredictions = useMemo(() => {
    const predictions: Array<{
      item: InventoryItem;
      urgency: 'critical' | 'high' | 'medium' | 'low';
      confidence: number;
      reason: string;
      suggestedQty: number;
      estimatedCost: number;
      daysUntilStockout: number;
      recommendedSupplier?: Supplier;
    }> = [];

    items.forEach(item => {
      // Calculate days until stockout (simulated based on reorder threshold as proxy for usage rate)
      const usageRate = item.reorder_threshold > 0 ? item.reorder_threshold / 7 : 1; // items per day estimate
      const daysUntilStockout = usageRate > 0 ? Math.floor(item.quantity / usageRate) : 999;

      // Calculate suggested reorder quantity
      const suggestedQty = Math.max(item.reorder_threshold * 2 - item.quantity, item.reorder_threshold);

      // Calculate urgency and confidence
      let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
      let confidence = 0;
      let reason = '';

      if (item.quantity === 0) {
        urgency = 'critical';
        confidence = 98;
        reason = 'Out of stock - immediate reorder required';
      } else if (item.quantity <= item.reorder_threshold * 0.5) {
        urgency = 'critical';
        confidence = 95;
        reason = `Critical stock level (${Math.round((item.quantity / item.reorder_threshold) * 100)}% of threshold)`;
      } else if (item.quantity <= item.reorder_threshold) {
        urgency = 'high';
        confidence = 88;
        reason = 'Below reorder threshold';
      } else if (daysUntilStockout <= 14) {
        urgency = 'medium';
        confidence = 75;
        reason = `Projected stockout in ${daysUntilStockout} days`;
      } else if (item.expires_on) {
        const expiryDate = new Date(item.expires_on);
        const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        if (daysToExpiry <= 30 && daysToExpiry > 0) {
          urgency = 'medium';
          confidence = 70;
          reason = `Expires in ${daysToExpiry} days - plan replacement`;
        }
      }

      // Find best matching supplier based on category
      let recommendedSupplier: Supplier | undefined;
      if (item.supplier_id) {
        recommendedSupplier = suppliers.find(s => s.id === item.supplier_id);
      } else {
        recommendedSupplier = suppliers.find(s =>
          s.is_preferred &&
          s.category.toLowerCase().includes(item.category?.toLowerCase() || '')
        ) || suppliers.find(s => s.is_preferred);
      }

      // Adjust confidence based on supplier availability
      if (recommendedSupplier?.is_preferred) confidence = Math.min(99, confidence + 5);

      // Calculate estimated cost
      const estimatedCost = suggestedQty * (item.unit_price || 0) / 100;

      // Only add items that need reordering
      if (urgency !== 'low' || item.quantity <= item.reorder_threshold * 1.5) {
        predictions.push({
          item,
          urgency,
          confidence,
          reason,
          suggestedQty,
          estimatedCost,
          daysUntilStockout,
          recommendedSupplier,
        });
      }
    });

    // Sort by urgency then confidence
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return predictions.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return b.confidence - a.confidence;
    });
  }, [items, suppliers]);

  // Advanced filtering
  const filteredItems = useMemo(() => {
    let result = items;

    if (categoryFilter !== 'all') {
      result = result.filter(i => i.category === categoryFilter);
    }
    if (tempFilter !== 'all') {
      result = result.filter(i => (i.storage_temp || 'RT') === tempFilter);
    }
    if (hazardFilter !== 'all') {
      if (hazardFilter === 'hazardous') {
        result = result.filter(i => i.hazard_class && i.hazard_class !== 'None');
      } else {
        result = result.filter(i => i.hazard_class === hazardFilter);
      }
    }
    if (stockFilter !== 'all') {
      if (stockFilter === 'low') {
        result = result.filter(i => i.quantity > 0 && i.quantity <= i.reorder_threshold);
      } else if (stockFilter === 'out') {
        result = result.filter(i => i.quantity === 0);
      } else if (stockFilter === 'expiring') {
        result = result.filter(i => i.expires_on && new Date(i.expires_on) <= in30);
      } else if (stockFilter === 'favorites') {
        result = result.filter(i => favorites.has(i.id));
      }
    }

    return result;
  }, [items, categoryFilter, tempFilter, hazardFilter, stockFilter, favorites]);

  // Storage location stats
  const storageStats = useMemo(() => {
    const stats: Record<string, { count: number; items: InventoryItem[] }> = {};
    STORAGE_LOCATIONS.forEach(loc => {
      stats[loc.id] = { count: 0, items: [] };
    });

    items.forEach(item => {
      const location = item.storage_location?.toLowerCase() || '';
      STORAGE_LOCATIONS.forEach(loc => {
        if (location.includes(loc.name.toLowerCase()) ||
            location.includes(loc.type.toLowerCase()) ||
            (item.storage_temp === loc.type)) {
          stats[loc.id].count++;
          stats[loc.id].items.push(item);
        }
      });
    });

    return stats;
  }, [items]);

  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectItem(id: number) {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllItems() {
    setSelectedItems(new Set(filteredItems.map(i => i.id)));
  }

  function clearSelection() {
    setSelectedItems(new Set());
  }

  function openCreate() {
    setEditing(null);
    reset({ name: '', category: '', lot_number: '', quantity: 0, unit: 'units', reorder_threshold: 0, storage_location: '', barcode: '', expires_on: null, notes: '', supplier_id: '', catalog_number: '', unit_price: 0, hazard_class: '', storage_temp: '' });
    // Reset custom input toggles
    setCustomCategory(false);
    setCustomUnit(false);
    setCustomLocation(false);
    setCustomTemp(false);
    setCustomHazard(false);
    setModalOpen(true);
  }

  function openEdit(row: InventoryItem) {
    setEditing(row);
    reset({ ...row, unit_price: (row.unit_price || 0) / 100 });
    // Reset custom input toggles
    setCustomCategory(false);
    setCustomUnit(false);
    setCustomLocation(false);
    setCustomTemp(false);
    setCustomHazard(false);
    setModalOpen(true);
  }

  function openUsageLog(item: InventoryItem) {
    setUsageItem(item);
    setUsageAmount(1);
    setUsagePurpose('');
    setUsageModalOpen(true);
  }

  async function logUsage() {
    if (!usageItem || usageAmount <= 0) return;
    setSaving(true);
    try {
      const newQty = Math.max(0, usageItem.quantity - usageAmount);
      await inventoryApi.update(usageItem.id, { ...usageItem, quantity: newQty });
      toast.success(`Logged ${usageAmount} ${usageItem.unit} usage`);
      setUsageModalOpen(false);
      reload();
    } catch (e) {
      toast.error('Failed to log usage');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(data: any) {
    setSaving(true);
    try {
      const payload = {
        ...data,
        quantity: Number(data.quantity),
        reorder_threshold: Number(data.reorder_threshold),
        unit_price: Number(data.unit_price || 0) * 100,
        supplier_id: data.supplier_id ? Number(data.supplier_id) : null,
      };
      editing ? await inventoryApi.update(editing.id, payload) : await inventoryApi.create(payload);
      toast.success(editing ? 'Updated' : 'Created');
      setModalOpen(false);
      reload();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await inventoryApi.delete(deleting.id);
      toast.success('Deleted');
      setDeleting(null);
      reload();
    } catch {
      toast.error('Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function createPurchaseOrder() {
    if (!selectedSupplierForOrder || orderItems.length === 0) {
      toast.error('Select a supplier and add items');
      return;
    }
    setSaving(true);
    try {
      await suppliersApi.createOrder({
        supplier_id: selectedSupplierForOrder,
        items: orderItems,
        urgency: 'normal',
      });
      toast.success('Purchase order created!');
      setOrderModal(false);
      setQuickReorderOpen(false);
      setOrderItems([]);
      setSelectedSupplierForOrder(null);
      loadOrders();
    } catch (e) {
      toast.error('Failed to create order');
    } finally {
      setSaving(false);
    }
  }

  async function approveOrder(orderId: number) {
    try {
      await suppliersApi.approveOrder(orderId);
      toast.success('Order approved');
      loadOrders();
    } catch (e) {
      toast.error('Failed to approve');
    }
  }

  async function receiveOrder(orderId: number) {
    try {
      await suppliersApi.receiveOrder(orderId);
      toast.success('Order received - inventory updated!');
      loadOrders();
      reload();
    } catch (e) {
      toast.error('Failed to receive order');
    }
  }

  function generateQuickReorderList() {
    const itemsToReorder = stats.lowStock.concat(stats.outOfStock);
    setOrderItems(itemsToReorder.map(item => ({
      inventory_id: item.id,
      name: item.name,
      quantity: item.reorder_threshold * 2 - item.quantity,
      unit_price: item.unit_price || 0,
    })));
    setQuickReorderOpen(true);
  }

  function exportToCSV() {
    const headers = ['Name', 'Category', 'Quantity', 'Unit', 'Storage Temp', 'Hazard Class', 'Location', 'Expires On', 'Barcode'];
    const rows = filteredItems.map(i => [
      i.name, i.category, i.quantity, i.unit, i.storage_temp || 'RT',
      i.hazard_class || 'None', i.storage_location, i.expires_on || '', i.barcode
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported to CSV');
  }

  const columns: Column<InventoryItem>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
          onChange={(e) => e.target.checked ? selectAllItems() : clearSelection()}
        />
      ),
      width: '40px',
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedItems.has(r.id)}
          onChange={() => toggleSelectItem(r.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: 'favorite',
      header: '★',
      width: '40px',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(r.id); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
        >
          {favorites.has(r.id) ? '⭐' : '☆'}
        </button>
      ),
    },
    {
      key: 'name',
      header: 'Item',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            {r.name}
            {r.hazard_class && r.hazard_class !== 'None' && (
              <span title={GHS_HAZARDS[r.hazard_class]?.description || r.hazard_class}>
                {GHS_HAZARDS[r.hazard_class]?.icon || '⚠️'}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
            {r.catalog_number && <span>Cat# {r.catalog_number}</span>}
            {r.lot_number && <span>Lot# {r.lot_number}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => (
        <span style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 500,
          background: '#f1f5f9',
          color: '#475569',
        }}>{r.category}</span>
      ),
    },
    {
      key: 'quantity',
      header: 'Stock',
      width: '120px',
      render: (r) => {
        const isLow = r.quantity > 0 && r.quantity <= r.reorder_threshold;
        const isOut = r.quantity === 0;
        const percent = r.reorder_threshold > 0 ? Math.min(100, (r.quantity / (r.reorder_threshold * 2)) * 100) : 100;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, color: isOut ? '#dc2626' : isLow ? '#f59e0b' : '#22c55e' }}>
                {r.quantity}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.unit}</span>
            </div>
            <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${percent}%`,
                background: isOut ? '#dc2626' : isLow ? '#f59e0b' : '#22c55e',
                borderRadius: 2,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'storage',
      header: 'Storage',
      width: '100px',
      render: (r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: r.storage_temp === '-80C' ? '#1e40af' : r.storage_temp === '-20C' ? '#4338ca' : r.storage_temp === '4C' ? '#166534' : r.storage_temp === 'LN2' ? '#0891b2' : '#6b7280',
            color: '#fff',
          }}>
            {r.storage_temp === '-80C' ? '🧊' : r.storage_temp === '-20C' ? '❄️' : r.storage_temp === '4C' ? '🌡️' : r.storage_temp === 'LN2' ? '🥶' : '📦'}
            {r.storage_temp || 'RT'}
          </span>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (r) => <span style={{ fontSize: 12 }}>{r.storage_location || '—'}</span>,
    },
    {
      key: 'expires_on',
      header: 'Expires',
      width: '100px',
      render: (r) => {
        if (!r.expires_on) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        const d = new Date(r.expires_on);
        const isExpired = d < now;
        const isUrgent = d <= in7;
        const isSoon = d <= in30;
        return (
          <div style={{
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: isExpired ? '#fef2f2' : isUrgent ? '#fef3c7' : isSoon ? '#fefce8' : '#f0fdf4',
            color: isExpired ? '#dc2626' : isUrgent ? '#d97706' : isSoon ? '#ca8a04' : '#16a34a',
          }}>
            {isExpired ? '⚠️ EXPIRED' : isUrgent ? `⏰ ${Math.ceil((d.getTime() - now.getTime()) / (24*60*60*1000))}d` : r.expires_on}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Quick',
      width: '80px',
      render: (r) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); openUsageLog(r); }}
            title="Log Usage"
            style={{ padding: '4px 8px', borderRadius: 4, background: '#dbeafe', border: 'none', cursor: 'pointer', fontSize: 12 }}
          >
            📝
          </button>
        </div>
      ),
    },
  ];

  const TABS = [
    { key: 'dashboard' as TabType, label: 'Dashboard', icon: '🏠' },
    { key: 'inventory' as TabType, label: 'Inventory', icon: '📦', badge: stats.lowStock.length + stats.outOfStock.length },
    { key: 'suppliers' as TabType, label: 'Suppliers', icon: '🏢' },
    { key: 'orders' as TabType, label: 'Orders', icon: '📋', badge: orders.filter(o => o.status === 'pending_approval' || o.status === 'draft').length },
    { key: 'iot' as TabType, label: 'IoT Monitor', icon: '🌡️', badge: iotDevices.filter(d => d.status === 'warning' || d.status === 'critical').length },
    { key: 'storage' as TabType, label: 'Storage', icon: '🗺️' },
    { key: 'waste' as TabType, label: 'Waste', icon: '♻️', badge: wasteRecords.filter(w => w.status === 'pending').length },
    { key: 'labels' as TabType, label: 'Labels', icon: '🏷️' },
    { key: 'sds' as TabType, label: 'SDS Library', icon: '📜' },
    { key: 'coa' as TabType, label: 'COA/Certs', icon: '📄', badge: coaDocuments.filter(c => c.status === 'expiring' || c.status === 'expired').length },
    { key: 'calculator' as TabType, label: 'Calculator', icon: '🧮' },
    { key: 'sharing' as TabType, label: 'Sharing', icon: '🤝', badge: sharedMaterials.filter(s => s.status === 'requested').length },
    { key: 'recurring' as TabType, label: 'Recurring', icon: '🔄' },
    { key: 'compliance' as TabType, label: 'Compliance', icon: '📋' },
    { key: 'analytics' as TabType, label: 'Analytics', icon: '📊' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      {/* Premium Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
        padding: '20px 24px',
        color: '#fff',
        borderBottom: '3px solid #6366f1',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>🔬</span>
              <div>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
                  LabOS Inventory & Procurement
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.8 }}>
                  AI-Powered Lab Resource Management • {total} Items Tracked
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Quick Action Buttons */}
            <button
              onClick={() => setScannerOpen(true)}
              style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📷 Scan
            </button>
            <button
              onClick={exportToCSV}
              style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📥 Export
            </button>
            <button
              onClick={openCreate}
              style={{ padding: '10px 20px', borderRadius: 10, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}
            >
              + Add Item
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 20 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '12px 20px',
                borderRadius: '12px 12px 0 0',
                background: activeTab === t.key ? '#fff' : 'rgba(255,255,255,0.05)',
                color: activeTab === t.key ? '#1e293b' : 'rgba(255,255,255,0.7)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === t.key ? 700 : 500,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.badge && t.badge > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 10,
                  minWidth: 18,
                  textAlign: 'center',
                }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Critical Alerts */}
            {(stats.outOfStock.length > 0 || stats.expiringIn7.length > 0 || stats.expiredItems.length > 0) && (
              <div style={{
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                border: '2px solid #fca5a5',
                borderRadius: 16,
                padding: '20px 24px',
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 40 }}>🚨</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#991b1b' }}>Critical Attention Required</div>
                      <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                        {stats.expiredItems.length > 0 && (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>☠️ {stats.expiredItems.length} EXPIRED</span>
                        )}
                        {stats.outOfStock.length > 0 && (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>❌ {stats.outOfStock.length} out of stock</span>
                        )}
                        {stats.expiringIn7.length > 0 && (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>⏰ {stats.expiringIn7.length} expiring in 7 days</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={generateQuickReorderList}
                    style={{
                      padding: '12px 24px',
                      borderRadius: 10,
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: 14,
                      boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
                    }}
                  >
                    🛒 Quick Reorder All
                  </button>
                </div>
              </div>
            )}

            {/* Smart Reorder AI Panel */}
            {smartReorderPredictions.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
                borderRadius: 20,
                padding: '24px',
                marginBottom: 24,
                color: '#fff',
              }}>
                <div
                  onClick={() => setSmartReorderExpanded(!smartReorderExpanded)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}>
                      🤖
                    </div>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>AI Smart Reorder Predictions</div>
                      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
                        {smartReorderPredictions.filter(p => p.urgency === 'critical').length} critical •{' '}
                        {smartReorderPredictions.filter(p => p.urgency === 'high').length} high priority •{' '}
                        {smartReorderPredictions.length} total recommendations
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '8px 16px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                    }}>
                      Est. ${smartReorderPredictions.reduce((sum, p) => sum + p.estimatedCost, 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <span style={{ fontSize: 20, transition: 'transform 0.2s', transform: smartReorderExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </div>
                </div>

                {smartReorderExpanded && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12, marginTop: 20 }}>
                      {smartReorderPredictions.slice(0, 6).map((pred) => {
                        const urgencyColors = {
                          critical: { bg: '#dc2626', text: '#fff', badge: '🚨 CRITICAL' },
                          high: { bg: '#f59e0b', text: '#000', badge: '⚠️ HIGH' },
                          medium: { bg: '#3b82f6', text: '#fff', badge: '📊 MEDIUM' },
                          low: { bg: '#6b7280', text: '#fff', badge: '📋 LOW' },
                        };
                        const urgencyStyle = urgencyColors[pred.urgency];

                        return (
                          <div
                            key={pred.item.id}
                            style={{
                              background: 'rgba(255,255,255,0.95)',
                              borderRadius: 14,
                              padding: '18px',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Urgency indicator */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              background: urgencyStyle.bg,
                              color: urgencyStyle.text,
                              padding: '4px 12px',
                              borderRadius: '0 14px 0 10px',
                              fontSize: 10,
                              fontWeight: 800,
                            }}>
                              {urgencyStyle.badge}
                            </div>

                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', paddingRight: 80 }}>{pred.item.name}</div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{pred.item.category}</div>
                            </div>

                            {/* Current stock visual */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                  <span style={{ color: '#64748b' }}>Current Stock</span>
                                  <span style={{ fontWeight: 700, color: pred.item.quantity === 0 ? '#dc2626' : '#1e293b' }}>
                                    {pred.item.quantity} {pred.item.unit}
                                  </span>
                                </div>
                                <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (pred.item.quantity / (pred.item.reorder_threshold * 2 || 10)) * 100)}%`,
                                    background: pred.item.quantity === 0 ? '#dc2626' : pred.item.quantity <= pred.item.reorder_threshold ? '#f59e0b' : '#22c55e',
                                    borderRadius: 3,
                                  }} />
                                </div>
                              </div>
                            </div>

                            {/* AI Prediction reason */}
                            <div style={{
                              background: '#f8fafc',
                              borderRadius: 8,
                              padding: '10px 12px',
                              marginBottom: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}>
                              <span style={{ fontSize: 14 }}>🔮</span>
                              <div>
                                <div style={{ fontSize: 12, color: '#1e293b', fontWeight: 500 }}>{pred.reason}</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>
                                  {pred.daysUntilStockout < 999 ? `~${pred.daysUntilStockout} days until stockout` : 'Monitor usage'}
                                </div>
                              </div>
                            </div>

                            {/* Recommendation */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Suggested Order</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>
                                  {pred.suggestedQty} {pred.item.unit}
                                </div>
                                <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>${pred.estimatedCost.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: pred.confidence >= 90 ? '#dcfce7' : pred.confidence >= 75 ? '#fef3c7' : '#f1f5f9',
                                  color: pred.confidence >= 90 ? '#166534' : pred.confidence >= 75 ? '#92400e' : '#64748b',
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}>
                                  {pred.confidence}% confidence
                                </div>
                                {pred.recommendedSupplier && (
                                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                                    via {pred.recommendedSupplier.company}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          const criticalItems = smartReorderPredictions.filter(p => p.urgency === 'critical' || p.urgency === 'high');
                          setOrderItems(criticalItems.map(p => ({
                            inventory_id: p.item.id,
                            name: p.item.name,
                            quantity: p.suggestedQty,
                            unit_price: p.item.unit_price || 0,
                          })));
                          setQuickReorderOpen(true);
                        }}
                        style={{
                          padding: '12px 24px',
                          borderRadius: 12,
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        🚨 Order Critical ({smartReorderPredictions.filter(p => p.urgency === 'critical' || p.urgency === 'high').length})
                      </button>
                      <button
                        onClick={() => {
                          setOrderItems(smartReorderPredictions.map(p => ({
                            inventory_id: p.item.id,
                            name: p.item.name,
                            quantity: p.suggestedQty,
                            unit_price: p.item.unit_price || 0,
                          })));
                          setQuickReorderOpen(true);
                        }}
                        style={{
                          padding: '12px 24px',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.2)',
                          color: '#fff',
                          border: '2px solid rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        📦 Order All Recommendations
                      </button>
                      {smartReorderPredictions.length > 6 && (
                        <button
                          onClick={() => setActiveTab('inventory')}
                          style={{
                            padding: '12px 24px',
                            borderRadius: 12,
                            background: 'transparent',
                            color: '#fff',
                            border: '2px solid rgba(255,255,255,0.3)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          View All {smartReorderPredictions.length} Items →
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Items', value: stats.total, icon: '📦', color: '#6366f1', bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' },
                { label: 'Healthy Stock', value: stats.healthyStock, icon: '✅', color: '#22c55e', bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' },
                { label: 'Low Stock', value: stats.lowStock.length, icon: '⚠️', color: '#f59e0b', bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' },
                { label: 'Out of Stock', value: stats.outOfStock.length, icon: '❌', color: '#dc2626', bg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' },
                { label: 'Total Value', value: `$${(stats.totalValue / 100).toLocaleString()}`, icon: '💰', color: '#0ea5e9', bg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: s.bg,
                  borderRadius: 16,
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 36, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                    </div>
                    <span style={{ fontSize: 32, opacity: 0.8 }}>{s.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Expiration Timeline - Enhanced Dashboard */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    ⏰ Expiration Dashboard
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setActiveTab('inventory'); setStockFilter('expiring'); }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        color: '#64748b',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      View All →
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Expired', items: stats.expiredItems, color: '#dc2626', bg: '#fef2f2', icon: '☠️', action: 'Dispose' },
                    { label: 'Expiring in 7 Days', items: stats.expiringIn7, color: '#f59e0b', bg: '#fffbeb', icon: '🚨', action: 'Use Now' },
                    { label: 'Expiring in 30 Days', items: stats.expiringIn30, color: '#ca8a04', bg: '#fefce8', icon: '⚠️', action: 'Plan Usage' },
                    { label: 'Expiring in 90 Days', items: stats.expiringIn90, color: '#22c55e', bg: '#f0fdf4', icon: '📅', action: 'Monitor' },
                  ].map(period => (
                    <div
                      key={period.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 16px',
                        background: period.bg,
                        borderRadius: 10,
                        borderLeft: `4px solid ${period.color}`,
                        cursor: period.items.length > 0 ? 'pointer' : 'default',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                      }}
                      onClick={() => period.items.length > 0 && setActiveTab('inventory')}
                      onMouseOver={(e) => period.items.length > 0 && (e.currentTarget.style.transform = 'translateX(4px)')}
                      onMouseOut={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
                    >
                      <span style={{ fontSize: 24 }}>{period.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: period.color, fontSize: 14 }}>{period.label}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {period.items.length > 0
                            ? period.items.slice(0, 2).map(i => i.name).join(', ') + (period.items.length > 2 ? ` +${period.items.length - 2} more` : '')
                            : 'No items'
                          }
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: period.color }}>{period.items.length}</div>
                        {period.items.length > 0 && (
                          <div style={{
                            fontSize: 10,
                            color: period.color,
                            fontWeight: 600,
                            padding: '2px 8px',
                            background: `${period.color}15`,
                            borderRadius: 4,
                            marginTop: 4,
                          }}>
                            {period.action}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Quick Actions for Expiring Items */}
                {(stats.expiredItems.length > 0 || stats.expiringIn7.length > 0) && (
                  <div style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>💡</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                        {stats.expiredItems.length + stats.expiringIn7.length} items need immediate attention
                      </span>
                    </div>
                    <button
                      onClick={generateQuickReorderList}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🛒 Reorder Replacements
                    </button>
                  </div>
                )}
              </div>

              {/* Storage Temperature Distribution */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🌡️ Storage Distribution
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { temp: '-80C', icon: '🧊', color: '#1e40af', label: 'Ultra-Low Freezer' },
                    { temp: '-20C', icon: '❄️', color: '#4338ca', label: 'Freezer' },
                    { temp: '4C', icon: '🌡️', color: '#166534', label: 'Refrigerator' },
                    { temp: 'RT', icon: '📦', color: '#6b7280', label: 'Room Temperature' },
                    { temp: 'LN2', icon: '🥶', color: '#0891b2', label: 'Liquid Nitrogen' },
                  ].map(s => {
                    const count = stats.byTemp[s.temp] || 0;
                    const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={s.temp} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 20 }}>{s.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{count}</span>
                          </div>
                          <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percent}%`, background: s.color, borderRadius: 4, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hazardous Materials */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ☣️ Hazardous Materials ({stats.hazardous.length})
                </h3>
                {stats.hazardous.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                    <span style={{ fontSize: 32 }}>✅</span>
                    <div style={{ marginTop: 8 }}>No hazardous materials tracked</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(
                      stats.hazardous.reduce((acc, i) => {
                        acc[i.hazard_class] = (acc[i.hazard_class] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([hazard, count]) => (
                      <div
                        key={hazard}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: `${GHS_HAZARDS[hazard]?.color || '#6b7280'}15`,
                          border: `2px solid ${GHS_HAZARDS[hazard]?.color || '#6b7280'}`,
                        }}
                      >
                        <span style={{ fontSize: 24 }}>{GHS_HAZARDS[hazard]?.icon || '⚠️'}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: GHS_HAZARDS[hazard]?.color || '#6b7280' }}>{hazard}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{count} items</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Orders */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📋 Recent Orders
                </h3>
                {orders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                    <span style={{ fontSize: 32 }}>📦</span>
                    <div style={{ marginTop: 8 }}>No orders yet</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {orders.slice(0, 5).map(o => (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{o.po_number}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{o.supplier_name}</div>
                        </div>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          background: o.status === 'received' ? '#dcfce7' : o.status === 'ordered' ? '#dbeafe' : '#fef3c7',
                          color: o.status === 'received' ? '#166534' : o.status === 'ordered' ? '#1e40af' : '#92400e',
                        }}>{o.status.toUpperCase()}</span>
                        <span style={{ fontWeight: 700, color: '#6366f1' }}>${(o.total / 100).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <>
            {/* Advanced Filter Bar */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
                  <input
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 42px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 12,
                      fontSize: 14,
                      transition: 'border-color 0.2s',
                    }}
                    placeholder="Search by name, barcode, location, catalog#..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Filters */}
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 13, fontWeight: 500, background: stockFilter !== 'all' ? '#eef2ff' : '#fff' }}
                >
                  <option value="all">All Stock</option>
                  <option value="low">🔴 Low Stock</option>
                  <option value="out">❌ Out of Stock</option>
                  <option value="expiring">⏰ Expiring Soon</option>
                  <option value="favorites">⭐ Favorites</option>
                </select>

                <select
                  value={tempFilter}
                  onChange={(e) => setTempFilter(e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 13, fontWeight: 500, background: tempFilter !== 'all' ? '#e0f2fe' : '#fff' }}
                >
                  <option value="all">All Temps</option>
                  <option value="-80C">🧊 -80°C</option>
                  <option value="-20C">❄️ -20°C</option>
                  <option value="4C">🌡️ 4°C</option>
                  <option value="RT">📦 RT</option>
                  <option value="LN2">🥶 LN2</option>
                </select>

                <select
                  value={hazardFilter}
                  onChange={(e) => setHazardFilter(e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 13, fontWeight: 500, background: hazardFilter !== 'all' ? '#fef3c7' : '#fff' }}
                >
                  <option value="all">All Hazards</option>
                  <option value="hazardous">☣️ Hazardous Only</option>
                  {Object.keys(GHS_HAZARDS).map(h => (
                    <option key={h} value={h}>{GHS_HAZARDS[h].icon} {h}</option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ padding: '12px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 13, fontWeight: 500, background: categoryFilter !== 'all' ? '#f0fdf4' : '#fff' }}
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {/* View Mode Toggle */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
                  {(['table', 'grid'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: viewMode === mode ? '#fff' : 'transparent',
                        cursor: 'pointer',
                        fontWeight: viewMode === mode ? 600 : 400,
                        boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      {mode === 'table' ? '📋' : '🔲'}
                    </button>
                  ))}
                </div>

                {/* Filter Actions */}
                {hasActiveFilter && (
                  <button
                    onClick={clearAllFilters}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    ✕ Clear
                  </button>
                )}
                {hasActiveFilter && (
                  <button
                    onClick={() => setShowSaveFilterInput(true)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: '#6366f1',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    💾 Save Filter
                  </button>
                )}
              </div>

              {/* Save Filter Input */}
              {showSaveFilterInput && (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid #e2e8f0',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 14 }}>💾</span>
                  <input
                    style={{
                      flex: 1,
                      maxWidth: 250,
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '2px solid #6366f1',
                      fontSize: 13,
                    }}
                    placeholder="Enter filter name..."
                    value={filterNameInput}
                    onChange={(e) => setFilterNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveCurrentFilter()}
                    autoFocus
                  />
                  <button
                    onClick={saveCurrentFilter}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 8,
                      background: '#6366f1',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowSaveFilterInput(false); setFilterNameInput(''); }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: '#f1f5f9',
                      color: '#64748b',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Saved Filters */}
              {savedFilters.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid #e2e8f0',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Saved Filters:</span>
                  {savedFilters.map(filter => (
                    <div
                      key={filter.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: '#f1f5f9',
                        fontSize: 12,
                      }}
                    >
                      <button
                        onClick={() => loadSavedFilter(filter)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 600,
                          color: '#6366f1',
                          padding: 0,
                        }}
                      >
                        {filter.name}
                      </button>
                      <button
                        onClick={() => deleteSavedFilter(filter.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#dc2626',
                          padding: 0,
                          fontSize: 14,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Selection Actions */}
              {selectedItems.size > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>{selectedItems.size} selected</span>
                  <button onClick={clearSelection} style={{ padding: '6px 12px', borderRadius: 6, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                    Clear
                  </button>
                  <button style={{ padding: '6px 12px', borderRadius: 6, background: '#dbeafe', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                    📤 Export Selected
                  </button>
                  <button style={{ padding: '6px 12px', borderRadius: 6, background: '#dcfce7', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                    🛒 Add to Order
                  </button>
                </div>
              )}
            </div>

            {/* Results Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                Showing {filteredItems.length} of {items.length} items
              </span>
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Table
                  columns={columns}
                  data={filteredItems}
                  loading={loading}
                  rowKey={(r) => r.id}
                  onEdit={openEdit}
                  onDelete={(r) => setDeleting(r)}
                />
              </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {filteredItems.map(item => {
                  const isLow = item.quantity > 0 && item.quantity <= item.reorder_threshold;
                  const isOut = item.quantity === 0;
                  const isExpiring = item.expires_on && new Date(item.expires_on) <= in30;
                  return (
                    <div
                      key={item.id}
                      onClick={() => openEdit(item)}
                      style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: '20px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        border: `2px solid ${isOut ? '#fca5a5' : isLow ? '#fcd34d' : '#e2e8f0'}`,
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: item.storage_temp === '-80C' ? '#1e40af' : item.storage_temp === '-20C' ? '#4338ca' : item.storage_temp === '4C' ? '#166534' : '#6b7280',
                            color: '#fff',
                            fontSize: 18,
                          }}>
                            {item.storage_temp === '-80C' ? '🧊' : item.storage_temp === '-20C' ? '❄️' : item.storage_temp === '4C' ? '🌡️' : '📦'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{item.category}</div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
                        >
                          {favorites.has(item.id) ? '⭐' : '☆'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 28, fontWeight: 800, color: isOut ? '#dc2626' : isLow ? '#f59e0b' : '#22c55e' }}>
                          {item.quantity}
                        </span>
                        <span style={{ fontSize: 13, color: '#64748b' }}>{item.unit}</span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (item.quantity / (item.reorder_threshold * 2 || 10)) * 100)}%`,
                          background: isOut ? '#dc2626' : isLow ? '#f59e0b' : '#22c55e',
                          borderRadius: 3,
                        }} />
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.hazard_class && item.hazard_class !== 'None' && (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            background: `${GHS_HAZARDS[item.hazard_class]?.color || '#6b7280'}20`,
                            color: GHS_HAZARDS[item.hazard_class]?.color || '#6b7280',
                          }}>
                            {GHS_HAZARDS[item.hazard_class]?.icon} {item.hazard_class}
                          </span>
                        )}
                        {isExpiring && (
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: '#fef3c7', color: '#d97706' }}>
                            ⏰ Expiring
                          </span>
                        )}
                        {item.storage_location && (
                          <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, background: '#f1f5f9', color: '#64748b' }}>
                            📍 {item.storage_location}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Pagination page={page} pages={pages} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} />
          </>
        )}

        {/* STORAGE MAP TAB */}
        {activeTab === 'storage' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>🗺️ Lab Storage Map</h2>
              <p style={{ margin: 0, color: '#64748b' }}>Visual overview of storage locations and their contents</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {STORAGE_LOCATIONS.map(loc => {
                const locStats = storageStats[loc.id];
                const usagePercent = loc.capacity > 0 ? (locStats.count / loc.capacity) * 100 : 0;
                const tempColor = loc.type === '-80C' ? '#1e40af' : loc.type === '-20C' ? '#4338ca' : loc.type === '4C' ? '#166534' : loc.type === 'LN2' ? '#0891b2' : '#6b7280';

                return (
                  <div
                    key={loc.id}
                    style={{
                      background: '#fff',
                      borderRadius: 16,
                      padding: '24px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      border: `2px solid ${usagePercent > 80 ? '#fca5a5' : '#e2e8f0'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: tempColor,
                        color: '#fff',
                        fontSize: 24,
                      }}>
                        {loc.icon}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{loc.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{loc.type} Storage</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Capacity</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: tempColor }}>{locStats.count} / {loc.capacity}</span>
                      </div>
                      <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, usagePercent)}%`,
                          background: usagePercent > 80 ? '#dc2626' : usagePercent > 60 ? '#f59e0b' : tempColor,
                          borderRadius: 5,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>

                    {locStats.items.length > 0 ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Items:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {locStats.items.slice(0, 5).map(item => (
                            <span key={item.id} style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4 }}>
                              {item.name}
                            </span>
                          ))}
                          {locStats.items.length > 5 && (
                            <span style={{ padding: '2px 8px', background: '#e0e7ff', borderRadius: 4, fontWeight: 600, color: '#6366f1' }}>
                              +{locStats.items.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                        No items assigned
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUPPLIERS TAB */}
        {activeTab === 'suppliers' && (
          <>
            {/* AI Search */}
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: 20,
              padding: '32px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <span style={{ fontSize: 48 }}>🤖</span>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>AI Supplier Intelligence</div>
                  <div style={{ fontSize: 14, opacity: 0.9 }}>Describe your needs in natural language and let AI find the perfect suppliers</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  style={{
                    flex: 1,
                    padding: '16px 20px',
                    borderRadius: 14,
                    border: 'none',
                    fontSize: 16,
                    background: 'rgba(255,255,255,0.95)',
                  }}
                  placeholder="e.g., PCR master mix for high-throughput screening, qPCR primers, ELISA kits for cytokine detection..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                />
                <button
                  onClick={handleAiSearch}
                  disabled={aiLoading}
                  style={{
                    padding: '16px 32px',
                    borderRadius: 14,
                    background: '#fff',
                    color: '#6366f1',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 16,
                  }}
                >
                  {aiLoading ? '🔍 Searching...' : '✨ Find Suppliers'}
                </button>
              </div>

              {aiRecommendations.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🎯 Top Recommendations</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {aiRecommendations.slice(0, 6).map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => setViewingSupplier(rec)}
                        style={{
                          background: 'rgba(255,255,255,0.95)',
                          borderRadius: 12,
                          padding: '16px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>{rec.company}</div>
                          <span style={{ background: '#22c55e', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                            {rec.relevance_score}% match
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{rec.match_reason}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {rec.is_preferred && <span style={{ background: '#dcfce7', color: '#166534', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>⭐ Preferred</span>}
                          <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{rec.budget_tier}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            {supplierStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Total Suppliers', value: supplierStats.total, icon: '🏢', color: '#6366f1' },
                  { label: 'Preferred', value: supplierStats.preferred, icon: '⭐', color: '#22c55e' },
                  { label: 'Approved', value: supplierStats.approved, icon: '✓', color: '#0ea5e9' },
                  { label: 'Pending Review', value: supplierStats.pending_review, icon: '⏳', color: '#f59e0b' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <span style={{ fontSize: 28 }}>{s.icon}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input
                style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '2px solid #e2e8f0', background: '#fff', fontSize: 14 }}
                placeholder="Search suppliers..."
                value={supplierSearch}
                onChange={(e) => { setSupplierSearch(e.target.value); setTimeout(loadSuppliers, 300); }}
              />
            </div>

            {/* Suppliers Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {suppliers.map(s => (
                <div
                  key={s.id}
                  onClick={() => setViewingSupplier(s)}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: '20px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    border: s.is_preferred ? '2px solid #22c55e' : '2px solid #e2e8f0',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.company}
                        {s.is_preferred && <span style={{ background: '#22c55e', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 4 }}>PREFERRED</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{s.supplier_id}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[1,2,3,4,5].map(i => (
                        <span key={i} style={{ color: i <= s.rating ? '#fbbf24' : '#e5e7eb', fontSize: 12 }}>★</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{s.category.split(',')[0]}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: s.budget_tier === 'Premium' ? '#fef3c7' : s.budget_tier === 'Mid-market' ? '#dbeafe' : '#f3f4f6',
                      color: s.budget_tier === 'Premium' ? '#92400e' : s.budget_tier === 'Mid-market' ? '#1e40af' : '#4b5563',
                    }}>{s.budget_tier}</span>
                    <span style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: s.procurement_priority === 'High' ? '#fee2e2' : '#f3f4f6',
                      color: s.procurement_priority === 'High' ? '#dc2626' : '#6b7280',
                    }}>{s.procurement_priority}</span>
                    {s.research_use && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: 8, fontSize: 10 }}>Research</span>}
                    {s.clinical_use && <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: 8, fontSize: 10 }}>Clinical</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <>
            {orderStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Total Orders', value: orderStats.total_orders, icon: '📋', color: '#6366f1' },
                  { label: 'Pending Approval', value: orderStats.pending_approval, icon: '⏳', color: '#f59e0b' },
                  { label: 'In Transit', value: orderStats.in_transit, icon: '🚚', color: '#0ea5e9' },
                  { label: 'Total Spend', value: `$${((orderStats.total_spend || 0) / 100).toLocaleString()}`, icon: '💰', color: '#22c55e' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <span style={{ fontSize: 28 }}>{s.icon}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Purchase Orders</h3>
              <button
                onClick={() => setOrderModal(true)}
                style={{ padding: '10px 20px', borderRadius: 10, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                + New Order
              </button>
            </div>

            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              {orders.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                  <span style={{ fontSize: 64 }}>📋</span>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 16 }}>No purchase orders yet</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>Create your first order to track procurement</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>PO Number</th>
                      <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Supplier</th>
                      <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Status</th>
                      <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Items</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Total</th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 700 }}>{o.po_number}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(o.created_at).toLocaleDateString()}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>{o.supplier_name}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: o.status === 'received' ? '#dcfce7' : o.status === 'ordered' || o.status === 'shipped' ? '#dbeafe' : o.status === 'approved' ? '#fef3c7' : '#f3f4f6',
                            color: o.status === 'received' ? '#166534' : o.status === 'ordered' || o.status === 'shipped' ? '#1e40af' : o.status === 'approved' ? '#92400e' : '#4b5563',
                          }}>{o.status.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>{o.items?.length || 0} items</td>
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, fontSize: 16 }}>${(o.total / 100).toFixed(2)}</td>
                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                          {(o.status === 'draft' || o.status === 'pending_approval') && (
                            <button onClick={() => approveOrder(o.id)} style={{ padding: '6px 14px', borderRadius: 8, background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                              ✓ Approve
                            </button>
                          )}
                          {(o.status === 'ordered' || o.status === 'shipped') && (
                            <button onClick={() => receiveOrder(o.id)} style={{ padding: '6px 14px', borderRadius: 8, background: '#0ea5e9', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                              📦 Receive
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && supplierStats && (
          <div>
            {/* Usage Analytics Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                {
                  label: 'Avg Consumption Rate',
                  value: items.length > 0 ? `${Math.round(items.reduce((sum, i) => sum + (i.reorder_threshold || 0), 0) / items.length / 7 * 10) / 10}/day` : '0/day',
                  icon: '📈',
                  color: '#6366f1',
                  bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                },
                {
                  label: 'Est. Monthly Spend',
                  value: `$${Math.round(items.reduce((sum, i) => sum + ((i.reorder_threshold || 0) * 4 * (i.unit_price || 0) / 100), 0)).toLocaleString()}`,
                  icon: '💰',
                  color: '#22c55e',
                  bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                },
                {
                  label: 'Items Below Threshold',
                  value: stats.lowStock.length + stats.outOfStock.length,
                  icon: '⚠️',
                  color: '#f59e0b',
                  bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                },
                {
                  label: 'Inventory Turnover',
                  value: items.length > 0 ? `${Math.round((stats.lowStock.length + stats.outOfStock.length) / items.length * 100)}%` : '0%',
                  icon: '🔄',
                  color: '#0ea5e9',
                  bg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                    </div>
                    <span style={{ fontSize: 28, opacity: 0.8 }}>{s.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Consumption Forecast Panel */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: 20,
              padding: '24px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <span style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}>📊</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>Consumption Forecast</div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>AI-predicted usage patterns for next 30 days</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {/* High Consumption Items */}
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: '#ef4444', width: 8, height: 8, borderRadius: '50%' }} />
                    High Consumption Rate
                  </div>
                  {items
                    .filter(i => i.reorder_threshold > 0 && (i.quantity / i.reorder_threshold) < 2)
                    .slice(0, 4)
                    .map(i => (
                      <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: 13, opacity: 0.9 }}>{i.name.slice(0, 20)}{i.name.length > 20 ? '...' : ''}</span>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>{Math.round((i.reorder_threshold || 1) / 7 * 10) / 10}/day</span>
                      </div>
                    ))
                  }
                  {items.filter(i => i.reorder_threshold > 0 && (i.quantity / i.reorder_threshold) < 2).length === 0 && (
                    <div style={{ fontSize: 12, opacity: 0.5, padding: '12px 0' }}>No high consumption items</div>
                  )}
                </div>

                {/* Stable Items */}
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: '#22c55e', width: 8, height: 8, borderRadius: '50%' }} />
                    Stable Inventory
                  </div>
                  {items
                    .filter(i => i.quantity > (i.reorder_threshold || 0) * 2)
                    .slice(0, 4)
                    .map(i => (
                      <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: 13, opacity: 0.9 }}>{i.name.slice(0, 20)}{i.name.length > 20 ? '...' : ''}</span>
                        <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Well stocked</span>
                      </div>
                    ))
                  }
                </div>

                {/* Expiring Soon */}
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: '#f59e0b', width: 8, height: 8, borderRadius: '50%' }} />
                    Expiring Items to Use
                  </div>
                  {[...stats.expiringIn7, ...stats.expiringIn30].slice(0, 4).map(i => {
                    const daysLeft = i.expires_on ? Math.ceil((new Date(i.expires_on).getTime() - now.getTime()) / (24*60*60*1000)) : 0;
                    return (
                      <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: 13, opacity: 0.9 }}>{i.name.slice(0, 20)}{i.name.length > 20 ? '...' : ''}</span>
                        <span style={{ fontSize: 12, color: daysLeft <= 7 ? '#ef4444' : '#f59e0b' }}>{daysLeft}d left</span>
                      </div>
                    );
                  })}
                  {stats.expiringIn7.length + stats.expiringIn30.length === 0 && (
                    <div style={{ fontSize: 12, opacity: 0.5, padding: '12px 0' }}>No items expiring soon</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {/* Category Distribution */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>📊 Inventory by Category</h3>
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                const percent = (count / stats.total) * 100;
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{cat}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>{count} ({percent.toFixed(0)}%)</span>
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, background: '#6366f1', borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Supplier Categories */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>🏢 Suppliers by Category</h3>
              {supplierStats.by_category?.slice(0, 6).map((c: any) => (
                <div key={c.name} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{c.name?.split(',')[0] || 'Other'}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{c.value}</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(c.value / supplierStats.total) * 100}%`, background: '#8b5cf6', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Stock Health */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>💚 Stock Health</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {[
                  { label: 'Healthy', value: stats.healthyStock, color: '#22c55e', icon: '✅' },
                  { label: 'Low', value: stats.lowStock.length, color: '#f59e0b', icon: '⚠️' },
                  { label: 'Out', value: stats.outOfStock.length, color: '#dc2626', icon: '❌' },
                  { label: 'Expiring', value: stats.expiringIn30.length + stats.expiringIn7.length, color: '#f97316', icon: '⏰' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#f8fafc', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
                    <span style={{ fontSize: 32 }}>{s.icon}</span>
                    <div style={{ fontSize: 36, fontWeight: 800, color: s.color, marginTop: 8 }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget Tiers */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>💰 Budget Tiers</h3>
              {supplierStats.by_budget_tier?.map((t: any) => {
                const colors: Record<string, string> = { 'Premium': '#8b5cf6', 'Mid-market': '#0ea5e9', 'Economy': '#22c55e' };
                return (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '16px', background: '#f8fafc', borderRadius: 12 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: colors[t.name] || '#6b7280' }} />
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{t.name}</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: colors[t.name] || '#6b7280' }}>{t.value}</span>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        )}

        {/* IOT MONITORING TAB */}
        {activeTab === 'iot' && (
          <div>
            {/* IoT Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
              borderRadius: 20,
              padding: '24px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                  }}>📡</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>IoT Equipment Monitoring</h2>
                    <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                      Real-time temperature & environmental monitoring • {iotDevices.length} devices connected
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ textAlign: 'center', padding: '12px 20px', background: 'rgba(34,197,94,0.2)', borderRadius: 12 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{iotDevices.filter(d => d.status === 'normal').length}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Normal</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '12px 20px', background: 'rgba(245,158,11,0.2)', borderRadius: 12 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{iotDevices.filter(d => d.status === 'warning').length}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Warning</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '12px 20px', background: 'rgba(220,38,38,0.2)', borderRadius: 12 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{iotDevices.filter(d => d.status === 'critical').length}</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Critical</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Device Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
              {iotDevices.map(device => {
                const statusColors = {
                  normal: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
                  warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
                  critical: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
                  offline: { bg: '#f1f5f9', border: '#94a3b8', text: '#475569' },
                };
                const colors = statusColors[device.status];
                const tempDiff = Math.abs(device.currentTemp - device.targetTemp);

                return (
                  <div
                    key={device.id}
                    style={{
                      background: '#fff',
                      borderRadius: 16,
                      padding: '24px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      border: `2px solid ${colors.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 24 }}>
                            {device.type === 'freezer' ? '🧊' : device.type === 'fridge' ? '🌡️' : device.type === 'incubator' ? '🔬' : device.type === 'ln2' ? '🥶' : '🏠'}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 16 }}>{device.name}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Last reading: {new Date(device.lastReading).toLocaleTimeString()}</div>
                      </div>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: colors.bg,
                        color: colors.text,
                        textTransform: 'uppercase',
                      }}>
                        {device.status === 'normal' ? '✓ Normal' : device.status === 'warning' ? '⚠️ Warning' : device.status === 'critical' ? '🚨 Critical' : '⚫ Offline'}
                      </span>
                    </div>

                    {/* Temperature Display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 42, fontWeight: 800, color: tempDiff > 2 ? '#dc2626' : tempDiff > 1 ? '#f59e0b' : '#22c55e' }}>
                          {device.currentTemp.toFixed(1)}°C
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Current</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Target: {device.targetTemp}°C</div>
                        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.max(0, Math.min(100, 100 - tempDiff * 20))}%`,
                            background: tempDiff > 2 ? '#dc2626' : tempDiff > 1 ? '#f59e0b' : '#22c55e',
                            borderRadius: 4,
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: tempDiff > 1 ? '#f59e0b' : '#22c55e', marginTop: 4 }}>
                          {tempDiff > 1 ? `⚠️ ${tempDiff.toFixed(1)}°C off target` : '✓ On target'}
                        </div>
                      </div>
                      {device.humidity !== undefined && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: '#0ea5e9' }}>{device.humidity}%</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Humidity</div>
                        </div>
                      )}
                    </div>

                    {/* Mini Temperature Chart */}
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>24h Temperature History</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
                        {device.history.slice(-24).map((point, i) => {
                          const range = device.type === 'freezer' ? 4 : device.type === 'fridge' ? 2 : device.type === 'incubator' ? 1 : 5;
                          const normalized = Math.max(0, Math.min(100, 50 + (point.temp - device.targetTemp) / range * 50));
                          const isRecent = i > device.history.length - 4;
                          return (
                            <div
                              key={i}
                              title={`${point.time}: ${point.temp.toFixed(1)}°C`}
                              style={{
                                flex: 1,
                                height: `${Math.max(10, normalized)}%`,
                                background: Math.abs(point.temp - device.targetTemp) > 2 ? '#dc2626' : Math.abs(point.temp - device.targetTemp) > 1 ? '#f59e0b' : '#22c55e',
                                borderRadius: 2,
                                opacity: isRecent ? 1 : 0.5,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Alerts */}
                    {device.alerts.length > 0 && (
                      <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 12px' }}>
                        {device.alerts.map((alert, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#991b1b' }}>
                            <span>⚠️</span>
                            <span>{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        📊 Full History
                      </button>
                      <button style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        🔔 Set Alert
                      </button>
                      <button style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        ⚙️ Settings
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WASTE TRACKING TAB */}
        {activeTab === 'waste' && (
          <div>
            {/* Waste Header */}
            <div style={{
              background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
              borderRadius: 20,
              padding: '24px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 48 }}>♻️</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Waste Tracking & Disposal</h2>
                    <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                      Manage hazardous waste, schedule pickups, maintain compliance
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setWasteModalOpen(true)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 12,
                    background: '#fff',
                    color: '#065f46',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  + Log New Waste
                </button>
              </div>
            </div>

            {/* Waste Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Pending Disposal', value: wasteRecords.filter(w => w.status === 'pending').length, icon: '⏳', color: '#f59e0b' },
                { label: 'Scheduled', value: wasteRecords.filter(w => w.status === 'scheduled').length, icon: '📅', color: '#0ea5e9' },
                { label: 'Disposed This Month', value: wasteRecords.filter(w => w.status === 'disposed').length, icon: '✅', color: '#22c55e' },
                { label: 'Total Containers', value: wasteRecords.length, icon: '🗑️', color: '#6366f1' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{s.label}</div>
                    </div>
                    <span style={{ fontSize: 28 }}>{s.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Waste Records Table */}
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Waste Inventory</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Category</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Description</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Hazard Class</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Quantity</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Location</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Status</th>
                    <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteRecords.map(w => (
                    <tr key={w.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>{w.category}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13 }}>{w.description}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: GHS_HAZARDS[w.hazardClass]?.color ? `${GHS_HAZARDS[w.hazardClass].color}20` : '#f1f5f9',
                          color: GHS_HAZARDS[w.hazardClass]?.color || '#64748b',
                        }}>
                          {GHS_HAZARDS[w.hazardClass]?.icon || '⚠️'} {w.hazardClass}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>{w.quantity} {w.unit}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13 }}>{w.containerLocation}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: w.status === 'disposed' ? '#dcfce7' : w.status === 'scheduled' ? '#dbeafe' : '#fef3c7',
                          color: w.status === 'disposed' ? '#166534' : w.status === 'scheduled' ? '#1e40af' : '#92400e',
                        }}>{w.status.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        {w.status === 'pending' && (
                          <button style={{ padding: '6px 12px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Schedule Pickup
                          </button>
                        )}
                        {w.status === 'scheduled' && (
                          <button style={{ padding: '6px 12px', borderRadius: 6, background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            Mark Disposed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LABELS TAB */}
        {activeTab === 'labels' && (
          <div>
            {/* Labels Header */}
            <div style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
              borderRadius: 20,
              padding: '24px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 48 }}>🏷️</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Label Printing Center</h2>
                    <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                      Generate custom labels with barcodes, QR codes, and hazard warnings
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
              {/* Label Options */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Label Template</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 'standard', name: 'Standard Label', desc: '2" x 1" with barcode', icon: '📋' },
                    { id: 'small', name: 'Small Label', desc: '1" x 0.5" for tubes', icon: '🧪' },
                    { id: 'freezer', name: 'Freezer Label', desc: 'Cold-resistant adhesive', icon: '🧊' },
                    { id: 'chemical', name: 'Chemical Label', desc: 'GHS compliant with hazards', icon: '⚗️' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setLabelTemplate(t.id as any)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: labelTemplate === t.id ? '2px solid #7c3aed' : '2px solid #e2e8f0',
                        background: labelTemplate === t.id ? '#f5f3ff' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <h3 style={{ margin: '24px 0 16px', fontSize: 16, fontWeight: 700 }}>Quick Print</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => setLabelItems(stats.lowStock)}
                    style={{ padding: '12px', borderRadius: 8, background: '#fef3c7', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >
                    🔴 Print Low Stock Labels ({stats.lowStock.length})
                  </button>
                  <button
                    onClick={() => setLabelItems(stats.expiringIn30)}
                    style={{ padding: '12px', borderRadius: 8, background: '#fee2e2', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >
                    ⏰ Print Expiring Labels ({stats.expiringIn30.length})
                  </button>
                  <button
                    onClick={() => setLabelItems(stats.hazardous)}
                    style={{ padding: '12px', borderRadius: 8, background: '#fef3c7', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >
                    ☣️ Print Hazard Labels ({stats.hazardous.length})
                  </button>
                </div>
              </div>

              {/* Label Preview & Selection */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    Selected Items ({labelItems.length})
                  </h3>
                  {labelItems.length > 0 && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setLabelItems([])}
                        style={{ padding: '8px 16px', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 13 }}
                      >
                        Clear All
                      </button>
                      <button
                        onClick={() => {
                          setPrintPreviewOpen(true);
                          toast.success('Opening print preview...');
                        }}
                        style={{ padding: '8px 20px', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                      >
                        🖨️ Print Labels
                      </button>
                    </div>
                  )}
                </div>

                {labelItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <span style={{ fontSize: 64 }}>🏷️</span>
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 16 }}>No items selected</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Use quick print buttons or select items from inventory</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {labelItems.map(item => (
                      <div
                        key={item.id}
                        style={{
                          border: '2px dashed #e2e8f0',
                          borderRadius: 10,
                          padding: '16px',
                          background: '#fafafa',
                        }}
                      >
                        {/* Label Preview */}
                        <div style={{ background: '#fff', border: '1px solid #000', borderRadius: 4, padding: '8px', marginBottom: 8, fontFamily: 'monospace' }}>
                          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>{item.name}</div>
                          <div style={{ fontSize: 9, color: '#666' }}>Cat#: {item.catalog_number || 'N/A'}</div>
                          <div style={{ fontSize: 9, color: '#666' }}>Lot#: {item.lot_number || 'N/A'}</div>
                          {item.hazard_class && item.hazard_class !== 'None' && (
                            <div style={{ fontSize: 10, marginTop: 4, color: '#dc2626', fontWeight: 700 }}>
                              {GHS_HAZARDS[item.hazard_class]?.icon} {item.hazard_class}
                            </div>
                          )}
                          <div style={{ marginTop: 6, fontSize: 18, letterSpacing: 2 }}>|||||||||||||||</div>
                          <div style={{ fontSize: 8 }}>{item.barcode || 'NO BARCODE'}</div>
                        </div>
                        <button
                          onClick={() => setLabelItems(labelItems.filter(i => i.id !== item.id))}
                          style={{ width: '100%', padding: '6px', borderRadius: 6, background: '#fee2e2', border: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SDS LIBRARY TAB */}
        {activeTab === 'sds' && (
          <div>
            {/* SDS Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
              borderRadius: 20,
              padding: '32px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 48 }}>📜</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Safety Data Sheet Library</h2>
                    <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                      Manage SDS documents for all chemicals • GHS compliant • OSHA 29 CFR 1910.1200
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSdsModalOpen(true)}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  + Upload SDS
                </button>
              </div>
            </div>

            {/* SDS Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total SDS Documents', value: sdsDocuments.length, icon: '📄', color: '#0891b2' },
                { label: 'Linked to Inventory', value: sdsDocuments.filter(s => s.linkedItems.length > 0).length, icon: '🔗', color: '#22c55e' },
                { label: 'Expiring Soon', value: sdsDocuments.filter(s => new Date(s.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)).length, icon: '⚠️', color: '#f59e0b' },
                { label: 'Hazard Classes', value: new Set(sdsDocuments.map(s => s.hazardClass)).size, icon: '☣️', color: '#dc2626' },
              ].map((stat) => (
                <div key={stat.label} style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{stat.label}</div>
                    </div>
                    <span style={{ fontSize: 28 }}>{stat.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Search & Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <input
                type="text"
                placeholder="Search SDS by chemical name, CAS number, or manufacturer..."
                value={sdsSearch}
                onChange={(e) => setSdsSearch(e.target.value)}
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  borderRadius: 12,
                  border: '2px solid #e2e8f0',
                  fontSize: 14,
                  background: '#fff',
                }}
              />
              <select style={{ padding: '14px 18px', borderRadius: 12, border: '2px solid #e2e8f0', background: '#fff', fontSize: 14 }}>
                <option value="">All Hazard Classes</option>
                <option value="Flammable">🔥 Flammable</option>
                <option value="Corrosive">⚗️ Corrosive</option>
                <option value="Toxic">☠️ Toxic</option>
                <option value="Oxidizer">⭕ Oxidizer</option>
              </select>
            </div>

            {/* SDS Table */}
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Chemical Name</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>CAS Number</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Manufacturer</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Hazard Class</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Linked Items</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Uploaded</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sdsDocuments
                    .filter(s => sdsSearch === '' ||
                      s.chemicalName.toLowerCase().includes(sdsSearch.toLowerCase()) ||
                      s.casNumber.includes(sdsSearch) ||
                      s.manufacturer.toLowerCase().includes(sdsSearch.toLowerCase())
                    )
                    .map((sds) => (
                      <tr key={sds.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{sds.chemicalName}</div>
                        </td>
                        <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#64748b' }}>{sds.casNumber}</td>
                        <td style={{ padding: '16px 20px' }}>{sds.manufacturer}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            background: sds.hazardClass === 'Flammable' ? '#fef2f2' :
                                        sds.hazardClass === 'Corrosive' ? '#fff7ed' :
                                        sds.hazardClass === 'Toxic' ? '#faf5ff' : '#f0fdf4',
                            color: sds.hazardClass === 'Flammable' ? '#dc2626' :
                                   sds.hazardClass === 'Corrosive' ? '#ea580c' :
                                   sds.hazardClass === 'Toxic' ? '#7c3aed' : '#16a34a',
                          }}>
                            {sds.hazardClass === 'Flammable' ? '🔥' :
                             sds.hazardClass === 'Corrosive' ? '⚗️' :
                             sds.hazardClass === 'Toxic' ? '☠️' : '⚠️'} {sds.hazardClass}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#e0f2fe',
                            color: '#0369a1',
                          }}>
                            {sds.linkedItems.length} items
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', color: '#64748b', fontSize: 13 }}>{sds.uploadDate}</td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                              👁️ View
                            </button>
                            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                              ⬇️ Download
                            </button>
                            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                              🔗 Link
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* COA CERTIFICATES TAB */}
        {activeTab === 'coa' && (
          <div>
            {/* COA Header */}
            <div style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              borderRadius: 20,
              padding: '32px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 48 }}>📄</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Certificate of Analysis (COA)</h2>
                    <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                      Track and manage COA documents for all lots • Batch traceability • Quality assurance
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCoaModalOpen(true)}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  + Upload COA
                </button>
              </div>
            </div>

            {/* COA Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total COAs', value: coaDocuments.length, icon: '📄', color: '#059669' },
                { label: 'Valid', value: coaDocuments.filter(c => c.status === 'valid').length, icon: '✅', color: '#22c55e' },
                { label: 'Expiring Soon', value: coaDocuments.filter(c => c.status === 'expiring').length, icon: '⚠️', color: '#f59e0b' },
                { label: 'Expired', value: coaDocuments.filter(c => c.status === 'expired').length, icon: '❌', color: '#dc2626' },
              ].map((stat) => (
                <div key={stat.label} style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{stat.label}</div>
                    </div>
                    <span style={{ fontSize: 28 }}>{stat.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* COA Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
              {coaDocuments.map((coa) => (
                <div
                  key={coa.id}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    border: coa.status === 'expired' ? '2px solid #fecaca' :
                            coa.status === 'expiring' ? '2px solid #fde68a' : '2px solid #bbf7d0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: coa.status === 'valid' ? '#dcfce7' :
                                    coa.status === 'expiring' ? '#fef3c7' : '#fef2f2',
                        color: coa.status === 'valid' ? '#166534' :
                               coa.status === 'expiring' ? '#92400e' : '#dc2626',
                      }}>
                        {coa.status === 'valid' ? '✓ VALID' :
                         coa.status === 'expiring' ? '⚠️ EXPIRING SOON' : '✗ EXPIRED'}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: 4 }}>
                      {coa.lotNumber}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{coa.productName}</h3>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{coa.manufacturer}</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 16 }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Analysis Date</div>
                      <div style={{ fontWeight: 500, marginTop: 2 }}>{coa.analysisDate}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Expiry Date</div>
                      <div style={{ fontWeight: 500, marginTop: 2, color: coa.status === 'expired' ? '#dc2626' : coa.status === 'expiring' ? '#f59e0b' : '#1e293b' }}>
                        {coa.expiryDate}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      👁️ View COA
                    </button>
                    <button style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      ⬇️ Download
                    </button>
                    {coa.status !== 'valid' && (
                      <button style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#0891b2', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        🔄 Request New
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Batch Recall Alert Section */}
            <div style={{
              marginTop: 24,
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
              borderRadius: 16,
              padding: '24px',
              border: '2px solid #fecaca',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>🚨</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#991b1b' }}>Lot/Batch Recall System</h3>
                  <p style={{ margin: '4px 0 0', color: '#dc2626', fontSize: 13 }}>Track which experiments and samples used specific lots for FDA recall compliance</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Enter lot number to trace usage..."
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '2px solid #fecaca',
                    fontSize: 14,
                    background: '#fff',
                  }}
                />
                <button style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}>
                  🔍 Trace Lot Usage
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CALCULATOR TAB - Protocol Material & Experiment Cost Calculator */}
        {activeTab === 'calculator' && (
          <div>
            {/* Calculator Header */}
            <div style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
              borderRadius: 20,
              padding: '32px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 48 }}>🧮</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Protocol & Experiment Calculator</h2>
                  <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                    Calculate materials needed for protocols • Estimate experiment costs • Check stock availability
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Protocol Material Calculator */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📋</span> Protocol Material Calculator
                </h3>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Select Protocol</label>
                  <select
                    value={selectedProtocol}
                    onChange={(e) => {
                      setSelectedProtocol(e.target.value);
                      const protocol = protocols.find(p => p.id === e.target.value);
                      if (protocol) {
                        setCalculatedMaterials(protocol.materials.map(m => ({
                          itemId: Math.random(),
                          itemName: m.itemName,
                          quantityPerRun: m.qty,
                          unit: m.unit,
                          currentStock: Math.floor(Math.random() * 100) + 10,
                          needed: m.qty * numberOfRuns,
                          sufficient: true,
                        })));
                      }
                    }}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 14 }}
                  >
                    <option value="">-- Select a protocol --</option>
                    {protocols.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Number of Runs</label>
                  <input
                    type="number"
                    min={1}
                    value={numberOfRuns}
                    onChange={(e) => {
                      const runs = parseInt(e.target.value) || 1;
                      setNumberOfRuns(runs);
                      setCalculatedMaterials(prev => prev.map(m => ({
                        ...m,
                        needed: m.quantityPerRun * runs,
                        sufficient: m.currentStock >= m.quantityPerRun * runs,
                      })));
                    }}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 14 }}
                  />
                </div>

                {calculatedMaterials.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 12, textTransform: 'uppercase' }}>Materials Needed</div>
                    {calculatedMaterials.map((mat, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: mat.sufficient ? '#f0fdf4' : '#fef2f2',
                        borderRadius: 10,
                        marginBottom: 8,
                        border: `1px solid ${mat.sufficient ? '#bbf7d0' : '#fecaca'}`,
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{mat.itemName}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            Stock: {mat.currentStock} {mat.unit} | Need: {mat.needed} {mat.unit}
                          </div>
                        </div>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: mat.sufficient ? '#dcfce7' : '#fee2e2',
                          color: mat.sufficient ? '#166534' : '#dc2626',
                        }}>
                          {mat.sufficient ? '✓ OK' : '⚠️ LOW'}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const lowItems = calculatedMaterials.filter(m => !m.sufficient);
                        if (lowItems.length > 0) {
                          toast.success(`Added ${lowItems.length} items to reorder list`);
                        }
                      }}
                      style={{
                        width: '100%',
                        marginTop: 12,
                        padding: '12px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#7c3aed',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🛒 Auto-Reorder Insufficient Items
                    </button>
                  </div>
                )}
              </div>

              {/* Experiment Cost Calculator */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>💰</span> Experiment Cost Calculator
                </h3>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Experiment Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Western Blot Analysis"
                    value={experimentName}
                    onChange={(e) => setExperimentName(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 14 }}
                  />
                </div>

                <button
                  onClick={() => {
                    // Simulate cost calculation
                    setExperimentCost({
                      materials: [
                        { name: 'Primary Antibody', quantity: 10, unit: 'µL', unitCost: 5.00, totalCost: 50.00 },
                        { name: 'Secondary Antibody', quantity: 5, unit: 'µL', unitCost: 3.00, totalCost: 15.00 },
                        { name: 'PVDF Membrane', quantity: 1, unit: 'sheet', unitCost: 12.00, totalCost: 12.00 },
                        { name: 'Blocking Buffer', quantity: 50, unit: 'mL', unitCost: 0.10, totalCost: 5.00 },
                      ],
                      laborHours: 4,
                      laborRate: 35,
                      equipmentCost: 25,
                      totalCost: 222,
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    border: '2px solid #e2e8f0',
                    background: '#f8fafc',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: 20,
                  }}
                >
                  🔍 Calculate Cost from Protocol
                </button>

                {experimentCost && (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Material Costs</div>
                      {experimentCost.materials.map((m, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: 13 }}>{m.name} ({m.quantity} {m.unit})</span>
                          <span style={{ fontWeight: 600 }}>${m.totalCost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 10, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span>Labor ({experimentCost.laborHours}h @ ${experimentCost.laborRate}/h)</span>
                        <span style={{ fontWeight: 600 }}>${experimentCost.laborHours * experimentCost.laborRate}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Equipment Usage</span>
                        <span style={{ fontWeight: 600 }}>${experimentCost.equipmentCost}</span>
                      </div>
                    </div>

                    <div style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                      borderRadius: 12,
                      color: '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>Total Experiment Cost</span>
                      <span style={{ fontWeight: 800, fontSize: 24 }}>${experimentCost.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Substitution Finder */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: 24 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🤖</span> AI Substitution Finder
              </h3>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                Find alternative products when items are unavailable or too expensive. AI analyzes specifications and suggests compatible substitutes.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Enter product name to find alternatives..."
                  value={substitutionItem}
                  onChange={(e) => setSubstitutionItem(e.target.value)}
                  style={{ flex: 1, padding: '14px 18px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 14 }}
                />
                <button
                  onClick={() => {
                    setSubstitutionLoading(true);
                    setTimeout(() => {
                      setSubstitutions({
                        originalItem: substitutionItem,
                        alternatives: [
                          { name: 'GenericBrand PCR Mix', manufacturer: 'BioChem Co', similarity: 95, priceDiff: '-40%', inStock: true },
                          { name: 'EconoTaq Master Mix', manufacturer: 'Promega', similarity: 92, priceDiff: '-25%', inStock: true },
                          { name: 'PrimeStar Max', manufacturer: 'Takara', similarity: 88, priceDiff: '+15%', inStock: false },
                        ],
                      });
                      setSubstitutionLoading(false);
                    }, 1500);
                  }}
                  disabled={!substitutionItem || substitutionLoading}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#7c3aed',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: !substitutionItem || substitutionLoading ? 0.5 : 1,
                  }}
                >
                  {substitutionLoading ? '⏳ Searching...' : '🔍 Find Alternatives'}
                </button>
              </div>

              {substitutions && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>
                    Alternatives for "{substitutions.originalItem}"
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {substitutions.alternatives.map((alt, idx) => (
                      <div key={idx} style={{
                        padding: '16px',
                        background: '#f8fafc',
                        borderRadius: 12,
                        border: alt.inStock ? '2px solid #bbf7d0' : '2px solid #fecaca',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            background: alt.similarity >= 90 ? '#dcfce7' : '#fef3c7',
                            color: alt.similarity >= 90 ? '#166534' : '#92400e',
                          }}>
                            {alt.similarity}% match
                          </span>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: alt.priceDiff.startsWith('-') ? '#16a34a' : '#dc2626',
                          }}>
                            {alt.priceDiff}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{alt.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{alt.manufacturer}</div>
                        <button style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: 8,
                          border: 'none',
                          background: alt.inStock ? '#7c3aed' : '#e2e8f0',
                          color: alt.inStock ? '#fff' : '#94a3b8',
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: alt.inStock ? 'pointer' : 'not-allowed',
                        }}>
                          {alt.inStock ? '+ Add to Cart' : 'Out of Stock'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SHARING TAB - Material Sharing Between Labs */}
        {activeTab === 'sharing' && (
          <div>
            {/* Sharing Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
              borderRadius: 20,
              padding: '32px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 48 }}>🤝</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Material Sharing Hub</h2>
                    <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                      Share excess inventory with other labs • Reduce waste • Request materials from the network
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShareModalOpen(true)}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  + Share Materials
                </button>
              </div>
            </div>

            {/* Sharing Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Available Items', value: sharedMaterials.filter(s => s.status === 'available').length, icon: '📦', color: '#0d9488' },
                { label: 'Pending Requests', value: sharedMaterials.filter(s => s.status === 'requested').length, icon: '⏳', color: '#f59e0b' },
                { label: 'Items Shared', value: sharedMaterials.filter(s => s.status === 'transferred').length, icon: '✅', color: '#22c55e' },
                { label: 'Partner Labs', value: 8, icon: '🏢', color: '#6366f1' },
              ].map((stat) => (
                <div key={stat.label} style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{stat.label}</div>
                    </div>
                    <span style={{ fontSize: 28 }}>{stat.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Available Materials from Other Labs */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>📥 Available from Other Labs</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {sharedMaterials.filter(s => s.status === 'available' && s.fromLab !== 'Your Lab').map((item) => (
                  <div key={item.id} style={{
                    padding: '20px',
                    background: '#f8fafc',
                    borderRadius: 12,
                    border: '2px solid #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: '#0d9488', fontWeight: 600 }}>From: {item.fromLab}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Exp: {item.expiresOn}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{item.itemName}</div>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>{item.quantity} {item.unit} available</div>
                    <button style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#0d9488',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}>
                      📨 Request This Item
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Your Requests & Shared Items */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Incoming Requests */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>📬 Incoming Requests</h3>
                {sharedMaterials.filter(s => s.status === 'requested' && s.fromLab === 'Your Lab').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📭</span>
                    No pending requests
                  </div>
                ) : (
                  sharedMaterials.filter(s => s.status === 'requested').map((item) => (
                    <div key={item.id} style={{
                      padding: '16px',
                      background: '#fef3c7',
                      borderRadius: 10,
                      marginBottom: 12,
                      border: '1px solid #fde68a',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.itemName}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                        Requested by: {item.requestedBy} • {item.requestDate}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                          ✓ Approve
                        </button>
                        <button style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                          ✗ Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Your Shared Items */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>📤 Your Shared Items</h3>
                {sharedMaterials.filter(s => s.fromLab === 'Your Lab').map((item) => (
                  <div key={item.id} style={{
                    padding: '16px',
                    background: '#f0fdf4',
                    borderRadius: 10,
                    marginBottom: 12,
                    border: '1px solid #bbf7d0',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{item.itemName}</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: item.status === 'available' ? '#dcfce7' : item.status === 'approved' ? '#dbeafe' : '#fef3c7',
                        color: item.status === 'available' ? '#166534' : item.status === 'approved' ? '#1d4ed8' : '#92400e',
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {item.quantity} {item.unit} • {item.toLab ? `To: ${item.toLab}` : 'Available'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RECURRING ORDERS TAB */}
        {activeTab === 'recurring' && (
          <div>
            {/* Recurring Header */}
            <div style={{
              background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              borderRadius: 20,
              padding: '32px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 48 }}>🔄</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Recurring Order Templates</h2>
                    <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                      Automate regular supply orders • Never run out of essentials • Set frequency and quantities
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRecurringModalOpen(true)}
                  style={{
                    padding: '14px 28px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.2)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  + Create Template
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Active Templates', value: recurringOrders.filter(r => r.active).length, icon: '✅', color: '#22c55e' },
                { label: 'Due This Week', value: 1, icon: '📅', color: '#f59e0b' },
                { label: 'Monthly Spend', value: '$1,930', icon: '💰', color: '#6366f1' },
                { label: 'Items on Auto-Order', value: recurringOrders.reduce((sum, r) => sum + r.items.length, 0), icon: '📦', color: '#0891b2' },
              ].map((stat) => (
                <div key={stat.label} style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{stat.label}</div>
                    </div>
                    <span style={{ fontSize: 28 }}>{stat.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Recurring Order Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
              {recurringOrders.map((order) => (
                <div key={order.id} style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  border: order.active ? '2px solid #bbf7d0' : '2px solid #e2e8f0',
                  opacity: order.active ? 1 : 0.7,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{order.name}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: order.active ? '#dcfce7' : '#f1f5f9',
                          color: order.active ? '#166534' : '#64748b',
                        }}>
                          {order.active ? '● Active' : '○ Paused'}
                        </span>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: '#dbeafe',
                          color: '#1d4ed8',
                          textTransform: 'capitalize',
                        }}>
                          {order.frequency}
                        </span>
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={order.active}
                        onChange={() => {
                          setRecurringOrders(prev => prev.map(o =>
                            o.id === order.id ? { ...o, active: !o.active } : o
                          ));
                        }}
                        style={{ width: 20, height: 20 }}
                      />
                    </label>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Items</div>
                    {order.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 13 }}>{item.itemName}</span>
                        <span style={{ fontSize: 13, color: '#64748b' }}>{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, fontSize: 13 }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Supplier</div>
                      <div style={{ fontWeight: 600 }}>{order.supplier}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Est. Cost</div>
                      <div style={{ fontWeight: 700, color: '#6366f1' }}>${order.estimatedCost}</div>
                    </div>
                  </div>

                  <div style={{
                    padding: '12px 16px',
                    background: order.active ? '#fef3c7' : '#f8fafc',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Next Order: </span>
                      <span style={{ fontWeight: 700, color: order.active ? '#92400e' : '#64748b' }}>{order.nextOrder}</span>
                    </div>
                    <button style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#ea580c',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}>
                      Order Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMPLIANCE TAB */}
        {activeTab === 'compliance' && (
          <div>
            {/* Compliance Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              borderRadius: 20,
              padding: '24px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 48 }}>📋</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Regulatory Compliance Center</h2>
                  <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 14 }}>
                    GLP, FDA 21 CFR Part 11, ISO 17025 compliance tracking & audit trails
                  </p>
                </div>
              </div>
            </div>

            {/* Compliance Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { standard: 'GLP', status: 'compliant', lastAudit: '2024-03-15', nextAudit: '2024-09-15', score: 98 },
                { standard: 'FDA 21 CFR Part 11', status: 'compliant', lastAudit: '2024-02-20', nextAudit: '2024-08-20', score: 95 },
                { standard: 'ISO 17025', status: 'review', lastAudit: '2024-01-10', nextAudit: '2024-07-10', score: 88 },
              ].map(c => (
                <div
                  key={c.standard}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    border: c.status === 'compliant' ? '2px solid #22c55e' : '2px solid #f59e0b',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{c.standard}</div>
                      <span style={{
                        display: 'inline-block',
                        marginTop: 4,
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: c.status === 'compliant' ? '#dcfce7' : '#fef3c7',
                        color: c.status === 'compliant' ? '#166534' : '#92400e',
                      }}>
                        {c.status === 'compliant' ? '✓ COMPLIANT' : '⚠️ REVIEW NEEDED'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 36, fontWeight: 800, color: c.score >= 95 ? '#22c55e' : c.score >= 85 ? '#f59e0b' : '#dc2626' }}>{c.score}%</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Score</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#64748b' }}>Last Audit</div>
                      <div style={{ fontWeight: 600 }}>{c.lastAudit}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Next Audit</div>
                      <div style={{ fontWeight: 600 }}>{c.nextAudit}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Compliance Checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>📝 Compliance Checklist</h3>
                {[
                  { item: 'All inventory items have lot numbers', status: true },
                  { item: 'Expiration dates tracked for perishables', status: true },
                  { item: 'MSDS documents uploaded for chemicals', status: false },
                  { item: 'Storage temperature logs maintained', status: true },
                  { item: 'Audit trail enabled for all changes', status: true },
                  { item: 'User access controls configured', status: true },
                  { item: 'Waste disposal records complete', status: false },
                  { item: 'Equipment calibration up to date', status: true },
                ].map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 18 }}>{c.status ? '✅' : '⚠️'}</span>
                    <span style={{ flex: 1, fontSize: 14, color: c.status ? '#1e293b' : '#f59e0b' }}>{c.item}</span>
                    {!c.status && (
                      <button style={{ padding: '4px 12px', borderRadius: 6, background: '#fef3c7', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#92400e' }}>
                        Fix Now
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>📄 Required Documents</h3>
                {[
                  { doc: 'Chemical Inventory List', status: 'current', updated: '2024-04-01' },
                  { doc: 'Safety Data Sheets (SDS)', status: 'incomplete', updated: '2024-03-15' },
                  { doc: 'Equipment Maintenance Logs', status: 'current', updated: '2024-04-05' },
                  { doc: 'Training Records', status: 'current', updated: '2024-03-20' },
                  { doc: 'Waste Manifests', status: 'overdue', updated: '2024-02-01' },
                  { doc: 'Standard Operating Procedures', status: 'current', updated: '2024-03-10' },
                ].map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 18 }}>📄</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{d.doc}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Updated: {d.updated}</div>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      background: d.status === 'current' ? '#dcfce7' : d.status === 'incomplete' ? '#fef3c7' : '#fee2e2',
                      color: d.status === 'current' ? '#166534' : d.status === 'incomplete' ? '#92400e' : '#dc2626',
                    }}>{d.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 21 CFR Part 11 Enhanced Audit Trail */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: '#6366f1', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 14 }}>21 CFR Part 11</span>
                    Electronic Audit Trail
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
                    Complete electronic records with digital signatures and change tracking
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ padding: '10px 16px', borderRadius: 10, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📥 Export Audit Log
                  </button>
                  <button style={{ padding: '10px 16px', borderRadius: 10, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🔍 Advanced Search
                  </button>
                </div>
              </div>

              {/* Audit Trail Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'Total Records', value: auditEntries.length, icon: '📊', color: '#6366f1' },
                  { label: 'Signed Records', value: auditEntries.filter(e => e.signature).length, icon: '✍️', color: '#22c55e' },
                  { label: 'Today\'s Changes', value: auditEntries.filter(e => e.timestamp.startsWith('2024-04-10')).length, icon: '📅', color: '#f59e0b' },
                  { label: 'Users Active', value: new Set(auditEntries.map(e => e.user)).size, icon: '👥', color: '#3b82f6' },
                ].map((stat, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28 }}>{stat.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, marginTop: 4 }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Audit Trail Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Timestamp</th>
                      <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>User</th>
                      <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Action</th>
                      <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Entity</th>
                      <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Changes</th>
                      <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Signature</th>
                      <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.map((entry) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{entry.timestamp.split(' ')[1]}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{entry.timestamp.split(' ')[0]}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                              {entry.user.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span style={{ fontWeight: 500 }}>{entry.user}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: entry.action === 'CREATE' ? '#dcfce7' : entry.action === 'UPDATE' ? '#dbeafe' : entry.action === 'DELETE' ? '#fee2e2' : '#fef3c7',
                            color: entry.action === 'CREATE' ? '#166534' : entry.action === 'UPDATE' ? '#1e40af' : entry.action === 'DELETE' ? '#dc2626' : '#92400e',
                          }}>
                            {entry.action}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 500 }}>{entry.entity}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{entry.entityId}</div>
                        </td>
                        <td style={{ padding: '14px 16px', maxWidth: 200 }}>
                          {entry.oldValue && (
                            <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 2 }}>
                              <span style={{ textDecoration: 'line-through' }}>{entry.oldValue}</span>
                            </div>
                          )}
                          {entry.newValue && (
                            <div style={{ fontSize: 11, color: '#166534' }}>
                              {entry.newValue}
                            </div>
                          )}
                          {entry.reason && (
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                              Reason: {entry.reason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {entry.signature ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: '#22c55e', fontSize: 16 }}>✓</span>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e' }}>Signed</div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>{entry.signature}</div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>Not required</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                          {entry.ipAddress}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Electronic Signature Notice */}
              <div style={{ marginTop: 20, padding: '16px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 24 }}>🔐</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>21 CFR Part 11 Compliant Electronic Signatures</div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#15803d', lineHeight: 1.5 }}>
                    All electronic records are maintained with unique user IDs, secure passwords, and time-stamped audit trails.
                    Electronic signatures are linked to their respective electronic records and include the signer's printed name,
                    date/time of signing, and meaning of signature (e.g., review, approval, responsibility).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Quick Actions Floating Button */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'flex-end',
        gap: 12,
      }}>
        {/* Quick Action Menu (expanded) */}
        {mobileActionsOpen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 10,
          }}>
            {[
              { icon: '📷', label: 'Scan Barcode', action: () => { setScannerOpen(true); setMobileActionsOpen(false); }, color: '#6366f1' },
              { icon: '➕', label: 'Add Item', action: () => { openCreate(); setMobileActionsOpen(false); }, color: '#22c55e' },
              { icon: '📋', label: 'Quick Order', action: () => { setQuickReorderOpen(true); setMobileActionsOpen(false); }, color: '#f59e0b' },
              { icon: '🔔', label: 'Low Stock Alert', action: () => { setActiveTab('inventory'); setStockFilter('low'); setMobileActionsOpen(false); }, color: '#ef4444' },
              { icon: '📊', label: 'Dashboard', action: () => { setActiveTab('dashboard'); setMobileActionsOpen(false); }, color: '#3b82f6' },
              { icon: '♻️', label: 'Log Waste', action: () => { setActiveTab('waste'); setWasteModalOpen(true); setMobileActionsOpen(false); }, color: '#059669' },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 20px',
                  background: '#fff',
                  border: `2px solid ${item.color}`,
                  borderRadius: 50,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  animation: `slideIn 0.2s ease-out ${i * 0.05}s both`,
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: item.color }}>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={() => setMobileActionsOpen(!mobileActionsOpen)}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: mobileActionsOpen ? '#ef4444' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(99,102,241,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            color: '#fff',
            transition: 'all 0.3s ease',
            transform: mobileActionsOpen ? 'rotate(45deg)' : 'rotate(0)',
          }}
        >
          {mobileActionsOpen ? '✕' : '⚡'}
        </button>
      </div>

      {/* MODALS */}

      {/* Inventory Item Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Inventory Item' : 'Add New Item'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input className="form-input" {...register('name', { required: true })} placeholder="e.g., Taq Polymerase" list="item-suggestions" />
              <datalist id="item-suggestions">
                <option value="Taq Polymerase" />
                <option value="PCR Master Mix" />
                <option value="DNA Ladder" />
                <option value="DMEM Media" />
                <option value="FBS (Fetal Bovine Serum)" />
                <option value="Trypsin-EDTA" />
                <option value="PBS Buffer" />
                <option value="Ethanol (95%)" />
                <option value="Pipette Tips (1000µL)" />
                <option value="Pipette Tips (200µL)" />
                <option value="Pipette Tips (10µL)" />
                <option value="Microcentrifuge Tubes" />
                <option value="PCR Tubes" />
                <option value="Nitrile Gloves" />
                <option value="HEPA Filters" />
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Category *</label>
              {customCategory ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" {...register('category', { required: true })} placeholder="Enter custom category..." style={{ flex: 1 }} />
                  <button type="button" onClick={() => setCustomCategory(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>📋 Back to list</button>
                </div>
              ) : (
                <select
                  className="form-select"
                  {...register('category', { required: true })}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomCategory(true);
                      setValue('category', '');
                    }
                  }}
                >
                  {INVENTORY_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                  <option value="__custom__">✏️ Add manually...</option>
                </select>
              )}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-select" {...register('supplier_id')}>
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.company} {s.is_preferred ? '⭐' : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Catalog Number</label>
              <input className="form-input" {...register('catalog_number')} placeholder="e.g., M0267S" list="catalog-suggestions" />
              <datalist id="catalog-suggestions">
                <option value="M0267S" />
                <option value="M0273S" />
                <option value="N3232S" />
                <option value="10128-016" />
                <option value="25200-056" />
                <option value="11965-092" />
              </datalist>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Barcode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" {...register('barcode')} style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScannerOpen(true)}>📷</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Lot Number</label>
              <input className="form-input" {...register('lot_number')} placeholder="e.g., LOT-2024-001" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input type="number" className="form-input" {...register('quantity')} min="0" defaultValue={0} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              {customUnit ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" {...register('unit')} placeholder="Enter custom unit..." style={{ flex: 1 }} />
                  <button type="button" onClick={() => setCustomUnit(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>📋 Back</button>
                </div>
              ) : (
                <select
                  className="form-select"
                  {...register('unit')}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomUnit(true);
                      setValue('unit', '');
                    }
                  }}
                >
                  {(() => {
                    const grouped: Record<string, typeof INVENTORY_UNITS> = {};
                    INVENTORY_UNITS.forEach(u => {
                      if (!u.category) {
                        grouped[''] = grouped[''] || [];
                        grouped[''].push(u);
                      } else {
                        grouped[u.category] = grouped[u.category] || [];
                        grouped[u.category].push(u);
                      }
                    });
                    return Object.entries(grouped).map(([cat, units]) =>
                      cat ? (
                        <optgroup key={cat} label={cat}>
                          {units.map(u => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </optgroup>
                      ) : units.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))
                    );
                  })()}
                  <option value="__custom__">✏️ Add manually...</option>
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Reorder At</label>
              <input type="number" className="form-input" {...register('reorder_threshold')} min="0" defaultValue={0} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unit Price ($)</label>
              <input type="number" step="0.01" className="form-input" {...register('unit_price')} min="0" defaultValue={0} />
            </div>
            <div className="form-group">
              <label className="form-label">Storage Temperature</label>
              {customTemp ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" {...register('storage_temp')} placeholder="e.g., -30°C, 37°C" style={{ flex: 1 }} />
                  <button type="button" onClick={() => setCustomTemp(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>📋 Back</button>
                </div>
              ) : (
                <select
                  className="form-select"
                  {...register('storage_temp')}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomTemp(true);
                      setValue('storage_temp', '');
                    }
                  }}
                >
                  <option value="">-- Select Temperature --</option>
                  <option value="RT">📦 Room Temperature (15-25°C)</option>
                  <option value="4C">🌡️ Refrigerated (2-8°C)</option>
                  <option value="-20C">❄️ Frozen (-20°C)</option>
                  <option value="-80C">🧊 Ultra-Low (-80°C)</option>
                  <option value="LN2">🥶 Liquid Nitrogen (-196°C)</option>
                  <option value="__custom__">✏️ Add manually...</option>
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Hazard Class</label>
              {customHazard ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" {...register('hazard_class')} placeholder="Enter hazard class..." style={{ flex: 1 }} />
                  <button type="button" onClick={() => setCustomHazard(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>📋 Back</button>
                </div>
              ) : (
                <select
                  className="form-select"
                  {...register('hazard_class')}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomHazard(true);
                      setValue('hazard_class', '');
                    }
                  }}
                >
                  <option value="">⚪ None / Not Hazardous</option>
                  {Object.entries(GHS_HAZARDS).map(([key, val]) => (
                    <option key={key} value={key}>{val.icon} {key} - {val.description}</option>
                  ))}
                  <option value="__custom__">✏️ Add manually...</option>
                </select>
              )}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Storage Location</label>
              {customLocation ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" {...register('storage_location')} placeholder="e.g., Room 201, Cabinet B3" style={{ flex: 1 }} />
                  <button type="button" onClick={() => setCustomLocation(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>📋 Back</button>
                </div>
              ) : (
                <select
                  className="form-select"
                  {...register('storage_location')}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomLocation(true);
                      setValue('storage_location', '');
                    }
                  }}
                >
                  <option value="">-- Select Location --</option>
                  <optgroup label="Ultra-Low Temperature (-80°C)">
                    <option value="freezer-80-1">🧊 -80°C Freezer 1</option>
                    <option value="freezer-80-2">🧊 -80°C Freezer 2</option>
                  </optgroup>
                  <optgroup label="Frozen (-20°C)">
                    <option value="freezer-20-1">❄️ -20°C Freezer 1</option>
                    <option value="freezer-20-2">❄️ -20°C Freezer 2</option>
                  </optgroup>
                  <optgroup label="Refrigerated (4°C)">
                    <option value="fridge-1">🌡️ Refrigerator 1</option>
                    <option value="fridge-2">🌡️ Refrigerator 2</option>
                  </optgroup>
                  <optgroup label="Room Temperature">
                    <option value="shelf-rt-1">📦 RT Shelf A</option>
                    <option value="shelf-rt-2">📦 RT Shelf B</option>
                    <option value="chemical-cabinet">🧪 Chemical Cabinet</option>
                    <option value="flammable-cabinet">🔥 Flammable Cabinet</option>
                  </optgroup>
                  <optgroup label="Cryogenic">
                    <option value="ln2-tank">🥶 LN2 Tank</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="bench-1">🔬 Lab Bench 1</option>
                    <option value="bench-2">🔬 Lab Bench 2</option>
                    <option value="desiccator">💨 Desiccator</option>
                    <option value="dark-storage">🌑 Dark Storage</option>
                  </optgroup>
                  <option value="__custom__">✏️ Add manually...</option>
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Expiration Date</label>
              <input type="date" className="form-input" {...register('expires_on')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} {...register('notes')} placeholder="Additional information (handling instructions, special requirements, etc.)..." />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Item' : 'Add Item'}</button>
          </div>
        </form>
      </Modal>

      {/* Usage Log Modal */}
      <Modal isOpen={usageModalOpen} onClose={() => setUsageModalOpen(false)} title="Log Usage" size="sm">
        {usageItem && (
          <div style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{usageItem.name}</div>
              <div style={{ fontSize: 14, color: '#64748b' }}>Current stock: <strong>{usageItem.quantity} {usageItem.unit}</strong></div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Amount Used</label>
              <input
                type="number"
                className="form-input"
                value={usageAmount}
                onChange={(e) => setUsageAmount(Number(e.target.value))}
                min={1}
                max={usageItem.quantity}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Purpose (optional)</label>
              <input
                className="form-input"
                value={usagePurpose}
                onChange={(e) => setUsagePurpose(e.target.value)}
                placeholder="e.g., PCR experiment, Protocol #123"
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setUsageModalOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={logUsage}
                disabled={saving || usageAmount <= 0 || usageAmount > usageItem.quantity}
              >
                {saving ? 'Logging...' : 'Log Usage'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick Reorder Modal */}
      <Modal isOpen={quickReorderOpen} onClose={() => setQuickReorderOpen(false)} title="🛒 Quick Reorder" size="lg">
        <div style={{ padding: '20px' }}>
          <div style={{ background: '#fef3c7', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: '#92400e' }}>⚠️ {orderItems.length} items need reordering</div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Select Supplier *</label>
            <select
              className="form-select"
              value={selectedSupplierForOrder || ''}
              onChange={(e) => setSelectedSupplierForOrder(Number(e.target.value))}
            >
              <option value="">-- Choose supplier --</option>
              {suppliers.filter(s => s.is_preferred).map(s => (
                <option key={s.id} value={s.id}>⭐ {s.company} (Preferred)</option>
              ))}
              {suppliers.filter(s => !s.is_preferred).map(s => (
                <option key={s.id} value={s.id}>{s.company}</option>
              ))}
            </select>
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
            {orderItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                </div>
                <input
                  type="number"
                  style={{ width: 80, padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...orderItems];
                    newItems[idx].quantity = Number(e.target.value);
                    setOrderItems(newItems);
                  }}
                />
                <button
                  onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}
                  style={{ padding: '8px', borderRadius: 6, background: '#fee2e2', border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f0fdf4', borderRadius: 10, marginBottom: 20 }}>
            <span style={{ fontWeight: 700 }}>Estimated Total:</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>
              ${(orderItems.reduce((sum, i) => sum + (i.quantity * (i.unit_price || 0) / 100), 0)).toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setQuickReorderOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={createPurchaseOrder}
              disabled={saving || !selectedSupplierForOrder || orderItems.length === 0}
            >
              {saving ? 'Creating...' : '🛒 Create Order'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Purchase Order Modal */}
      <Modal isOpen={orderModal} onClose={() => setOrderModal(false)} title="Create Purchase Order" size="lg">
        <div style={{ padding: '20px' }}>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Select Supplier *</label>
            <select
              className="form-select"
              value={selectedSupplierForOrder || ''}
              onChange={(e) => setSelectedSupplierForOrder(Number(e.target.value))}
            >
              <option value="">-- Choose supplier --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.company} {s.is_preferred ? '⭐' : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Items</label>
            {orderItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  style={{ flex: 2, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => {
                    const newItems = [...orderItems];
                    newItems[idx].name = e.target.value;
                    setOrderItems(newItems);
                  }}
                />
                <input
                  type="number"
                  style={{ width: 80, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...orderItems];
                    newItems[idx].quantity = Number(e.target.value);
                    setOrderItems(newItems);
                  }}
                />
                <input
                  type="number"
                  step="0.01"
                  style={{ width: 100, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  placeholder="Price"
                  value={item.unit_price / 100}
                  onChange={(e) => {
                    const newItems = [...orderItems];
                    newItems[idx].unit_price = Number(e.target.value) * 100;
                    setOrderItems(newItems);
                  }}
                />
                <button
                  onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}
                  style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => setOrderItems([...orderItems, { name: '', quantity: 1, unit_price: 0 }])}
              style={{ padding: '10px 20px', borderRadius: 8, background: '#f1f5f9', border: '2px dashed #e2e8f0', cursor: 'pointer', fontSize: 14 }}
            >
              + Add Item
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: '#f8fafc', borderRadius: 12, marginBottom: 20 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Total:</span>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#6366f1' }}>
              ${(orderItems.reduce((sum, i) => sum + (i.quantity * i.unit_price / 100), 0)).toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setOrderModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={createPurchaseOrder}
              disabled={saving || !selectedSupplierForOrder || orderItems.length === 0}
            >
              {saving ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Supplier Detail Modal */}
      <Modal isOpen={!!viewingSupplier} onClose={() => setViewingSupplier(null)} title={viewingSupplier?.company || ''} size="lg">
        {viewingSupplier && (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              {viewingSupplier.is_preferred && (
                <span style={{ background: '#22c55e', color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>⭐ Preferred Vendor</span>
              )}
              <span style={{ background: '#f1f5f9', padding: '6px 16px', borderRadius: 20, fontSize: 13 }}>{viewingSupplier.budget_tier}</span>
              <span style={{ background: '#f1f5f9', padding: '6px 16px', borderRadius: 20, fontSize: 13 }}>{viewingSupplier.procurement_priority} Priority</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Category</div>
                <div style={{ fontWeight: 600 }}>{viewingSupplier.category}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Subcategory</div>
                <div style={{ fontWeight: 600 }}>{viewingSupplier.subcategory}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Market Segment</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {viewingSupplier.research_use && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>Research</span>}
                  {viewingSupplier.clinical_use && <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}>Clinical</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Rating</div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(i => (
                    <span key={i} style={{ color: i <= viewingSupplier.rating ? '#fbbf24' : '#e5e7eb', fontSize: 20 }}>★</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 14 }}>{viewingSupplier.description}</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Primary Offerings</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {viewingSupplier.primary_offerings.split(';').map((o, i) => (
                  <span key={i} style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{o.trim()}</span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>AI Tags</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {viewingSupplier.ai_recommendation_tags.split(';').map((t, i) => (
                  <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{t.trim()}</span>
                ))}
              </div>
            </div>

            {viewingSupplier.website && (
              <a
                href={viewingSupplier.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#6366f1',
                  color: '#fff',
                  padding: '12px 24px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                🔗 Visit Website
              </a>
            )}
          </div>
        )}
      </Modal>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="autofill"
        onScan={(barcode, productInfo) => {
          setValue('barcode', barcode);

          // Auto-fill form if product info is found
          if (productInfo) {
            setValue('name', productInfo.name);
            setValue('category', productInfo.category);
            setValue('catalog_number', productInfo.catalogNumber);
            setValue('unit', productInfo.unit);
            setValue('storage_temp', productInfo.storageTemp);
            setValue('hazard_class', productInfo.hazardClass);
            setValue('notes', productInfo.description);
            toast.success(`✅ Product found: ${productInfo.name} - Form auto-filled!`);
          } else {
            toast.success(`Scanned: ${barcode}`);
          }

          setScannerOpen(false);
        }}
      />
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={saving}
        message={`Delete "${deleting?.name}"?`}
      />
    </div>
  );
}
