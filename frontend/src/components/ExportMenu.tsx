import React, { useState, useRef, useEffect } from 'react';
import { exportData, EXPORT_OPTIONS, ExportFormat } from '../utils/exportUtils';
import toast from 'react-hot-toast';

interface ExportMenuProps<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
  title?: string;
  columns?: string[];
  disabled?: boolean;
}

export function ExportMenu<T extends Record<string, unknown>>({
  data,
  filename,
  title,
  columns,
  disabled = false,
}: ExportMenuProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format: ExportFormat) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      exportData(data, {
        filename,
        format,
        title: title || filename,
        includeTimestamp: format !== 'pdf',
      }, columns);

      toast.success(`Exported ${data.length} records to ${format.toUpperCase()}`);
      setIsOpen(false);
    } catch {
      toast.error('Export failed. Please try again.');
    }
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="btn btn-secondary"
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>++</span>
        Export
        <span style={{ fontSize: 10, marginLeft: 4 }}>{isOpen ? '-' : '+'}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            minWidth: 180,
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Export Options
          </div>
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.format}
              onClick={() => handleExport(option.format)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: 14,
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                style={{
                  width: 32,
                  height: 24,
                  borderRadius: 4,
                  background: 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: 'var(--accent)',
                }}
              >
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
            {data.length} record{data.length !== 1 ? 's' : ''} available
          </div>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
