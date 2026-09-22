/**
 * Export utilities for LabOS v3
 * Supports Excel (CSV), PDF, and JSON export formats
 */

export type ExportFormat = 'excel' | 'csv' | 'json' | 'pdf';

interface ExportOptions {
  filename: string;
  format: ExportFormat;
  title?: string;
  includeTimestamp?: boolean;
}

/**
 * Converts an array of objects to CSV format
 */
function objectsToCSV<T extends Record<string, unknown>>(data: T[], columns?: string[]): string {
  if (data.length === 0) return '';

  const headers = columns || Object.keys(data[0]);
  const csvRows: string[] = [];

  // Add headers
  csvRows.push(headers.map(h => `"${h}"`).join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Downloads a file to the user's device
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '-';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Generates a timestamp string for filenames
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
}

/**
 * Main export function - exports data to various formats
 */
export async function exportData<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions,
  columns?: string[]
): Promise<void> {
  const timestamp = options.includeTimestamp ? `_${getTimestamp()}` : '';
  const filename = `${options.filename}${timestamp}`;

  switch (options.format) {
    case 'excel': {
      await exportRealExcel(data, filename, columns);
      break;
    }
    case 'csv': {
      const csv = objectsToCSV(data, columns);
      downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
      break;
    }
    case 'json': {
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, `${filename}.json`, 'application/json');
      break;
    }
    case 'pdf': {
      await exportRealPDF(data, filename, options.title || filename, columns);
      break;
    }
  }
}

/** Real .xlsx via SheetJS (already a project dependency) — replaces the old CSV-mislabeled-as-Excel export. */
async function exportRealExcel<T extends Record<string, unknown>>(
  data: T[], filename: string, columns?: string[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const headers = columns || (data.length > 0 ? Object.keys(data[0]) : []);
  const rows = data.map((row) => headers.map((h) => cellText(row[h])));
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Export');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
}

/** Real .pdf via jsPDF (already a project dependency) — replaces the old browser-print-to-PDF workaround. */
async function exportRealPDF<T extends Record<string, unknown>>(
  data: T[], filename: string, title: string, columns?: string[]
): Promise<void> {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ orientation: 'landscape' });
  const headers = columns || (data.length > 0 ? Object.keys(data[0]) : []);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const colWidth = headers.length > 0 ? (pageWidth - margin * 2) / headers.length : 0;
  const rowHeight = 8;
  let y = margin;

  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`Generated from LabOS v3 on ${new Date().toLocaleString()} · ${data.length} records`, margin, y);
  y += 8;

  const drawHeader = () => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => doc.text(String(h), margin + i * colWidth, y, { maxWidth: colWidth - 2 }));
    y += rowHeight;
    doc.setFont('helvetica', 'normal');
  };
  drawHeader();

  for (const row of data) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    headers.forEach((h, i) => doc.text(cellText(row[h]), margin + i * colWidth, y, { maxWidth: colWidth - 2 }));
    y += rowHeight;
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Pre-configured export functions for common use cases
 */
export const exportToExcel = <T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: string[]
) => exportData(data, { filename, format: 'excel', includeTimestamp: true }, columns);

export const exportToCSV = <T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: string[]
) => exportData(data, { filename, format: 'csv', includeTimestamp: true }, columns);

export const exportToJSON = <T extends Record<string, unknown>>(
  data: T[],
  filename: string
) => exportData(data, { filename, format: 'json', includeTimestamp: true });

export const exportToPDF = <T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  title?: string,
  columns?: string[]
) => exportData(data, { filename, format: 'pdf', title, includeTimestamp: false }, columns);

/**
 * Export button component configuration
 */
export interface ExportButtonConfig {
  label: string;
  format: ExportFormat;
  icon: string;
}

export const EXPORT_OPTIONS: ExportButtonConfig[] = [
  { label: 'Export to Excel', format: 'excel', icon: 'XLS' },
  { label: 'Export to CSV', format: 'csv', icon: 'CSV' },
  { label: 'Export to JSON', format: 'json', icon: '{}' },
  { label: 'Export to PDF', format: 'pdf', icon: 'PDF' },
];
