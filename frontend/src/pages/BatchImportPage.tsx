import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

interface ImportRecord {
  row: number;
  data: Record<string, string>;
  status: 'pending' | 'valid' | 'error';
  errors: string[];
}

interface ImportTemplate {
  name: string;
  fields: string[];
  description: string;
}

const TEMPLATES: ImportTemplate[] = [
  { name: 'samples', fields: ['sample_id', 'name', 'type', 'source', 'storage_location', 'status', 'notes'], description: 'Import sample records' },
  { name: 'inventory', fields: ['name', 'category', 'quantity', 'unit', 'lot_number', 'barcode', 'storage_location', 'expires_on'], description: 'Import inventory items' },
  { name: 'users', fields: ['email', 'full_name', 'role', 'department'], description: 'Import user accounts' },
];

export default function BatchImportPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<ImportTemplate | null>(null);
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'select' | 'upload' | 'review' | 'complete'>('select');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const imported: ImportRecord[] = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const data: Record<string, string> = {};
        headers.forEach((h, i) => { data[h] = values[i] || ''; });

        const errors: string[] = [];
        if (selectedTemplate) {
          selectedTemplate.fields.forEach(field => {
            if (['sample_id', 'name', 'email'].includes(field) && !data[field]) {
              errors.push(`Missing required field: ${field}`);
            }
          });
        }

        return {
          row: index + 2,
          data,
          status: errors.length > 0 ? 'error' : 'valid',
          errors,
        };
      });

      setRecords(imported);
      setStep('review');
      toast.success(`Parsed ${imported.length} records`);
    };
    reader.readAsText(file);
  }, [selectedTemplate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls', '.xlsx'] },
    maxFiles: 1,
  });

  function downloadTemplate() {
    if (!selectedTemplate) return;
    const csv = selectedTemplate.fields.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate.name}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  }

  async function handleImport() {
    const validRecords = records.filter(r => r.status === 'valid');
    if (validRecords.length === 0) {
      toast.error('No valid records to import');
      return;
    }

    setImporting(true);
    await new Promise(r => setTimeout(r, 1500));
    setImporting(false);
    setStep('complete');
    toast.success(`Imported ${validRecords.length} records`);
  }

  function reset() {
    setSelectedTemplate(null);
    setRecords([]);
    setStep('select');
  }

  const validCount = records.filter(r => r.status === 'valid').length;
  const errorCount = records.filter(r => r.status === 'error').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Batch Import</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Import samples, inventory, and more from CSV/Excel</p>
        </div>
        {step !== 'select' && (
          <button onClick={reset} style={{
            padding: '7px 16px',
            borderRadius: 8,
            background: 'var(--surface2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}>
            Start Over
          </button>
        )}
      </div>

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Progress Steps */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
          {['select', 'upload', 'review', 'complete'].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: step === s ? 'var(--accent)' : ['select', 'upload', 'review', 'complete'].indexOf(step) > i ? 'var(--success)' : 'var(--surface2)',
                color: step === s || ['select', 'upload', 'review', 'complete'].indexOf(step) > i ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: 14,
              }}>
                {['select', 'upload', 'review', 'complete'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13, color: step === s ? 'var(--text)' : 'var(--text-muted)', textTransform: 'capitalize' }}>{s}</span>
              {i < 3 && <div style={{ width: 40, height: 2, background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Template */}
        {step === 'select' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>Select Import Type</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TEMPLATES.map(t => (
                <div
                  key={t.name}
                  onClick={() => { setSelectedTemplate(t); setStep('upload'); }}
                  style={{
                    padding: 20,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: 'var(--surface)',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, textTransform: 'capitalize' }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{t.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                    Fields: {t.fields.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload File */}
        {step === 'upload' && selectedTemplate && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>Upload {selectedTemplate.name} File</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                Expected columns: {selectedTemplate.fields.join(', ')}
              </p>
              <button onClick={downloadTemplate} style={{
                marginTop: 12,
                padding: '6px 12px',
                borderRadius: 6,
                background: 'var(--surface2)',
                color: 'var(--accent)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: 13,
              }}>
                Download Template CSV
              </button>
            </div>

            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12,
                padding: 60,
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragActive ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface)',
                transition: 'all 0.15s',
              }}
            >
              <input {...getInputProps()} />
              <div style={{ fontSize: 48, marginBottom: 16 }}>📤</div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
                {isDragActive ? 'Drop the file here...' : 'Drag & drop a CSV file here'}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                or click to select a file
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Review Import Data</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--success)' }}>{validCount} valid</span>
                  {errorCount > 0 && <span style={{ color: 'var(--danger)', marginLeft: 12 }}>{errorCount} errors</span>}
                </p>
              </div>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                style={{
                  padding: '10px 24px',
                  borderRadius: 8,
                  background: validCount > 0 ? 'var(--accent)' : 'var(--surface2)',
                  color: validCount > 0 ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  cursor: validCount > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {importing ? 'Importing...' : `Import ${validCount} Records`}
              </button>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Row</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Data</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 50).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px', fontSize: 13 }}>{r.row}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          background: r.status === 'valid' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: r.status === 'valid' ? '#22c55e' : '#ef4444',
                        }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'monospace' }}>
                        {Object.entries(r.data).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ')}...
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--danger)' }}>
                        {r.errors.join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length > 50 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Showing 50 of {records.length} records
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div style={{ maxWidth: 400, margin: '60px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Import Complete!</h2>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>
              Successfully imported {validCount} records
            </p>
            <button onClick={reset} style={{
              marginTop: 24,
              padding: '10px 24px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}>
              Import More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
