import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { exportToXlsx, exportToCsv } from '../lib/exportXlsx';

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  /** File base name for exports (without extension) */
  exportFilename?: string;
  /** Show global filter input */
  searchable?: boolean;
}

const btn: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  border: '1px solid #2a4a67',
  background: '#13293d',
  color: '#c8d9ea',
  cursor: 'pointer',
  fontSize: 12,
};

const disabledBtn: React.CSSProperties = { ...btn, opacity: 0.4, cursor: 'not-allowed' };

export function DataTable<TData extends Record<string, unknown>>({
  data,
  columns,
  exportFilename = 'export',
  searchable = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting]         = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [colVisibility, setColVisibility] = useState<VisibilityState>({});
  const [showColMenu, setShowColMenu] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility: colVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const exportRows = () =>
    table.getFilteredRowModel().rows.map((row) => {
      const obj: Record<string, unknown> = {};
      row.getVisibleCells().forEach((cell) => {
        obj[String(cell.column.columnDef.header ?? cell.column.id)] = cell.getValue();
      });
      return obj;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {searchable && (
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search…"
            style={{
              flex: 1, minWidth: 200, padding: '6px 12px', borderRadius: 8,
              border: '1px solid #2a4a67', background: '#0d1b2a',
              color: '#e8eef4', fontSize: 13, outline: 'none',
            }}
          />
        )}
        <div style={{ position: 'relative' }}>
          <button style={btn} onClick={() => setShowColMenu((v) => !v)}>
            Columns ▾
          </button>
          {showColMenu && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 50,
              background: '#13293d', border: '1px solid #2a4a67',
              borderRadius: 8, padding: 8, minWidth: 160,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {table.getAllLeafColumns().map((col) => (
                <label key={col.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#c8d9ea', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                  />
                  {String(col.columnDef.header ?? col.id)}
                </label>
              ))}
            </div>
          )}
        </div>
        <button style={btn} onClick={() => exportToXlsx(exportRows(), exportFilename)}>
          ↓ XLSX
        </button>
        <button style={btn} onClick={() => exportToCsv(exportRows(), exportFilename)}>
          ↓ CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #1e3a54' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} style={{ background: '#13293d' }}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      padding: '10px 14px', textAlign: 'left', color: '#a8d5ff',
                      fontWeight: 600, whiteSpace: 'nowrap', userSelect: 'none',
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      borderBottom: '1px solid #1e3a54',
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'  ? ' ↑' : ''}
                    {header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 24, textAlign: 'center', color: '#5a7a96' }}>
                  No records found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  style={{ background: i % 2 === 0 ? '#0d1b2a' : '#091520', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#13293d')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#0d1b2a' : '#091520')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ padding: '9px 14px', color: '#c8d9ea', borderBottom: '1px solid #1a3550' }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ color: '#5a7a96', fontSize: 12 }}>
          {table.getFilteredRowModel().rows.length} record{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
          {globalFilter ? ` matching "${globalFilter}"` : ''}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            style={table.getCanPreviousPage() ? btn : disabledBtn}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            ‹ Prev
          </button>
          <span style={{ color: '#8fa3b8', fontSize: 12 }}>
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
          </span>
          <button
            style={table.getCanNextPage() ? btn : disabledBtn}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next ›
          </button>
          <select
            style={{ ...btn, padding: '4px 8px' }}
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
