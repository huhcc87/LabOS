import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'complete' | 'error';

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  required: boolean;
}

interface ImportConfig {
  type: 'samples' | 'equipment' | 'inventory' | 'users' | 'documents';
  requiredFields: string[];
  optionalFields: string[];
  templateUrl?: string;
}

interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

interface BatchImportProps {
  config: ImportConfig;
  onImport: (data: Record<string, string>[]) => Promise<{ success: number; failed: number; errors: string[] }>;
  onClose?: () => void;
}

const IMPORT_CONFIGS: Record<string, ImportConfig> = {
  samples: {
    type: 'samples',
    requiredFields: ['sample_id', 'type', 'status'],
    optionalFields: ['location', 'storage_conditions', 'collected_by', 'collected_date', 'notes'],
  },
  equipment: {
    type: 'equipment',
    requiredFields: ['name', 'serial_number', 'category'],
    optionalFields: ['location', 'purchase_date', 'warranty_date', 'status', 'notes'],
  },
  inventory: {
    type: 'inventory',
    requiredFields: ['item_name', 'quantity', 'unit'],
    optionalFields: ['category', 'location', 'min_stock', 'supplier', 'lot_number', 'expiry_date'],
  },
  users: {
    type: 'users',
    requiredFields: ['email', 'full_name', 'role'],
    optionalFields: ['department', 'phone', 'title'],
  },
  documents: {
    type: 'documents',
    requiredFields: ['name', 'type', 'category'],
    optionalFields: ['version', 'description', 'tags'],
  },
};

