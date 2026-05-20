/**
 * Export utilities for LabOS v2
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
export function exportData<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions,
  columns?: string[]
): void {
  const timestamp = options.includeTimestamp ? `_${getTimestamp()}` : '';
  const filename = `${options.filename}${timestamp}`;

  switch (options.format) {
    case 'excel':
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
      // Generate a printable HTML that can be saved as PDF
      const html = generatePrintableHTML(data, options.title || filename, columns);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
      break;
    }
  }
}

/**
 * Generates printable HTML for PDF export
 */
function generatePrintableHTML<T extends Record<string, unknown>>(
  data: T[],
  title: string,
  columns?: string[]
): string {
  if (data.length === 0) return '<html><body><p>No data to export</p></body></html>';

  const headers = columns || Object.keys(data[0]);

  const headerRow = headers.map(h => `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; text-align: left;">${h}</th>`).join('');

  const dataRows = data.map(row => {
    const cells = headers.map(header => {
      const value = row[header];
      const displayValue = value === null || value === undefined
        ? '-'
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
      return `<td style="border: 1px solid #ddd; padding: 8px;">${displayValue}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - LabOS Export</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h1 { color: #1a4480; margin-bottom: 8px; }
        .subtitle { color: #666; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { font-size: 12px; }
        .footer { margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="subtitle">Generated from LabOS v2 on ${new Date().toLocaleString()}</div>
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${dataRows}</tbody>
      </table>
      <div class="footer">
        LabOS v2 - Laboratory Operations System<br>
        Total Records: ${data.length}
      </div>
    </body>
    </html>
  `;
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
  { label: 'Print / PDF', format: 'pdf', icon: 'PDF' },
];
