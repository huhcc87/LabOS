import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { BarcodeScanner } from '../components/BarcodeScanner';

// Barcode format types
const BARCODE_FORMATS = [
  { value: 'CODE128', label: 'Code 128', description: 'Alphanumeric, variable length', icon: '||||' },
  { value: 'CODE39', label: 'Code 39', description: 'Alphanumeric, uppercase only', icon: '||| |' },
  { value: 'EAN13', label: 'EAN-13', description: 'Numeric, 13 digits', icon: '||||||' },
  { value: 'UPC', label: 'UPC-A', description: 'Numeric, 12 digits', icon: '|||||' },
  { value: 'QR', label: 'QR Code', description: 'High capacity 2D', icon: '▣' },
  { value: 'DATAMATRIX', label: 'Data Matrix', description: '2D, compact', icon: '▦' },
  { value: 'PDF417', label: 'PDF417', description: '2D, high density', icon: '▤' },
];

// Label templates
const LABEL_TEMPLATES = [
  { value: 'chemical', label: '🧪 Chemical/Reagent', fields: ['name', 'catalog', 'hazard', 'storage', 'expiry'] },
  { value: 'sample', label: '🧫 Sample', fields: ['sampleId', 'type', 'date', 'collector'] },
  { value: 'inventory', label: '📦 Inventory', fields: ['name', 'sku', 'location', 'quantity'] },
  { value: 'equipment', label: '⚙️ Equipment', fields: ['name', 'assetId', 'calibrationDate'] },
  { value: 'freezer', label: '🧊 Freezer Box', fields: ['boxId', 'contents', 'position', 'date'] },
  { value: 'patient', label: '🏥 Patient Sample', fields: ['patientId', 'sampleType', 'collectionDate'] },
  { value: 'custom', label: '✏️ Custom', fields: [] },
];

interface LabelConfig {
  template: string;
  barcodeFormat: string;
  size: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
  quantity: number;
  prefix: string;
  startNumber: number;
  includeDate: boolean;
  includeLogo: boolean;
  includeText: boolean;
  customText: string;
  hazardSymbol: string;
  storageTemp: string;
}

interface GeneratedLabel {
  id: string;
  code: string;
  text: string;
  date: string;
  template: string;
  hazard?: string;
  storage?: string;
}

interface ScannedItem {
  barcode: string;
  name?: string;
  category?: string;
  catalogNumber?: string;
}