export function BatchImport({ config, onImport, onClose }: BatchImportProps) {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): ParsedData => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
    return { headers, rows, totalRows: rows.length };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('parsing');

    try {
      const text = await file.text();
      const data = parseCSV(text);
      setParsedData(data);

      // Auto-map columns based on header names
      const mappings: ColumnMapping[] = [...config.requiredFields, ...config.optionalFields].map(field => {
        const matchingHeader = data.headers.find(h =>
          h.toLowerCase().replace(/[_\s-]/g, '') === field.toLowerCase().replace(/[_\s-]/g, '')
        );
        return {
          sourceColumn: matchingHeader || '',
          targetField: field,
          required: config.requiredFields.includes(field),
        };
      });
      setColumnMappings(mappings);

      // Select all rows by default
      setSelectedRows(new Set(data.rows.map((_, i) => i)));
      setStatus('preview');
      toast.success(`Parsed ${data.totalRows} rows from ${file.name}`);
    } catch {
      setStatus('error');
      toast.error('Failed to parse file. Please check the format.');
    }
  };

  const handleMappingChange = (targetField: string, sourceColumn: string) => {
    setColumnMappings(prev =>
      prev.map(m => m.targetField === targetField ? { ...m, sourceColumn } : m)
    );
  };

  const toggleRowSelection = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllRows = () => {
    if (parsedData) {
      if (selectedRows.size === parsedData.rows.length) {
        setSelectedRows(new Set());
      } else {
        setSelectedRows(new Set(parsedData.rows.map((_, i) => i)));
      }
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    // Validate required mappings
    const missingRequired = columnMappings
      .filter(m => m.required && !m.sourceColumn)
      .map(m => m.targetField);

    if (missingRequired.length > 0) {
      toast.error(`Missing required mappings: ${missingRequired.join(', ')}`);
      return;
    }

    setStatus('importing');

    // Transform data based on mappings
    const transformedData = parsedData.rows
      .filter((_, i) => selectedRows.has(i))
      .map(row => {
        const transformed: Record<string, string> = {};
        columnMappings.forEach(mapping => {
          if (mapping.sourceColumn) {
            transformed[mapping.targetField] = row[mapping.sourceColumn] || '';
          }
        });
        return transformed;
      });

    try {
      const result = await onImport(transformedData);
      setImportResult(result);
      setStatus('complete');

      if (result.failed === 0) {
        toast.success(`Successfully imported ${result.success} records`);
      } else {
        toast.error(`Imported ${result.success} records, ${result.failed} failed`);
      }
    } catch {
      setStatus('error');
      toast.error('Import failed. Please try again.');
    }
  };

  const downloadTemplate = () => {
    const headers = [...config.requiredFields, ...config.optionalFields];
    const csv = headers.join(',') + '\n' + headers.map(h => `example_${h}`).join(',');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.type}_import_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const reset = () => {
    setStatus('idle');
    setParsedData(null);
    setColumnMappings([]);
    setImportResult(null);
    setSelectedRows(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Batch Import - {config.type.charAt(0).toUpperCase() + config.type.slice(1)}
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>
            Import data from CSV or Excel files
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--text-muted)', cursor: 'pointer' }}>x</button>
        )}
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['Upload', 'Map Fields', 'Preview', 'Import'].map((step, i) => {
          const isActive = (status === 'idle' && i === 0) ||
            (status === 'parsing' && i === 0) ||
            (status === 'preview' && (i === 1 || i === 2)) ||
            (status === 'importing' && i === 3) ||
            (status === 'complete' && i === 3);
          const isCompleted = (status === 'preview' && i === 0) ||
            (status === 'importing' && i < 3) ||
            (status === 'complete' && i < 3);

          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: isCompleted ? '#10b981' : isActive ? 'var(--accent)' : 'var(--surface2)',
                color: isCompleted || isActive ? '#fff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
              }}>
                {isCompleted ? '*' : i + 1}
              </div>
              <span style={{ fontSize: 13, color: isActive ? 'var(--text)' : 'var(--text-muted)' }}>{step}</span>
              {i < 3 && <span style={{ color: 'var(--border)' }}>-</span>}
            </div>
          );
        })}
      </div>

      {/* Upload Step */}
      {status === 'idle' && (
        <div>
          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'var(--border)';
              const file = e.dataTransfer.files[0];
              if (file && fileInputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div style={{ fontSize: 40, color: 'var(--accent)', marginBottom: 16 }}>++</div>
            <p style={{ color: 'var(--text)', margin: 0, marginBottom: 8, fontWeight: 600 }}>
              Drag and drop file here
            </p>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>
              or click to browse (CSV, Excel)
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            <button onClick={downloadTemplate} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
              Download Template
            </button>
          </div>

          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16, marginTop: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>Required Fields</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {config.requiredFields.map(field => (
                <span key={field} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--accent)', color: '#fff', fontSize: 12 }}>
                  {field}
                </span>
              ))}
            </div>
            {config.optionalFields.length > 0 && (
              <>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '16px 0 12px' }}>Optional Fields</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {config.optionalFields.map(field => (
                    <span key={field} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--border)', color: 'var(--text-muted)', fontSize: 12 }}>
                      {field}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Parsing Status */}
      {status === 'parsing' && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 16, animation: 'spin 1s linear infinite' }}>@</div>
          <p style={{ color: 'var(--text)', margin: 0 }}>Parsing file...</p>
        </div>
      )}

      {/* Preview Step */}
      {status === 'preview' && parsedData && (
        <div>
          {/* Column Mappings */}
          <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' }}>Column Mappings</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {columnMappings.map(mapping => (
                <div key={mapping.targetField} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    flex: 1,
                    fontSize: 13,
                    color: mapping.required ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: mapping.required ? 600 : 400,
                  }}>
                    {mapping.targetField} {mapping.required && '*'}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>=</span>
                  <select
                    value={mapping.sourceColumn}
                    onChange={(e) => handleMappingChange(mapping.targetField, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: `1px solid ${mapping.required && !mapping.sourceColumn ? '#ef4444' : 'var(--border)'}`,
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 13,
                    }}
                  >
                    <option value="">-- Select --</option>
                    {parsedData.headers.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Data Preview */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Data Preview ({selectedRows.size}/{parsedData.totalRows} rows selected)
              </h4>
              <button onClick={selectAllRows} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                {selectedRows.size === parsedData.rows.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={selectedRows.size === parsedData.rows.length} onChange={selectAllRows} />
                    </th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>#</th>
                    {parsedData.headers.slice(0, 5).map(header => (
                      <th key={header} style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        {header}
                      </th>
                    ))}
                    {parsedData.headers.length > 5 && (
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        +{parsedData.headers.length - 5} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.rows.slice(0, 10).map((row, i) => (
                    <tr key={i} style={{ background: selectedRows.has(i) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRowSelection(i)} />
                      </td>
                      <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{i + 1}</td>
                      {parsedData.headers.slice(0, 5).map(header => (
                        <td key={header} style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--text)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[header] || '-'}
                        </td>
                      ))}
                      {parsedData.headers.length > 5 && (
                        <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.rows.length > 10 && (
                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Showing first 10 of {parsedData.totalRows} rows
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={reset} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedRows.size === 0}
              className="btn btn-primary"
              style={{ padding: '10px 20px', opacity: selectedRows.size === 0 ? 0.5 : 1 }}
            >
              Import {selectedRows.size} Records
            </button>
          </div>
        </div>
      )}

      {/* Importing Status */}
      {status === 'importing' && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 16 }}>@</div>
          <p style={{ color: 'var(--text)', margin: 0 }}>Importing records...</p>
          <p style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: 13 }}>Please wait...</p>
        </div>
      )}

      {/* Complete Status */}
      {status === 'complete' && importResult && (
        <div>
          <div style={{ textAlign: 'center', padding: 32, background: importResult.failed === 0 ? '#16653420' : '#92400e20', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{importResult.failed === 0 ? '**' : '!'}</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 8 }}>
              Import {importResult.failed === 0 ? 'Complete' : 'Finished with Errors'}
            </h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {importResult.success} records imported successfully
              {importResult.failed > 0 && `, ${importResult.failed} failed`}
            </p>
          </div>

          {importResult.errors.length > 0 && (
            <div style={{ background: '#991b1b20', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: '#fca5a5', margin: '0 0 12px' }}>Errors</h4>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                {importResult.errors.slice(0, 5).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {importResult.errors.length > 5 && (
                  <li>...and {importResult.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={reset} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
              Import More
            </button>
            {onClose && (
              <button onClick={onClose} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Status */}
      {status === 'error' && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, color: '#ef4444', marginBottom: 16 }}>!</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 8 }}>
            Import Failed
          </h3>
          <p style={{ color: 'var(--text-muted)', margin: 0, marginBottom: 20 }}>
            There was an error processing your file.
          </p>
          <button onClick={reset} className="btn btn-primary" style={{ padding: '10px 20px' }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// Export configs for use in other components
export { IMPORT_CONFIGS };
export default BatchImport;
