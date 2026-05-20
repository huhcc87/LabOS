import { useState, useRef, useEffect, useCallback } from 'react';
import * as bwipjs from 'bwip-js';
import { exportCSV, exportPDF } from '../lib/export';
import { useNavigate } from '../context/NavigationContext';

// Types
interface Sample {
  id: number;
  sampleId: string;
  type: string;
  status: 'processing' | 'stored' | 'disposed' | 'shipped' | 'quarantine';
  location: string;
  date: string;
  owner: string;
  quantity: string;
  unit: string;
  temperature: string;
  notes: string;
  parentSampleId?: string;
}

interface SampleEvent {
  id: number;
  sampleId: string;
  event: string;
  user: string;
  timestamp: string;
  details?: string;
}

// Sample Types
const SAMPLE_TYPES = [
  'Blood', 'Serum', 'Plasma', 'Tissue', 'DNA', 'RNA', 'Protein',
  'Cell Line', 'Bacteria', 'Virus', 'Urine', 'Saliva', 'CSF',
  'Bone Marrow', 'Biopsy', 'FFPE', 'Frozen Section', 'Swab',
];

// Storage Locations
const STORAGE_LOCATIONS = [
  'Freezer A-1', 'Freezer A-2', 'Freezer A-3',
  'Freezer B-1', 'Freezer B-2', 'Freezer B-3',
  'Refrigerator 1', 'Refrigerator 2',
  'Liquid Nitrogen Tank 1', 'Liquid Nitrogen Tank 2',
  'Room Temperature Shelf A', 'Room Temperature Shelf B',
  'Lab Bench', 'Processing Area', 'Quarantine Zone',
];

// Temperature Options
const TEMPERATURE_OPTIONS = [
  '-196°C (Liquid Nitrogen)',
  '-80°C (Ultra-Low Freezer)',
  '-20°C (Standard Freezer)',
  '4°C (Refrigerator)',
  'Room Temperature (20-25°C)',
];

// Units
const QUANTITY_UNITS = [
  'mL', 'µL', 'L', 'mg', 'µg', 'g', 'ng',
  'cells', 'vials', 'tubes', 'slides', 'blocks',
];

// Barcode Types with visual representations
const BARCODE_TYPES = [
  { id: 'code128', name: 'Code 128', description: 'Alphanumeric, high density - Most common for lab samples', type: '1D', pattern: '▮▯▮▮▯▮▯▯▮▮▯▮▮▯▮▯▮▮▯▯▮▮▯▮' },
  { id: 'code39', name: 'Code 39', description: 'Alphanumeric, self-checking - Industry standard', type: '1D', pattern: '▮▯▯▮▯▮▮▯▮▯▯▮▮▯▮▯▮▯▯▮▮▯▮▯' },
  { id: 'qrcode', name: 'QR Code', description: '2D matrix - Stores more data, scannable from any angle', type: '2D', pattern: 'qr' },
  { id: 'datamatrix', name: 'Data Matrix', description: '2D matrix - Small size, high reliability', type: '2D', pattern: 'matrix' },
  { id: 'ean13', name: 'EAN-13', description: 'Numeric only - International product code', type: '1D', pattern: '▮▯▮▮▯▯▮▯▮▮▯▮▯▯▮▮▯▮▮▯▮▯▮▮' },
  { id: 'upca', name: 'UPC-A', description: 'Numeric only - North American retail', type: '1D', pattern: '▮▯▯▮▮▯▮▯▮▯▮▮▯▯▮▯▮▮▯▮▯▯▮▮' },
  { id: 'pdf417', name: 'PDF417', description: '2D stacked - High capacity, error correction', type: '2D', pattern: 'stacked' },
  { id: 'aztec', name: 'Aztec Code', description: '2D matrix - Compact, no quiet zone needed', type: '2D', pattern: 'aztec' },
  { id: 'codabar', name: 'Codabar', description: 'Numeric + special chars - Blood banks, libraries', type: '1D', pattern: '▮▯▮▯▮▮▯▯▮▯▮▮▯▮▯▯▮▮▯▮▮▯▮▯' },
  { id: 'itf14', name: 'ITF-14', description: 'Numeric only - Shipping containers', type: '1D', pattern: '▮▮▯▯▮▯▮▮▯▮▯▯▮▮▯▮▮▯▯▮▯▮▮▯' },
];

// Label Sizes
const LABEL_SIZES = [
  { id: 'small', name: 'Small (1" x 0.5")', width: 25, height: 13 },
  { id: 'medium', name: 'Medium (2" x 1")', width: 51, height: 25 },
  { id: 'large', name: 'Large (3" x 1.5")', width: 76, height: 38 },
  { id: 'cryolabel', name: 'Cryo Label (1.28" x 0.5")', width: 33, height: 13 },
  { id: 'slide', name: 'Microscope Slide (1" x 0.375")', width: 25, height: 10 },
  { id: 'tube', name: 'Tube Wrap (1.5" x 0.5")', width: 38, height: 13 },
];

// Event Types
const EVENT_TYPES = [
  'Created', 'Processed', 'Aliquoted', 'Stored', 'Retrieved',
  'Shipped', 'Received', 'Disposed', 'Quality Check', 'Thawed',
  'Frozen', 'Transferred', 'Split', 'Pooled', 'Labeled',
];

// Event Icons
const EVENT_ICONS: Record<string, string> = {
  'Created': '🆕', 'Processed': '⚗️', 'Aliquoted': '🧫', 'Stored': '📦', 'Retrieved': '📤',
  'Shipped': '🚚', 'Received': '📥', 'Disposed': '🗑️', 'Quality Check': '✅', 'Thawed': '🌡️',
  'Frozen': '❄️', 'Transferred': '🔄', 'Split': '✂️', 'Pooled': '🔗', 'Labeled': '🏷️',
};

// Real barcode using bwip-js
const BarcodePreview = ({ type, sampleId }: { type: string; sampleId: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bwipType: Record<string, string> = {
    qrcode: 'qrcode', datamatrix: 'datamatrix', pdf417: 'pdf417',
    code128: 'code128', code39: 'code39', ean13: 'ean13', upc: 'upca',
  };
  const bctype = bwipType[type] || 'code128';
  const is2D = ['qrcode', 'datamatrix', 'pdf417', 'aztec'].includes(type);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      bwipjs.toCanvas(canvas, {
        bcid: bctype,
        text: sampleId || 'SAMPLE',
        scale: 2,
        height: is2D ? 20 : 10,
        includetext: !is2D,
        textxalign: 'center',
      });
    } catch {
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.fillStyle = '#ccc'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }
  }, [type, sampleId, bctype, is2D]);

  return <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }} />;
};

