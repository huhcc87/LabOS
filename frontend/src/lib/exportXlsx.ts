import * as XLSX from 'xlsx';

/** Download an array of objects as an .xlsx file. */
export function exportToXlsx(rows: Record<string, unknown>[], filename: string) {
  const ws   = XLSX.utils.json_to_sheet(rows);
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Download an array of objects as a .csv file. */
export function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  const ws  = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse a CSV File into an array of objects. */
export async function parseCsvFile(file: File): Promise<Record<string, unknown>[]> {
  const { default: Papa } = await import('papaparse');
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data as Record<string, unknown>[]),
      error: reject,
    });
  });
}