export default function PrintLabelsPage() {
  const [labels, setLabels] = useState<GeneratedLabel[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'scan' | 'batch'>('generate');
  const printRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, watch, setValue } = useForm<LabelConfig>({
    defaultValues: {
      template: 'chemical',
      barcodeFormat: 'CODE128',
      size: 'medium',
      quantity: 10,
      prefix: 'LAB',
      startNumber: 1,
      includeDate: true,
      includeLogo: false,
      includeText: true,
      customText: '',
      hazardSymbol: '',
      storageTemp: '',
    }
  });

  const watchFormat = watch('barcodeFormat');
  const watchSize = watch('size');
  const watchTemplate = watch('template');
  const watchIncludeDate = watch('includeDate');
  const watchIncludeText = watch('includeText');
  const watchHazard = watch('hazardSymbol');
  const watchStorage = watch('storageTemp');

  function generateLabels(data: LabelConfig) {
    const newLabels: GeneratedLabel[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < data.quantity; i++) {
      const num = (data.startNumber + i).toString().padStart(6, '0');
      const code = `${data.prefix}-${num}`;
      newLabels.push({
        id: `label-${Date.now()}-${i}`,
        code,
        text: data.customText || code,
        date: today,
        template: data.template,
        hazard: data.hazardSymbol,
        storage: data.storageTemp,
      });
    }

    setLabels(newLabels);
    setSelectedLabels(new Set(newLabels.map(l => l.id)));
    toast.success(`Generated ${data.quantity} labels`);
  }

  function generateFromScanned() {
    if (scannedItems.length === 0) {
      toast.error('No scanned items to generate labels from');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const newLabels: GeneratedLabel[] = scannedItems.map((item, i) => ({
      id: `label-${Date.now()}-${i}`,
      code: item.barcode,
      text: item.name || item.catalogNumber || item.barcode,
      date: today,
      template: 'inventory',
    }));

    setLabels(newLabels);
    setSelectedLabels(new Set(newLabels.map(l => l.id)));
    toast.success(`Generated ${newLabels.length} labels from scanned items`);
  }

  function handleScan(barcode: string, productInfo?: any) {
    const newItem: ScannedItem = {
      barcode,
      name: productInfo?.name,
      category: productInfo?.category,
      catalogNumber: productInfo?.catalogNumber,
    };
    setScannedItems(prev => [...prev, newItem]);
    toast.success(`Added: ${productInfo?.name || barcode}`);
  }

  function removeScannedItem(barcode: string) {
    setScannedItems(prev => prev.filter(item => item.barcode !== barcode));
  }

  function toggleLabel(id: string) {
    setSelectedLabels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedLabels(new Set(labels.map(l => l.id)));
  }

  function deselectAll() {
    setSelectedLabels(new Set());
  }

  function handlePrint() {
    if (selectedLabels.size === 0) {
      toast.error('Select at least one label to print');
      return;
    }
    window.print();
    toast.success('Print dialog opened');
  }

  const sizeStyles = {
    tiny: { width: 60, height: 30, fontSize: 6, padding: 2 },
    small: { width: 100, height: 50, fontSize: 8, padding: 4 },
    medium: { width: 150, height: 75, fontSize: 10, padding: 6 },
    large: { width: 200, height: 100, fontSize: 12, padding: 8 },
    xlarge: { width: 280, height: 140, fontSize: 14, padding: 10 },
  };

  const currentSize = sizeStyles[watchSize];

  // Render barcode visualization based on format
  const renderBarcodeVisual = (format: string, size: typeof currentSize) => {
    if (format === 'QR' || format === 'DATAMATRIX') {
      const gridSize = format === 'QR' ? 7 : 6;
      return (
        <div style={{
          width: size.height * 0.6,
          height: size.height * 0.6,
          background: '#000',
          borderRadius: 2,
          display: 'grid',
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`,
          gap: 1,
          padding: 2,
        }}>
          {Array(gridSize * gridSize).fill(0).map((_, i) => (
            <div key={i} style={{ background: Math.random() > 0.4 ? '#fff' : 'transparent', borderRadius: 0.5 }} />
          ))}
        </div>
      );
    } else if (format === 'PDF417') {
      return (
        <div style={{
          width: size.width * 0.7,
          height: size.height * 0.35,
          background: '#000',
          borderRadius: 2,
          display: 'grid',
          gridTemplateColumns: 'repeat(20, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: 0.5,
          padding: 2,
        }}>
          {Array(80).fill(0).map((_, i) => (
            <div key={i} style={{ background: Math.random() > 0.3 ? '#fff' : 'transparent' }} />
          ))}
        </div>
      );
    } else {
      // Linear barcodes
      const barCount = format === 'EAN13' ? 30 : format === 'UPC' ? 28 : 25;
      return (
        <div style={{
          display: 'flex',
          height: size.height * 0.4,
          gap: 1,
          alignItems: 'flex-end',
        }}>
          {Array(barCount).fill(0).map((_, i) => (
            <div
              key={i}
              style={{
                width: Math.random() > 0.5 ? 2 : 1,
                height: `${70 + Math.random() * 30}%`,
                background: '#000',
              }}
            />
          ))}
        </div>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        borderBottom: '3px solid #6366f1',
        padding: '20px 24px',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>🏷️</span>
              Print Labels & Barcodes
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.8 }}>
              Generate, scan, and print professional lab labels
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {labels.length > 0 && (
              <button
                onClick={handlePrint}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  background: '#22c55e',
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
                🖨️ Print Selected ({selectedLabels.size})
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {[
            { key: 'generate', label: '✨ Generate New', icon: '➕' },
            { key: 'scan', label: '📷 Scan & Print', icon: '📱' },
            { key: 'batch', label: '📋 Batch Import', icon: '📁' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '10px 20px',
                borderRadius: '10px 10px 0 0',
                background: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.1)',
                color: activeTab === tab.key ? '#1e293b' : 'rgba(255,255,255,0.8)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab.key ? 700 : 500,
                fontSize: 14,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', display: 'flex', gap: 24, background: '#f8fafc' }}>
        {/* Configuration Panel */}
        <div style={{ width: 360, flexShrink: 0 }}>
          {activeTab === 'generate' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Label Configuration</h3>

              <form onSubmit={handleSubmit(generateLabels)}>
                {/* Template Selection */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>
                    Label Template
                  </label>
                  <select {...register('template')} style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2px solid #e2e8f0',
                    borderRadius: 10,
                    background: '#fff',
                    fontSize: 14,
                  }}>
                    {LABEL_TEMPLATES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Barcode Format */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>
                    Barcode Format
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {BARCODE_FORMATS.map(format => (
                      <label
                        key={format.value}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '10px 12px',
                          border: watchFormat === format.value ? '2px solid #6366f1' : '1px solid #e2e8f0',
                          borderRadius: 10,
                          cursor: 'pointer',
                          background: watchFormat === format.value ? 'rgba(99,102,241,0.05)' : '#fff',
                        }}
                      >
                        <input
                          type="radio"
                          value={format.value}
                          {...register('barcodeFormat')}
                          style={{ display: 'none' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{format.icon}</span>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{format.label}</span>
                        </div>
                        <span style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{format.description}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Size Selection */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>
                    Label Size
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['tiny', 'small', 'medium', 'large', 'xlarge'].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setValue('size', size as any)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: 8,
                          border: watchSize === size ? '2px solid #6366f1' : '1px solid #e2e8f0',
                          background: watchSize === size ? 'rgba(99,102,241,0.1)' : '#fff',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: watchSize === size ? 700 : 500,
                          color: watchSize === size ? '#6366f1' : '#64748b',
                        }}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prefix and Start Number */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>Prefix</label>
                    <input {...register('prefix')} style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 14,
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>Start #</label>
                    <input type="number" {...register('startNumber', { valueAsNumber: true })} style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 14,
                    }} />
                  </div>
                </div>

                {/* Quantity */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>Quantity</label>
                  <input type="number" {...register('quantity', { valueAsNumber: true, min: 1, max: 500 })} style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: 10,
                    fontSize: 14,
                  }} />
                </div>

                {/* Chemical-specific options */}
                {watchTemplate === 'chemical' && (
                  <>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>Hazard Symbol</label>
                      <select {...register('hazardSymbol')} style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '2px solid #e2e8f0',
                        borderRadius: 10,
                        fontSize: 14,
                      }}>
                        <option value="">None</option>
                        <option value="🔥">🔥 Flammable</option>
                        <option value="⚗️">⚗️ Corrosive</option>
                        <option value="☠️">☠️ Toxic</option>
                        <option value="⚠️">⚠️ Irritant</option>
                        <option value="☣️">☣️ Biohazard</option>
                        <option value="☢️">☢️ Radioactive</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#475569' }}>Storage Temp</label>
                      <select {...register('storageTemp')} style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '2px solid #e2e8f0',
                        borderRadius: 10,
                        fontSize: 14,
                      }}>
                        <option value="">Not specified</option>
                        <option value="RT">📦 RT (15-25°C)</option>
                        <option value="4C">🌡️ 4°C</option>
                        <option value="-20C">❄️ -20°C</option>
                        <option value="-80C">🧊 -80°C</option>
                        <option value="LN2">🥶 LN2</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Options */}
                <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" {...register('includeDate')} style={{ width: 18, height: 18 }} />
                    <span style={{ fontSize: 14 }}>Include Date</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" {...register('includeText')} style={{ width: 18, height: 18 }} />
                    <span style={{ fontSize: 14 }}>Include Custom Text</span>
                  </label>
                </div>

                {watchIncludeText && (
                  <div style={{ marginBottom: 20 }}>
                    <input {...register('customText')} placeholder="Custom text for label..." style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      fontSize: 14,
                    }} />
                  </div>
                )}

                <button type="submit" style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 15,
                  boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                }}>
                  ✨ Generate Labels
                </button>
              </form>
            </div>
          )}

          {activeTab === 'scan' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Scan Items</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                Scan existing barcodes to create duplicate labels or re-print labels for inventory items.
              </p>

              <button
                onClick={() => setScannerOpen(true)}
                style={{
                  width: '100%',
                  padding: '20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                📷 Open Scanner
              </button>

              {/* Scanned Items List */}
              {scannedItems.length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: '#475569' }}>
                    Scanned Items ({scannedItems.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {scannedItems.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name || item.barcode}</div>
                          {item.catalogNumber && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>Cat# {item.catalogNumber}</div>
                          )}
                        </div>
                        <button
                          onClick={() => removeScannedItem(item.barcode)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: 'none',
                            background: '#fee2e2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={generateFromScanned}
                    style={{
                      width: '100%',
                      marginTop: 16,
                      padding: '12px',
                      borderRadius: 10,
                      background: '#22c55e',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    🏷️ Generate Labels from Scanned Items
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'batch' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Batch Import</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                Import a CSV file with barcode data to generate multiple labels at once.
              </p>

              <div style={{
                border: '2px dashed #e2e8f0',
                borderRadius: 12,
                padding: '40px 20px',
                textAlign: 'center',
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
                  Drag & drop CSV file here, or click to browse
                </p>
                <input type="file" accept=".csv" style={{ display: 'none' }} />
                <button style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}>
                  Browse Files
                </button>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>📋 Expected CSV Format:</div>
                <code style={{ fontSize: 11, color: '#64748b', display: 'block' }}>
                  barcode,name,category,quantity<br />
                  M0267S,Taq Polymerase,Enzymes,5<br />
                  N3232S,DNA Ladder,Reagents,3
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div style={{ flex: 1 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Preview ({labels.length} labels)
              </h3>
              {labels.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={selectAll} style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    Select All
                  </button>
                  <button onClick={deselectAll} style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    Deselect All
                  </button>
                </div>
              )}
            </div>

            {labels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: 64, marginBottom: 20 }}>🏷️</div>
                <p style={{ fontSize: 16, fontWeight: 500 }}>No labels generated yet</p>
                <p style={{ fontSize: 13 }}>Configure options and click "Generate Labels" to preview</p>
              </div>
            ) : (
              <div ref={printRef} id="print-area" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {labels.map(label => (
                  <div
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    style={{
                      width: currentSize.width,
                      minHeight: currentSize.height,
                      border: `2px solid ${selectedLabels.has(label.id) ? '#6366f1' : '#e2e8f0'}`,
                      borderRadius: 8,
                      padding: currentSize.padding,
                      cursor: 'pointer',
                      background: selectedLabels.has(label.id) ? 'rgba(99, 102, 241, 0.05)' : '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    {/* Hazard symbol */}
                    {label.hazard && (
                      <div style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        fontSize: currentSize.fontSize + 4,
                      }}>
                        {label.hazard}
                      </div>
                    )}

                    {/* Storage temp */}
                    {label.storage && (
                      <div style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        fontSize: currentSize.fontSize - 2,
                        background: '#dbeafe',
                        padding: '2px 4px',
                        borderRadius: 4,
                        color: '#1e40af',
                        fontWeight: 700,
                      }}>
                        {label.storage}
                      </div>
                    )}

                    {/* Barcode visual */}
                    {renderBarcodeVisual(watchFormat, currentSize)}

                    {/* Code text */}
                    <div style={{
                      fontSize: currentSize.fontSize,
                      fontFamily: 'monospace',
                      marginTop: 4,
                      fontWeight: 700,
                      textAlign: 'center',
                    }}>
                      {label.code}
                    </div>

                    {/* Custom text */}
                    {watchIncludeText && label.text !== label.code && (
                      <div style={{
                        fontSize: currentSize.fontSize - 1,
                        color: '#64748b',
                        textAlign: 'center',
                        marginTop: 2,
                      }}>
                        {label.text}
                      </div>
                    )}

                    {/* Date */}
                    {watchIncludeDate && (
                      <div style={{
                        fontSize: currentSize.fontSize - 2,
                        color: '#94a3b8',
                        marginTop: 2,
                      }}>
                        {label.date}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="autofill"
        onScan={handleScan}
      />

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          #print-area > div {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