export default function SampleHubPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'samples' | 'events' | 'labels' | 'import' | 'analytics'>('samples');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample state - starts empty
  const [samples, setSamples] = useState<Sample[]>([]);

  const [events, setEvents] = useState<SampleEvent[]>([]);

  // Modal states
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewSample, setViewSample] = useState<Sample | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [viewEvent, setViewEvent] = useState<SampleEvent | null>(null);
  const [editEventMode, setEditEventMode] = useState(false);

  // Selection states
  const [selectedSamples, setSelectedSamples] = useState<Set<number>>(new Set());
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkEventDeleteConfirm, setBulkEventDeleteConfirm] = useState(false);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [eventSampleFilter, setEventSampleFilter] = useState('all');

  // Label printing state
  const [selectedBarcodeType, setSelectedBarcodeType] = useState('code128');
  const [selectedLabelSize, setSelectedLabelSize] = useState('medium');
  const [labelContent, setLabelContent] = useState({
    showSampleId: true,
    showType: true,
    showDate: true,
    showLocation: false,
    showOwner: false,
    showCustomText: false,
    customText: '',
  });
  const [labelsForPrint, setLabelsForPrint] = useState<Sample[]>([]);
  const [showLabelPreviewModal, setShowLabelPreviewModal] = useState(false);

  // Enhanced label management
  interface LabelItem {
    id: number;
    sampleId: string;
    displayName: string;
    displayNumber: string;
    type: string;
    date: string;
    location: string;
    owner: string;
    customText: string;
    copies: number;
    selected: boolean;
  }
  const [labelQueue, setLabelQueue] = useState<LabelItem[]>([]);
  const [editingLabel, setEditingLabel] = useState<LabelItem | null>(null);
  const [showAddLabelModal, setShowAddLabelModal] = useState(false);
  const [newLabelData, setNewLabelData] = useState({
    displayName: '',
    displayNumber: '',
    customText: '',
    copies: 1,
  });

  // Import state
  const [isDragging, setIsDragging] = useState(false);
  const [importedData, setImportedData] = useState<Partial<Sample>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [showImportPreview, setShowImportPreview] = useState(false);

  // Form state for new sample
  const [newSample, setNewSample] = useState({
    type: '',
    customType: '',
    location: '',
    customLocation: '',
    owner: '',
    quantity: '',
    unit: 'mL',
    temperature: '',
    notes: '',
    parentSampleId: '',
  });

  // New event form
  const [newEvent, setNewEvent] = useState({
    sampleId: '',
    event: '',
    details: '',
  });

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Generate Sample ID
  const generateSampleId = () => {
    const num = Math.floor(Math.random() * 900000) + 100000;
    return `SMP-${num}`;
  };

  // Status colors
  const statusColors: Record<string, { bg: string; text: string }> = {
    processing: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    stored: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    disposed: { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' },
    shipped: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    quarantine: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  };

  // Filter samples
  const filteredSamples = samples.filter(s => {
    const matchesSearch = s.sampleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || s.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || s.location === locationFilter;
    return matchesSearch && matchesType && matchesStatus && matchesLocation;
  });

  // Filter events
  const filteredEvents = events.filter(e => {
    const matchesSearch = e.sampleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.user.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEvent = eventFilter === 'all' || e.event === eventFilter;
    const matchesSample = eventSampleFilter === 'all' || e.sampleId === eventSampleFilter;
    return matchesSearch && matchesEvent && matchesSample;
  });

  // Selection handlers - Samples
  const selectAllSamples = () => setSelectedSamples(new Set(filteredSamples.map(s => s.id)));
  const selectNoneSamples = () => setSelectedSamples(new Set());
  const toggleSampleSelection = (id: number) => {
    setSelectedSamples(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Selection handlers - Events
  const selectAllEvents = () => setSelectedEvents(new Set(filteredEvents.map(e => e.id)));
  const selectNoneEvents = () => setSelectedEvents(new Set());
  const toggleEventSelection = (id: number) => {
    setSelectedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Create sample
  const handleCreateSample = () => {
    const type = newSample.type === '__custom__' ? newSample.customType : newSample.type;
    const location = newSample.location === '__custom__' ? newSample.customLocation : newSample.location;

    if (!type || !location) {
      showToast('Please fill in required fields', 'error');
      return;
    }

    const sample: Sample = {
      id: Date.now(),
      sampleId: generateSampleId(),
      type,
      status: 'processing',
      location,
      date: new Date().toISOString().slice(0, 10),
      owner: newSample.owner || 'Unknown',
      quantity: newSample.quantity || '1',
      unit: newSample.unit,
      temperature: newSample.temperature || 'Room Temperature (20-25°C)',
      notes: newSample.notes,
      parentSampleId: newSample.parentSampleId || undefined,
    };

    setSamples(prev => [...prev, sample]);

    // Add creation event
    const event: SampleEvent = {
      id: Date.now(),
      sampleId: sample.sampleId,
      event: 'Created',
      user: newSample.owner || 'System',
      timestamp: new Date().toLocaleString(),
      details: newSample.parentSampleId ? `Derived from ${newSample.parentSampleId}` : 'New sample registered',
    };
    setEvents(prev => [...prev, event]);

    setNewSample({ type: '', customType: '', location: '', customLocation: '', owner: '', quantity: '', unit: 'mL', temperature: '', notes: '', parentSampleId: '' });
    setShowSampleModal(false);
    showToast('Sample created successfully!', 'success');
  };

  // Update sample
  const handleUpdateSample = () => {
    if (!viewSample) return;
    setSamples(prev => prev.map(s => s.id === viewSample.id ? viewSample : s));
    setViewSample(null);
    setEditMode(false);
    showToast('Sample updated successfully!', 'success');
  };

  // Delete sample
  const handleDeleteSample = (sample: Sample) => {
    setSamples(prev => prev.filter(s => s.id !== sample.id));
    showToast('Sample deleted', 'success');
  };

  // Bulk delete samples
  const handleBulkDelete = () => {
    setSamples(prev => prev.filter(s => !selectedSamples.has(s.id)));
    setSelectedSamples(new Set());
    setBulkDeleteConfirm(false);
    showToast(`${selectedSamples.size} samples deleted`, 'success');
  };

  // Bulk status change
  const handleBulkStatusChange = (newStatus: Sample['status']) => {
    setSamples(prev => prev.map(s =>
      selectedSamples.has(s.id) ? { ...s, status: newStatus } : s
    ));
    showToast(`${selectedSamples.size} samples updated to ${newStatus}`, 'success');
    setSelectedSamples(new Set());
  };

  // Add event
  const handleAddEvent = () => {
    if (!newEvent.sampleId || !newEvent.event) {
      showToast('Please fill in required fields', 'error');
      return;
    }

    const event: SampleEvent = {
      id: Date.now(),
      sampleId: newEvent.sampleId,
      event: newEvent.event,
      user: 'Current User',
      timestamp: new Date().toLocaleString(),
      details: newEvent.details,
    };

    setEvents(prev => [...prev, event]);
    setNewEvent({ sampleId: '', event: '', details: '' });
    setShowEventModal(false);
    showToast('Event logged successfully!', 'success');
  };

  // Update event
  const handleUpdateEvent = () => {
    if (!viewEvent) return;
    setEvents(prev => prev.map(e => e.id === viewEvent.id ? viewEvent : e));
    setViewEvent(null);
    setEditEventMode(false);
    showToast('Event updated successfully!', 'success');
  };

  // Delete event
  const handleDeleteEvent = (event: SampleEvent) => {
    setEvents(prev => prev.filter(e => e.id !== event.id));
    showToast('Event deleted', 'success');
  };

  // Bulk delete events
  const handleBulkDeleteEvents = () => {
    setEvents(prev => prev.filter(e => !selectedEvents.has(e.id)));
    setSelectedEvents(new Set());
    setBulkEventDeleteConfirm(false);
    showToast(`${selectedEvents.size} events deleted`, 'success');
  };

  // Export samples
  const exportToCSV = () => {
    const headers = 'Sample ID,Type,Status,Location,Date,Owner,Quantity,Unit,Temperature,Notes\n';
    const rows = samples.map(s =>
      `${s.sampleId},"${s.type}",${s.status},"${s.location}",${s.date},"${s.owner}",${s.quantity},${s.unit},"${s.temperature}","${s.notes}"`
    ).join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'samples.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported to CSV', 'success');
  };

  // Export events
  const exportEventsToCSV = () => {
    const headers = 'Sample ID,Event,User,Timestamp,Details\n';
    const rows = events.map(e =>
      `${e.sampleId},"${e.event}","${e.user}","${e.timestamp}","${e.details || ''}"`
    ).join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chain_of_custody.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Chain of Custody exported', 'success');
  };

  // Label queue management
  const addSamplesToLabelQueue = (samplesToAdd: Sample[]) => {
    const newLabels: LabelItem[] = samplesToAdd.map(s => ({
      id: s.id,
      sampleId: s.sampleId,
      displayName: s.sampleId,
      displayNumber: s.sampleId.split('-')[1] || s.sampleId,
      type: s.type,
      date: s.date,
      location: s.location,
      owner: s.owner,
      customText: '',
      copies: 1,
      selected: true,
    }));
    // Add only samples not already in queue
    const existingIds = new Set(labelQueue.map(l => l.id));
    const uniqueLabels = newLabels.filter(l => !existingIds.has(l.id));
    setLabelQueue([...labelQueue, ...uniqueLabels]);
    if (uniqueLabels.length > 0) {
      showToast(`Added ${uniqueLabels.length} labels to queue`, 'success');
    } else {
      showToast('Labels already in queue', 'error');
    }
  };

  const selectAllLabels = () => setLabelQueue(labelQueue.map(l => ({ ...l, selected: true })));
  const selectNoneLabels = () => setLabelQueue(labelQueue.map(l => ({ ...l, selected: false })));
  const toggleLabelSelection = (id: number) => {
    setLabelQueue(labelQueue.map(l => l.id === id ? { ...l, selected: !l.selected } : l));
  };

  const updateLabelCopies = (id: number, copies: number) => {
    setLabelQueue(labelQueue.map(l => l.id === id ? { ...l, copies: Math.max(1, copies) } : l));
  };

  const updateAllCopies = (copies: number) => {
    setLabelQueue(labelQueue.map(l => l.selected ? { ...l, copies: Math.max(1, copies) } : l));
    showToast(`Updated copies for ${labelQueue.filter(l => l.selected).length} labels`, 'success');
  };

  const removeLabelFromQueue = (id: number) => {
    setLabelQueue(labelQueue.filter(l => l.id !== id));
    showToast('Label removed from queue', 'success');
  };

  const removeSelectedLabels = () => {
    const selectedCount = labelQueue.filter(l => l.selected).length;
    setLabelQueue(labelQueue.filter(l => !l.selected));
    showToast(`Removed ${selectedCount} labels from queue`, 'success');
  };

  const updateLabel = (updatedLabel: LabelItem) => {
    setLabelQueue(labelQueue.map(l => l.id === updatedLabel.id ? updatedLabel : l));
    setEditingLabel(null);
    showToast('Label updated', 'success');
  };

  const addCustomLabel = () => {
    if (!newLabelData.displayName) {
      showToast('Please enter a display name', 'error');
      return;
    }
    const newLabel: LabelItem = {
      id: Date.now(),
      sampleId: `CUSTOM-${Date.now()}`,
      displayName: newLabelData.displayName,
      displayNumber: newLabelData.displayNumber || newLabelData.displayName,
      type: 'Custom',
      date: new Date().toISOString().slice(0, 10),
      location: '',
      owner: '',
      customText: newLabelData.customText,
      copies: newLabelData.copies || 1,
      selected: true,
    };
    setLabelQueue([...labelQueue, newLabel]);
    setNewLabelData({ displayName: '', displayNumber: '', customText: '', copies: 1 });
    setShowAddLabelModal(false);
    showToast('Custom label added', 'success');
  };

  // Print labels
  const handlePrintLabels = (printAll: boolean) => {
    const samplesToPrint = printAll ? samples : samples.filter(s => selectedSamples.has(s.id));
    if (samplesToPrint.length === 0) {
      showToast('No samples selected', 'error');
      return;
    }
    setLabelsForPrint(samplesToPrint);
    setShowLabelPreviewModal(true);
  };

  const handlePrintFromQueue = () => {
    const selectedLabels = labelQueue.filter(l => l.selected);
    if (selectedLabels.length === 0) {
      showToast('No labels selected', 'error');
      return;
    }

    // Print directly
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow popups to print', 'error');
      return;
    }

    const labelSize = LABEL_SIZES.find(s => s.id === selectedLabelSize)!;

    // Generate labels with copies
    let labelsHtml = '';
    selectedLabels.forEach(label => {
      for (let i = 0; i < label.copies; i++) {
        labelsHtml += `
          <div class="label">
            <div style="font-weight: bold; font-size: 14px;">${label.displayName}</div>
            ${label.displayNumber !== label.displayName ? `<div style="font-family: monospace; font-size: 12px;">${label.displayNumber}</div>` : ''}
            ${labelContent.showType && label.type ? `<div>${label.type}</div>` : ''}
            ${labelContent.showDate && label.date ? `<div>${label.date}</div>` : ''}
            ${labelContent.showLocation && label.location ? `<div>${label.location}</div>` : ''}
            ${labelContent.showOwner && label.owner ? `<div>${label.owner}</div>` : ''}
            ${label.customText ? `<div style="font-style: italic;">${label.customText}</div>` : ''}
            <div style="margin-top: 8px; font-family: monospace; letter-spacing: 3px; font-size: 18px;">|||||||||||||||</div>
          </div>
        `;
      }
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Labels</title>
          <style>
            @media print { @page { margin: 0.5cm; } }
            body { font-family: Arial, sans-serif; padding: 10px; }
            .label {
              display: inline-block;
              border: 1px solid #ccc;
              padding: 12px;
              margin: 6px;
              width: ${labelSize.width * 3}px;
              min-height: ${labelSize.height * 3}px;
              page-break-inside: avoid;
              font-size: 11px;
              vertical-align: top;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();

    const totalPrinted = selectedLabels.reduce((sum, l) => sum + l.copies, 0);
    showToast(`Printing ${totalPrinted} labels`, 'success');
  };

  const getTotalLabelCount = () => {
    return labelQueue.filter(l => l.selected).reduce((sum, l) => sum + l.copies, 0);
  };

  // Print label preview
  const printLabels = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelSize = LABEL_SIZES.find(s => s.id === selectedLabelSize)!;

    // Get labels with copies
    const labelsWithCopies: { sample: typeof labelsForPrint[0], copies: number }[] = [];
    labelsForPrint.forEach(s => {
      const queueItem = labelQueue.find(l => l.id === s.id);
      const copies = queueItem?.copies || 1;
      labelsWithCopies.push({ sample: s, copies });
    });

    const totalLabels = labelsWithCopies.reduce((sum, l) => sum + l.copies, 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Labels</title>
          <style>
            @media print { @page { margin: 0.5cm; } }
            body { font-family: Arial, sans-serif; }
            .label {
              display: inline-block;
              border: 1px solid #ccc;
              padding: 8px;
              margin: 4px;
              width: ${labelSize.width * 3}px;
              page-break-inside: avoid;
            }
            .barcode { font-family: 'Libre Barcode 128', monospace; font-size: 24px; }
            .qrcode { display: inline-block; width: 50px; height: 50px; background: #000; }
          </style>
        </head>
        <body>
          ${labelsWithCopies.map(({ sample: s, copies }) => {
            const queueItem = labelQueue.find(l => l.id === s.id);
            const displayName = queueItem?.displayName || s.sampleId;
            const customText = queueItem?.customText || '';
            return Array(copies).fill(null).map(() => `
              <div class="label">
                <div style="font-weight: bold;">${displayName}</div>
                ${labelContent.showType ? `<div>${s.type}</div>` : ''}
                ${labelContent.showDate ? `<div>${s.date}</div>` : ''}
                ${labelContent.showLocation ? `<div>${s.location}</div>` : ''}
                ${labelContent.showOwner ? `<div>${s.owner}</div>` : ''}
                ${customText ? `<div style="font-style: italic;">${customText}</div>` : ''}
                ${labelContent.showCustomText && labelContent.customText ? `<div>${labelContent.customText}</div>` : ''}
                <div style="margin-top: 4px; font-family: monospace; letter-spacing: 2px;">|||||||||||||||</div>
              </div>
            `).join('');
          }).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    showToast(`Printing ${totalLabels} labels`, 'success');
    setShowLabelPreviewModal(false);
  };

  // File import handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        showToast('File must have header and at least one data row', 'error');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const data: Partial<Sample>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
        const sample: Partial<Sample> = {};

        headers.forEach((header, idx) => {
          const value = values[idx] || '';
          if (header.includes('id') || header.includes('sample')) sample.sampleId = value || generateSampleId();
          else if (header.includes('type')) sample.type = value;
          else if (header.includes('status')) sample.status = value as Sample['status'];
          else if (header.includes('location')) sample.location = value;
          else if (header.includes('owner')) sample.owner = value;
          else if (header.includes('quantity')) sample.quantity = value;
          else if (header.includes('unit')) sample.unit = value;
          else if (header.includes('temperature') || header.includes('temp')) sample.temperature = value;
          else if (header.includes('note')) sample.notes = value;
        });

        if (sample.type || sample.sampleId) {
          data.push(sample);
        }
      }

      setImportedData(data);
      setShowImportPreview(true);
      showToast(`Found ${data.length} samples to import`, 'success');
    };

    reader.onerror = () => {
      showToast('Error reading file', 'error');
    };

    reader.readAsText(file);
  };

  const confirmImport = () => {
    const newSamples: Sample[] = importedData.map((data, idx) => ({
      id: Date.now() + idx,
      sampleId: data.sampleId || generateSampleId(),
      type: data.type || 'Unknown',
      status: data.status || 'processing',
      location: data.location || 'Lab Bench',
      date: new Date().toISOString().slice(0, 10),
      owner: data.owner || 'Imported',
      quantity: data.quantity || '1',
      unit: data.unit || 'mL',
      temperature: data.temperature || 'Room Temperature (20-25°C)',
      notes: data.notes || 'Batch imported',
    }));

    setSamples(prev => [...prev, ...newSamples]);

    // Add import events
    const newEvents = newSamples.map((s, idx) => ({
      id: Date.now() + idx + 1000,
      sampleId: s.sampleId,
      event: 'Created',
      user: 'Batch Import',
      timestamp: new Date().toLocaleString(),
      details: `Imported from ${importFileName}`,
    }));
    setEvents(prev => [...prev, ...newEvents]);

    setShowImportPreview(false);
    setImportedData([]);
    setImportFileName('');
    showToast(`${newSamples.length} samples imported successfully!`, 'success');
  };

  const tabs = [
    { key: 'samples', label: 'Samples', icon: '🧪', count: samples.length },
    { key: 'events', label: 'Chain of Custody', icon: '⏱', count: events.length },
    { key: 'labels', label: 'Print Labels', icon: '🏷️' },
    { key: 'import', label: 'Batch Import', icon: '📤' },
    { key: 'analytics', label: 'Analytics', icon: '📊' },
  ];

  const modalStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  };

  const modalContentStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, padding: 24, width: 600, maxHeight: '90vh', overflow: 'auto'
  };

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, padding: '12px 20px', borderRadius: 8,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
          color: 'white', fontWeight: 500, fontSize: 14, zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Sample Management</h1>
            <span style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
              {samples.length} Samples
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Track and manage laboratory samples with full chain of custody</p>
        </div>
        <button
          onClick={() => exportToCSV()}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}
        >
          📥 Export CSV
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total', value: samples.length, color: 'var(--text)', icon: '🧪' },
          { label: 'Processing', value: samples.filter(s => s.status === 'processing').length, color: '#fbbf24', icon: '⏳' },
          { label: 'Stored', value: samples.filter(s => s.status === 'stored').length, color: '#4ade80', icon: '📦' },
          { label: 'Shipped', value: samples.filter(s => s.status === 'shipped').length, color: '#60a5fa', icon: '🚚' },
          { label: 'Quarantine', value: samples.filter(s => s.status === 'quarantine').length, color: '#f87171', icon: '⚠️' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Alert banners */}
      {(() => {
        const quarantine = samples.filter(s => s.status === 'quarantine');
        const disposed = samples.filter(s => s.status === 'disposed');
        if (quarantine.length === 0 && disposed.length === 0) return null;
        return (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {quarantine.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderLeft: '4px solid #ef4444', borderRadius: 8 }}>
                <span>🚫</span>
                <span style={{ color: '#f87171', fontWeight: 600, fontSize: 13 }}>{quarantine.length} sample{quarantine.length > 1 ? 's' : ''} in quarantine</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{quarantine.map(s => s.sampleId).join(', ')}</span>
                <button onClick={() => setStatusFilter('quarantine')} style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Filter →</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { icon: '🏷️', label: 'Print Labels', action: () => setActiveTab('labels') },
          { icon: '📥', label: 'Batch Import', action: () => setActiveTab('import') },
          { icon: '📊', label: 'Analytics', action: () => setActiveTab('analytics') },
          { icon: '📋', label: 'Protocols', action: () => navigate('protocols') },
          { icon: '📄', label: 'Export CSV', action: () => exportToCSV() },
        ].map(a => (
          <button key={a.label} onClick={a.action} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20,
            color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#22c55e'; (e.currentTarget as HTMLButtonElement).style.color = '#22c55e'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            <span>{a.icon}</span><span>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs-row" style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
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
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && (
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

      {/* Samples Tab */}
      {activeTab === 'samples' && (
        <div>
          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Search samples..."
                className="form-input"
                style={{ width: 200 }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select className="form-select" style={{ width: 130 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">All Types</option>
                {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="processing">Processing</option>
                <option value="stored">Stored</option>
                <option value="shipped">Shipped</option>
                <option value="quarantine">Quarantine</option>
                <option value="disposed">Disposed</option>
              </select>
              <select className="form-select" style={{ width: 150 }} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                <option value="all">All Locations</option>
                {STORAGE_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {(typeFilter !== 'all' || statusFilter !== 'all' || locationFilter !== 'all' || searchQuery) && (
                <button
                  className="btn btn-sm"
                  onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setLocationFilter('all'); setSearchQuery(''); }}
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 500 }}
                >
                  ✕ Clear Filters
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const visibleSamples = filteredSamples ?? samples;
                exportCSV(visibleSamples.map((s: any) => ({ Barcode: s.barcode, Name: s.name || '', Type: s.sample_type, Status: s.status, Location: s.storage_location || '', 'Received On': s.received_on || '', Notes: s.notes || '' })), 'samples');
              }}>⬇ CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const visibleSamples = filteredSamples ?? samples;
                exportPDF('Sample Registry', ['Barcode','Name','Type','Status','Location','Received On'],
                  visibleSamples.map((s: any) => [s.barcode, s.name || '', s.sample_type, s.status, s.storage_location || '', s.received_on || '']), 'samples');
              }}>⬇ PDF</button>
              <button className="btn btn-primary" onClick={() => setShowSampleModal(true)}>+ New Sample</button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.1))',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-sm" onClick={selectAllSamples} style={{ background: '#22c55e', color: 'white', border: 'none', fontWeight: 500 }}>
                Select All
              </button>
              <button className="btn btn-sm" onClick={selectNoneSamples} style={{ background: 'white', color: '#22c55e', border: '1px solid #22c55e', fontWeight: 500 }}>
                Clear
              </button>
              <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, padding: '4px 12px', background: 'white', borderRadius: 20 }}>
                {selectedSamples.size} of {filteredSamples.length} selected
              </span>
            </div>
            {selectedSamples.size > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-sm" style={{ background: '#8b5cf6', color: 'white', border: 'none', fontWeight: 500, padding: '8px 16px', borderRadius: 8 }}
                  onClick={() => {
                    const selectedSamplesList = samples.filter(s => selectedSamples.has(s.id));
                    addSamplesToLabelQueue(selectedSamplesList);
                    setActiveTab('labels');
                  }}>
                  🖨️ Print ({selectedSamples.size})
                </button>
                <select
                  className="form-select"
                  style={{ width: 160, height: 36, fontSize: 13, fontWeight: 500 }}
                  onChange={e => { if (e.target.value) handleBulkStatusChange(e.target.value as Sample['status']); e.target.value = ''; }}
                  defaultValue=""
                >
                  <option value="" disabled>Change Status</option>
                  <option value="processing">Set Processing</option>
                  <option value="stored">Set Stored</option>
                  <option value="shipped">Set Shipped</option>
                  <option value="quarantine">Set Quarantine</option>
                  <option value="disposed">Set Disposed</option>
                </select>
                <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white', border: 'none', fontWeight: 500, padding: '8px 16px', borderRadius: 8 }}
                  onClick={() => setBulkDeleteConfirm(true)}>
                  Delete ({selectedSamples.size})
                </button>
              </div>
            )}
          </div>

          {/* Samples Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={{ padding: 12, width: 40 }}>
                    <input type="checkbox" checked={selectedSamples.size === filteredSamples.length && filteredSamples.length > 0}
                      onChange={e => e.target.checked ? selectAllSamples() : selectNoneSamples()} style={{ cursor: 'pointer' }} />
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Sample ID</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Type</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Location</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Owner</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Quantity</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Date</th>
                  <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSamples.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--border)', background: selectedSamples.has(s.id) ? 'rgba(34,197,94,0.05)' : 'transparent' }}>
                    <td style={{ padding: 12 }}>
                      <input type="checkbox" checked={selectedSamples.has(s.id)} onChange={() => toggleSampleSelection(s.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: 12, fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{s.sampleId}</td>
                    <td style={{ padding: 12, fontSize: 13 }}>{s.type}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: statusColors[s.status]?.bg, color: statusColors[s.status]?.text }}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{s.location}</td>
                    <td style={{ padding: 12, fontSize: 13 }}>{s.owner}</td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{s.quantity} {s.unit}</td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{s.date}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      <button className="btn btn-sm btn-secondary" style={{ marginRight: 6, fontSize: 12 }} onClick={() => { setViewSample(s); setEditMode(false); }}>
                        👁️ View
                      </button>
                      <button className="btn btn-sm btn-secondary" style={{ marginRight: 6, fontSize: 12 }} onClick={() => { setViewSample(s); setEditMode(true); }}>
                        ✏️ Edit
                      </button>
                      <button className="btn btn-sm" style={{ marginRight: 6, fontSize: 12, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: 'none' }}
                        onClick={() => { addSamplesToLabelQueue([s]); setActiveTab('labels'); }}>
                        🖨️ Print
                      </button>
                      <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', fontSize: 12 }}
                        onClick={() => handleDeleteSample(s)}>
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSamples.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 40, textAlign: 'center' }}>
                      {samples.length === 0 ? (
                        <div>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>🧪</div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>No samples yet</div>
                          <button className="btn btn-primary btn-sm" onClick={() => setShowSampleModal(true)}>+ Add First Sample</button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>No samples match your filters</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                            {samples.length} sample{samples.length !== 1 ? 's' : ''} total, but hidden by current filters
                          </div>
                          <button
                            className="btn btn-sm"
                            onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setLocationFilter('all'); setSearchQuery(''); }}
                            style={{ background: '#8b5cf6', color: 'white', border: 'none' }}
                          >
                            Show All Samples
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Events/Chain of Custody Tab */}
      {activeTab === 'events' && (
        <div>
          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" placeholder="🔍 Search events..." className="form-input" style={{ width: 200 }}
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <select className="form-select" style={{ width: 150 }} value={eventFilter} onChange={e => setEventFilter(e.target.value)}>
                <option value="all">All Events</option>
                {EVENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select className="form-select" style={{ width: 150 }} value={eventSampleFilter} onChange={e => setEventSampleFilter(e.target.value)}>
                <option value="all">All Samples</option>
                {samples.map(s => <option key={s.id} value={s.sampleId}>{s.sampleId}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={exportEventsToCSV}>📥 Export</button>
              <button className="btn btn-primary" onClick={() => setShowEventModal(true)}>+ Log Event</button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.1))',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-sm" onClick={selectAllEvents} style={{ background: '#3b82f6', color: 'white', border: 'none', fontWeight: 500 }}>
                Select All
              </button>
              <button className="btn btn-sm" onClick={selectNoneEvents} style={{ background: 'white', color: '#3b82f6', border: '1px solid #3b82f6', fontWeight: 500 }}>
                Clear
              </button>
              <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, padding: '4px 12px', background: 'white', borderRadius: 20 }}>
                {selectedEvents.size} of {filteredEvents.length} selected
              </span>
            </div>
            {selectedEvents.size > 0 && (
              <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white', border: 'none', fontWeight: 500, padding: '8px 16px', borderRadius: 8 }}
                onClick={() => setBulkEventDeleteConfirm(true)}>
                Delete ({selectedEvents.size})
              </button>
            )}
          </div>

          {/* Events Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={{ padding: 12, width: 40 }}>
                    <input type="checkbox" checked={selectedEvents.size === filteredEvents.length && filteredEvents.length > 0}
                      onChange={e => e.target.checked ? selectAllEvents() : selectNoneEvents()} style={{ cursor: 'pointer' }} />
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Sample ID</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Event</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>User</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Details</th>
                  <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map(e => (
                  <tr key={e.id} style={{ borderTop: '1px solid var(--border)', background: selectedEvents.has(e.id) ? 'rgba(59,130,246,0.05)' : 'transparent' }}>
                    <td style={{ padding: 12 }}>
                      <input type="checkbox" checked={selectedEvents.has(e.id)} onChange={() => toggleEventSelection(e.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: 12, fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{e.sampleId}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16 }}>{EVENT_ICONS[e.event] || '📝'}</span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{e.event}</span>
                      </span>
                    </td>
                    <td style={{ padding: 12, fontSize: 13 }}>{e.user}</td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{e.timestamp}</td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.details || '-'}</td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      <button className="btn btn-sm btn-secondary" style={{ marginRight: 6, fontSize: 12 }} onClick={() => { setViewEvent(e); setEditEventMode(false); }}>
                        👁️ View
                      </button>
                      <button className="btn btn-sm btn-secondary" style={{ marginRight: 6, fontSize: 12 }} onClick={() => { setViewEvent(e); setEditEventMode(true); }}>
                        ✏️ Edit
                      </button>
                      <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', fontSize: 12 }}
                        onClick={() => handleDeleteEvent(e)}>
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No events found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print Labels Tab */}
      {activeTab === 'labels' && (
        <div>
          {/* Simplified Single Card Layout */}
          <div className="card">
            {/* Header with Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Print Labels</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  {labelQueue.length > 0
                    ? `${labelQueue.length} labels in queue (${getTotalLabelCount()} total copies)`
                    : 'Add samples or create custom labels to print'
                  }
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => addSamplesToLabelQueue(samples)}>
                  + Add All Samples
                </button>
                <button className="btn btn-primary" onClick={() => setShowAddLabelModal(true)}>
                  + Create Label
                </button>
              </div>
            </div>

            {/* Settings Row - Compact */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, padding: 16, background: 'var(--surface2)', borderRadius: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Barcode Type</label>
                <select className="form-select" style={{ width: '100%' }} value={selectedBarcodeType} onChange={e => setSelectedBarcodeType(e.target.value)}>
                  {BARCODE_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.name} ({type.type})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Label Size</label>
                <select className="form-select" style={{ width: '100%' }} value={selectedLabelSize} onChange={e => setSelectedLabelSize(e.target.value)}>
                  {LABEL_SIZES.map(size => <option key={size.id} value={size.id}>{size.name}</option>)}
                </select>
              </div>
              <div style={{ flex: '2 1 300px' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Show on Label</label>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { key: 'showType', label: 'Type' },
                    { key: 'showDate', label: 'Date' },
                    { key: 'showLocation', label: 'Location' },
                    { key: 'showOwner', label: 'Owner' },
                  ].map(item => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox"
                        checked={labelContent[item.key as keyof typeof labelContent] as boolean}
                        onChange={e => setLabelContent({ ...labelContent, [item.key]: e.target.checked })} />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Label Queue - Empty State */}
            {labelQueue.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface2)', borderRadius: 10, marginBottom: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏷️</div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Labels in Queue</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Add samples from the list or create custom labels
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn btn-secondary" onClick={() => addSamplesToLabelQueue(samples)}>
                    + Add All {samples.length} Samples
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowAddLabelModal(true)}>
                    + Create Custom Label
                  </button>
                </div>
              </div>
            )}

            {/* Label Queue - With Items */}
            {labelQueue.length > 0 && (
              <>
                {/* Bulk Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="btn btn-sm" onClick={selectAllLabels} style={{ background: '#8b5cf6', color: 'white', border: 'none' }}>
                      Select All
                    </button>
                    <button className="btn btn-sm" onClick={selectNoneLabels} style={{ background: 'transparent', color: '#8b5cf6', border: '1px solid #8b5cf6' }}>
                      None
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {labelQueue.filter(l => l.selected).length} selected
                    </span>
                  </div>
                  {labelQueue.some(l => l.selected) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Copies:</span>
                      <input type="number" min="1" max="100" defaultValue={1}
                        className="form-input" style={{ width: 60, height: 32, textAlign: 'center' }}
                        onBlur={e => updateAllCopies(parseInt(e.target.value) || 1)} />
                      <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white', border: 'none' }}
                        onClick={removeSelectedLabels}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Labels Table - Simplified */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        <th style={{ padding: 10, width: 40 }}>
                          <input type="checkbox" checked={labelQueue.every(l => l.selected) && labelQueue.length > 0}
                            onChange={e => e.target.checked ? selectAllLabels() : selectNoneLabels()} />
                        </th>
                        <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Label Name</th>
                        <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Type</th>
                        <th style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Custom Text</th>
                        <th style={{ padding: 10, textAlign: 'center', fontSize: 12, fontWeight: 600, width: 80 }}>Copies</th>
                        <th style={{ padding: 10, textAlign: 'center', fontSize: 12, fontWeight: 600, width: 80 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labelQueue.map(label => (
                        <tr key={label.id} style={{ borderTop: '1px solid var(--border)', background: label.selected ? 'rgba(139,92,246,0.03)' : 'transparent' }}>
                          <td style={{ padding: 10 }}>
                            <input type="checkbox" checked={label.selected} onChange={() => toggleLabelSelection(label.id)} />
                          </td>
                          <td style={{ padding: 10 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)' }}>{label.displayName}</div>
                            {label.displayNumber !== label.displayName && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{label.displayNumber}</div>
                            )}
                          </td>
                          <td style={{ padding: 10, fontSize: 13 }}>{label.type}</td>
                          <td style={{ padding: 10, fontSize: 13, color: label.customText ? 'var(--text)' : 'var(--text-muted)' }}>
                            {label.customText || '-'}
                          </td>
                          <td style={{ padding: 10, textAlign: 'center' }}>
                            <input type="number" min="1" max="100" value={label.copies}
                              onChange={e => updateLabelCopies(label.id, parseInt(e.target.value) || 1)}
                              className="form-input" style={{ width: 50, height: 28, textAlign: 'center', fontSize: 13 }} />
                          </td>
                          <td style={{ padding: 10, textAlign: 'center' }}>
                            <button onClick={() => setEditingLabel(label)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, marginRight: 4 }} title="Edit">✏️</button>
                            <button onClick={() => removeLabelFromQueue(label.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} title="Remove">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Print Button - Prominent */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(168,85,247,0.1))', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#8b5cf6' }}>Ready to Print</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>{getTotalLabelCount()} Labels</div>
                  </div>
                  <button className="btn btn-primary" onClick={handlePrintFromQueue}
                    disabled={!labelQueue.some(l => l.selected)}
                    style={{
                      opacity: labelQueue.some(l => l.selected) ? 1 : 0.5,
                      fontSize: 16,
                      padding: '14px 28px',
                      background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                      border: 'none'
                    }}>
                    🖨️ Print Labels
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Batch Import Tab */}
      {activeTab === 'import' && (
        <div>
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📤</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Batch Import Samples</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Upload CSV file to import multiple samples at once</p>

            <div
              style={{
                border: isDragging ? '2px solid #22c55e' : '2px dashed var(--border)',
                borderRadius: 12,
                padding: 40,
                marginBottom: 24,
                background: isDragging ? 'rgba(34,197,94,0.1)' : 'var(--surface2)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onDragEnter={handleDragEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{isDragging ? '📥' : '📁'}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: isDragging ? '#22c55e' : 'var(--text)' }}>
                {isDragging ? 'Drop file here' : 'Drag & drop files here'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>or click to browse</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Supported: CSV files</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => {
                const template = 'Sample ID,Type,Status,Location,Owner,Quantity,Unit,Temperature,Notes\nSMP-XXXXXX,Blood,stored,Freezer A-1,Dr. Smith,5,mL,-80°C,Sample notes\n,Tissue,processing,Lab Bench,J. Chen,2,g,4°C,Liver biopsy\n,DNA,stored,Freezer B-1,M. Johnson,50,µg,-20°C,Extracted sample';
                const blob = new Blob([template], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sample_import_template.csv';
                a.click();
                showToast('Template downloaded', 'success');
              }}>📥 Download Template</button>
            </div>
          </div>

          {/* Import Instructions */}
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Import Instructions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#22c55e' }}>Required Columns</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0 }}>
                  <li>Type - Sample type (Blood, Tissue, DNA, etc.)</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#3b82f6' }}>Optional Columns</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0 }}>
                  <li>Sample ID - Auto-generated if not provided</li>
                  <li>Status - processing, stored, shipped, quarantine, disposed</li>
                  <li>Location - Storage location</li>
                  <li>Owner - Sample owner/collector</li>
                  <li>Quantity - Amount</li>
                  <li>Unit - mL, µL, g, etc.</li>
                  <li>Temperature - Storage temperature</li>
                  <li>Notes - Additional information</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
            {/* Quick Stats */}
            {[
              { label: 'Total Samples', value: samples.length, icon: '🧪', color: '#22c55e' },
              { label: 'Total Events', value: events.length, icon: '📝', color: '#3b82f6' },
              { label: 'Active Users', value: [...new Set(events.map(e => e.user))].length, icon: '👥', color: '#8b5cf6' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {/* Sample Types Chart */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Samples by Type</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SAMPLE_TYPES.filter(type => samples.some(s => s.type === type)).map(type => {
                  const count = samples.filter(s => s.type === type).length;
                  const percentage = (count / samples.length) * 100;
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{type}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percentage}%`, background: '#22c55e', borderRadius: 4, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Status Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['processing', 'stored', 'shipped', 'quarantine', 'disposed'].map(status => {
                  const count = samples.filter(s => s.status === status).length;
                  const percentage = samples.length > 0 ? (count / samples.length) * 100 : 0;
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[status]?.text }} />
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percentage}%`, background: statusColors[status]?.text, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Storage Locations */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Samples by Location</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STORAGE_LOCATIONS.filter(loc => samples.some(s => s.location === loc)).map(loc => {
                  const count = samples.filter(s => s.location === loc).length;
                  const percentage = (count / samples.length) * 100;
                  return (
                    <div key={loc}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{loc}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percentage}%`, background: '#6366f1', borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Temperature Distribution */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Temperature Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TEMPERATURE_OPTIONS.map(temp => {
                  const count = samples.filter(s => s.temperature === temp).length;
                  const percentage = samples.length > 0 ? (count / samples.length) * 100 : 0;
                  const tempColors: Record<string, string> = {
                    '-196°C (Liquid Nitrogen)': '#06b6d4',
                    '-80°C (Ultra-Low Freezer)': '#3b82f6',
                    '-20°C (Standard Freezer)': '#8b5cf6',
                    '4°C (Refrigerator)': '#22c55e',
                    'Room Temperature (20-25°C)': '#f59e0b',
                  };
                  return (
                    <div key={temp}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12 }}>{temp}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percentage}%`, background: tempColors[temp] || '#6366f1', borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Timeline */}
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Event Activity by Type</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {EVENT_TYPES.map(eventType => {
                  const count = events.filter(e => e.event === eventType).length;
                  if (count === 0) return null;
                  return (
                    <div key={eventType} style={{
                      padding: '8px 16px',
                      background: 'var(--surface2)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span style={{ fontSize: 18 }}>{EVENT_ICONS[eventType]}</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{eventType}</span>
                      <span style={{
                        background: 'var(--accent)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600
                      }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Recent Activity</h3>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                {events.slice(-10).reverse().map(e => (
                  <div key={e.id} style={{
                    minWidth: 180,
                    padding: 16,
                    background: 'var(--surface2)',
                    borderRadius: 12,
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{EVENT_ICONS[e.event] || '📝'}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{e.sampleId}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{e.event}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.user}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{e.timestamp}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Sample Modal */}
      {showSampleModal && (
        <div style={modalStyle} onClick={() => setShowSampleModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>Register New Sample</h3>
              <button onClick={() => setShowSampleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Sample Type *</label>
                <select className="form-select" value={newSample.type} onChange={e => setNewSample({ ...newSample, type: e.target.value })} style={{ width: '100%' }}>
                  <option value="">Select type...</option>
                  {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="__custom__">+ Custom Type</option>
                </select>
                {newSample.type === '__custom__' && (
                  <input type="text" className="form-input" placeholder="Enter custom type..." style={{ marginTop: 8 }}
                    value={newSample.customType} onChange={e => setNewSample({ ...newSample, customType: e.target.value })} />
                )}
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Storage Location *</label>
                <select className="form-select" value={newSample.location} onChange={e => setNewSample({ ...newSample, location: e.target.value })} style={{ width: '100%' }}>
                  <option value="">Select location...</option>
                  {STORAGE_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  <option value="__custom__">+ Custom Location</option>
                </select>
                {newSample.location === '__custom__' && (
                  <input type="text" className="form-input" placeholder="Enter custom location..." style={{ marginTop: 8 }}
                    value={newSample.customLocation} onChange={e => setNewSample({ ...newSample, customLocation: e.target.value })} />
                )}
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Owner / Collector</label>
                <input type="text" className="form-input" placeholder="Enter name..." value={newSample.owner}
                  onChange={e => setNewSample({ ...newSample, owner: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Quantity</label>
                  <input type="text" className="form-input" placeholder="Amount..." value={newSample.quantity}
                    onChange={e => setNewSample({ ...newSample, quantity: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Unit</label>
                  <select className="form-select" value={newSample.unit} onChange={e => setNewSample({ ...newSample, unit: e.target.value })} style={{ width: '100%' }}>
                    {QUANTITY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Storage Temperature</label>
                <select className="form-select" value={newSample.temperature} onChange={e => setNewSample({ ...newSample, temperature: e.target.value })} style={{ width: '100%' }}>
                  <option value="">Select temperature...</option>
                  {TEMPERATURE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Parent Sample (if derived)</label>
                <select className="form-select" value={newSample.parentSampleId} onChange={e => setNewSample({ ...newSample, parentSampleId: e.target.value })} style={{ width: '100%' }}>
                  <option value="">None (New Sample)</option>
                  {samples.map(s => <option key={s.id} value={s.sampleId}>{s.sampleId} - {s.type}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea className="form-input" placeholder="Additional information..." rows={3}
                  value={newSample.notes} onChange={e => setNewSample({ ...newSample, notes: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowSampleModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateSample} style={{ flex: 1 }}>Create Sample</button>
            </div>
          </div>
        </div>
      )}

      {/* View/Edit Sample Modal */}
      {viewSample && (
        <div style={modalStyle} onClick={() => { setViewSample(null); setEditMode(false); }}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{viewSample.sampleId}</h3>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: statusColors[viewSample.status]?.bg, color: statusColors[viewSample.status]?.text }}>
                  {viewSample.status.charAt(0).toUpperCase() + viewSample.status.slice(1)}
                </span>
              </div>
              <button onClick={() => { setViewSample(null); setEditMode(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            {editMode ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
                    <select className="form-select" value={viewSample.type} onChange={e => setViewSample({ ...viewSample, type: e.target.value })} style={{ width: '100%' }}>
                      {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
                    <select className="form-select" value={viewSample.status} onChange={e => setViewSample({ ...viewSample, status: e.target.value as Sample['status'] })} style={{ width: '100%' }}>
                      <option value="processing">Processing</option>
                      <option value="stored">Stored</option>
                      <option value="shipped">Shipped</option>
                      <option value="quarantine">Quarantine</option>
                      <option value="disposed">Disposed</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Location</label>
                  <select className="form-select" value={viewSample.location} onChange={e => setViewSample({ ...viewSample, location: e.target.value })} style={{ width: '100%' }}>
                    {STORAGE_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notes</label>
                  <textarea className="form-input" rows={3} value={viewSample.notes} onChange={e => setViewSample({ ...viewSample, notes: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setEditMode(false)} style={{ flex: 1 }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleUpdateSample} style={{ flex: 1 }}>Save Changes</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  {[
                    { label: 'Type', value: viewSample.type },
                    { label: 'Location', value: viewSample.location },
                    { label: 'Owner', value: viewSample.owner },
                    { label: 'Quantity', value: `${viewSample.quantity} ${viewSample.unit}` },
                    { label: 'Temperature', value: viewSample.temperature },
                    { label: 'Date', value: viewSample.date },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {viewSample.notes && (
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
                    <div style={{ fontSize: 13 }}>{viewSample.notes}</div>
                  </div>
                )}
                <button className="btn btn-primary" onClick={() => setEditMode(true)} style={{ width: '100%' }}>Edit Sample</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View/Edit Event Modal */}
      {viewEvent && (
        <div style={modalStyle} onClick={() => { setViewEvent(null); setEditEventMode(false); }}>
          <div style={{ ...modalContentStyle, width: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32 }}>{EVENT_ICONS[viewEvent.event] || '📝'}</span>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>{viewEvent.event}</h3>
                  <span style={{ fontSize: 13, color: 'var(--accent)' }}>{viewEvent.sampleId}</span>
                </div>
              </div>
              <button onClick={() => { setViewEvent(null); setEditEventMode(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            {editEventMode ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Sample</label>
                  <select className="form-select" value={viewEvent.sampleId} onChange={e => setViewEvent({ ...viewEvent, sampleId: e.target.value })} style={{ width: '100%' }}>
                    {samples.map(s => <option key={s.id} value={s.sampleId}>{s.sampleId} - {s.type}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Event Type</label>
                  <select className="form-select" value={viewEvent.event} onChange={e => setViewEvent({ ...viewEvent, event: e.target.value })} style={{ width: '100%' }}>
                    {EVENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Details</label>
                  <textarea className="form-input" rows={3} value={viewEvent.details || ''} onChange={e => setViewEvent({ ...viewEvent, details: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setEditEventMode(false)} style={{ flex: 1 }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleUpdateEvent} style={{ flex: 1 }}>Save Changes</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>User</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{viewEvent.user}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Timestamp</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{viewEvent.timestamp}</div>
                  </div>
                  {viewEvent.details && (
                    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Details</div>
                      <div style={{ fontSize: 13 }}>{viewEvent.details}</div>
                    </div>
                  )}
                </div>
                <button className="btn btn-primary" onClick={() => setEditEventMode(true)} style={{ width: '100%' }}>Edit Event</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Event Modal */}
      {showEventModal && (
        <div style={modalStyle} onClick={() => setShowEventModal(false)}>
          <div style={{ ...modalContentStyle, width: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>Log Sample Event</h3>
              <button onClick={() => setShowEventModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Sample *</label>
                <select className="form-select" value={newEvent.sampleId} onChange={e => setNewEvent({ ...newEvent, sampleId: e.target.value })} style={{ width: '100%' }}>
                  <option value="">Select sample...</option>
                  {samples.map(s => <option key={s.id} value={s.sampleId}>{s.sampleId} - {s.type}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Event Type *</label>
                <select className="form-select" value={newEvent.event} onChange={e => setNewEvent({ ...newEvent, event: e.target.value })} style={{ width: '100%' }}>
                  <option value="">Select event...</option>
                  {EVENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Details</label>
                <textarea className="form-input" placeholder="Add details..." rows={3} value={newEvent.details} onChange={e => setNewEvent({ ...newEvent, details: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowEventModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddEvent} style={{ flex: 1 }}>Log Event</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div style={modalStyle} onClick={() => setShowImportPreview(false)}>
          <div style={{ ...modalContentStyle, width: 800 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700 }}>Import Preview</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{importFileName} - {importedData.length} samples</p>
              </div>
              <button onClick={() => setShowImportPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={{ maxHeight: 400, overflow: 'auto', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Sample ID</th>
                    <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Location</th>
                    <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {importedData.map((d, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: 8, color: 'var(--accent)', fontWeight: 600 }}>{d.sampleId || '(Auto)'}</td>
                      <td style={{ padding: 8 }}>{d.type || '-'}</td>
                      <td style={{ padding: 8 }}>{d.status || 'processing'}</td>
                      <td style={{ padding: 8 }}>{d.location || '-'}</td>
                      <td style={{ padding: 8 }}>{d.owner || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowImportPreview(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmImport} style={{ flex: 1 }}>Import {importedData.length} Samples</button>
            </div>
          </div>
        </div>
      )}

      {/* Label Print Preview Modal */}
      {showLabelPreviewModal && (
        <div style={modalStyle} onClick={() => setShowLabelPreviewModal(false)}>
          <div style={{ ...modalContentStyle, width: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700 }}>Print Preview</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{labelsForPrint.length} labels ready to print</p>
              </div>
              <button onClick={() => setShowLabelPreviewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            <div style={{ maxHeight: 400, overflow: 'auto', marginBottom: 20, background: 'var(--surface2)', padding: 20, borderRadius: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                {labelsForPrint.slice(0, 12).map(s => (
                  <div key={s.id} style={{
                    background: 'white', border: '1px solid #333', borderRadius: 4, padding: 8,
                    width: LABEL_SIZES.find(ls => ls.id === selectedLabelSize)!.width * 2.5
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left' }}>
                        <BarcodePreview type={selectedBarcodeType} sampleId={s.sampleId} />
                      </div>
                      <div style={{ fontSize: 8, color: '#333' }}>
                        <div style={{ fontWeight: 700, fontSize: 9 }}>{s.sampleId}</div>
                        {labelContent.showType && <div>{s.type}</div>}
                        {labelContent.showDate && <div>{s.date}</div>}
                      </div>
                    </div>
                  </div>
                ))}
                {labelsForPrint.length > 12 && (
                  <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                    +{labelsForPrint.length - 12} more labels...
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowLabelPreviewModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={printLabels} style={{ flex: 1 }}>🖨️ Print Labels</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {bulkDeleteConfirm && (
        <div style={modalStyle} onClick={() => setBulkDeleteConfirm(false)}>
          <div style={{ ...modalContentStyle, width: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Delete {selectedSamples.size} Samples?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setBulkDeleteConfirm(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn" style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }} onClick={handleBulkDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Event Delete Confirmation */}
      {bulkEventDeleteConfirm && (
        <div style={modalStyle} onClick={() => setBulkEventDeleteConfirm(false)}>
          <div style={{ ...modalContentStyle, width: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Delete {selectedEvents.size} Events?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>This will remove the selected chain of custody records.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setBulkEventDeleteConfirm(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn" style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }} onClick={handleBulkDeleteEvents}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Label Modal */}
      {editingLabel && (
        <div style={modalStyle} onClick={() => setEditingLabel(null)}>
          <div style={{ ...modalContentStyle, width: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>Edit Label</h3>
              <button onClick={() => setEditingLabel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            {/* Label Preview */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, padding: 16, background: 'var(--surface2)', borderRadius: 8 }}>
              <div style={{ background: 'white', border: '2px solid #333', borderRadius: 4, padding: 12, minWidth: 150 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <BarcodePreview type={selectedBarcodeType} sampleId={editingLabel.displayName} />
                  <div style={{ fontSize: 10, color: '#333' }}>
                    <div style={{ fontWeight: 700, fontSize: 11 }}>{editingLabel.displayName}</div>
                    <div>{editingLabel.displayNumber}</div>
                    {editingLabel.type && <div>{editingLabel.type}</div>}
                    {editingLabel.customText && <div style={{ fontStyle: 'italic' }}>{editingLabel.customText}</div>}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Display Name *</label>
                <input type="text" className="form-input" placeholder="Name to show on label..."
                  value={editingLabel.displayName}
                  onChange={e => setEditingLabel({ ...editingLabel, displayName: e.target.value })} />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>This is the main text that appears on the label</p>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Display Number</label>
                <input type="text" className="form-input" placeholder="Number/ID to show..."
                  value={editingLabel.displayNumber}
                  onChange={e => setEditingLabel({ ...editingLabel, displayNumber: e.target.value })} />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Numeric identifier or code</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Type</label>
                  <select className="form-select" value={editingLabel.type} onChange={e => setEditingLabel({ ...editingLabel, type: e.target.value })} style={{ width: '100%' }}>
                    <option value="">No Type</option>
                    {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Copies</label>
                  <input type="number" min="1" max="100" className="form-input"
                    value={editingLabel.copies}
                    onChange={e => setEditingLabel({ ...editingLabel, copies: parseInt(e.target.value) || 1 })} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Date</label>
                <input type="date" className="form-input"
                  value={editingLabel.date}
                  onChange={e => setEditingLabel({ ...editingLabel, date: e.target.value })} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Location</label>
                <select className="form-select" value={editingLabel.location} onChange={e => setEditingLabel({ ...editingLabel, location: e.target.value })} style={{ width: '100%' }}>
                  <option value="">No Location</option>
                  {STORAGE_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Owner</label>
                <input type="text" className="form-input" placeholder="Owner name..."
                  value={editingLabel.owner}
                  onChange={e => setEditingLabel({ ...editingLabel, owner: e.target.value })} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Custom Text</label>
                <textarea className="form-input" placeholder="Additional text to display on label..." rows={2}
                  value={editingLabel.customText}
                  onChange={e => setEditingLabel({ ...editingLabel, customText: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setEditingLabel(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => updateLabel(editingLabel)} style={{ flex: 1 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Label Modal */}
      {showAddLabelModal && (
        <div style={modalStyle} onClick={() => setShowAddLabelModal(false)}>
          <div style={{ ...modalContentStyle, width: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>Add Custom Label</h3>
              <button onClick={() => setShowAddLabelModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Create a custom label that doesn't need to be linked to a sample.
            </p>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Display Name *</label>
                <input type="text" className="form-input" placeholder="e.g., Sample A, Test Label, etc."
                  value={newLabelData.displayName}
                  onChange={e => setNewLabelData({ ...newLabelData, displayName: e.target.value })} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Display Number</label>
                <input type="text" className="form-input" placeholder="e.g., 001, A-123, etc."
                  value={newLabelData.displayNumber}
                  onChange={e => setNewLabelData({ ...newLabelData, displayNumber: e.target.value })} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Custom Text</label>
                <textarea className="form-input" placeholder="Additional information to display..." rows={2}
                  value={newLabelData.customText}
                  onChange={e => setNewLabelData({ ...newLabelData, customText: e.target.value })} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Number of Copies</label>
                <input type="number" min="1" max="100" className="form-input"
                  value={newLabelData.copies}
                  onChange={e => setNewLabelData({ ...newLabelData, copies: parseInt(e.target.value) || 1 })} />
              </div>
            </div>

            {/* Preview */}
            {newLabelData.displayName && (
              <div style={{ marginTop: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Preview</label>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 16, background: 'var(--surface2)', borderRadius: 8 }}>
                  <div style={{ background: 'white', border: '2px solid #333', borderRadius: 4, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <BarcodePreview type={selectedBarcodeType} sampleId={newLabelData.displayName} />
                      <div style={{ fontSize: 10, color: '#333' }}>
                        <div style={{ fontWeight: 700, fontSize: 11 }}>{newLabelData.displayName}</div>
                        {newLabelData.displayNumber && <div>{newLabelData.displayNumber}</div>}
                        {newLabelData.customText && <div style={{ fontStyle: 'italic' }}>{newLabelData.customText}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddLabelModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={addCustomLabel} style={{ flex: 1 }}>Add Label</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
