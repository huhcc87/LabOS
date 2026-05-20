import React from 'react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  rowKey?: (row: T) => string | number;
  actions?: (row: T) => React.ReactNode;
}

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: number) => void;
}

export function Pagination({ page, pages, total, perPage, onPageChange, onPerPageChange }: PaginationProps) {
  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
      </div>
      <div className="pagination-controls">
        <select
          className="per-page-select"
          value={perPage}
          onChange={(e) => { onPerPageChange(Number(e.target.value)); onPageChange(1); }}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
        <span className="page-indicator">{page} / {pages}</span>
        <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function Table<T extends Record<string, any>>({
  columns, data, loading, onEdit, onDelete, rowKey, actions,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="skeleton-table">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            {columns.map((_, j) => <div key={j} className="skeleton-cell shimmer" />)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : {}}>{col.header}</th>
            ))}
            {(onEdit || onDelete || actions) && <th style={{ width: '120px' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length + 1} className="empty-row">No records found</td></tr>
          ) : (
            data.map((row, idx) => (
              <tr key={rowKey ? rowKey(row) : idx}>
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
                {(onEdit || onDelete || actions) && (
                  <td className="actions-cell">
                    {actions ? actions(row) : (
                      <>
                        {onEdit && (
                          <button className="btn-icon btn-edit" onClick={() => onEdit(row)} title="Edit">
                            ✎
                          </button>
                        )}
                        {onDelete && (
                          <button className="btn-icon btn-delete" onClick={() => onDelete(row)} title="Delete">
                            🗑
                          </button>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
