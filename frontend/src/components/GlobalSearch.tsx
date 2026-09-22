import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { searchApi } from '../lib/api';
import { exportData } from '../utils/exportUtils';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
  page: string;
  date?: number;
}

interface GlobalSearchProps {
  onNavigate: (page: string) => void;
}

const EXPORT_COLUMNS = ['Type', 'Title', 'Details', 'Date'];

// App-wide search box in the header (⌘K). Queries every searchable entity
// via searchApi (convex/search.ts) and lets the user jump to a result or
// download the current result set as Excel/PDF.
export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await searchApi.query(term);
        if (!cancelled) setResults(res.data ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setOpen(false);
    setQuery('');
  };

  const handleDownload = async (format: 'excel' | 'pdf') => {
    if (results.length === 0) return;
    const rows = results.map((r) => ({
      Type: r.type,
      Title: r.title,
      Details: r.subtitle,
      Date: r.date ? new Date(r.date).toLocaleString() : '',
    }));
    try {
      await exportData(
        rows,
        {
          filename: 'labos-search-results',
          format,
          title: `Search results for "${query}"`,
          includeTimestamp: true,
        },
        EXPORT_COLUMNS
      );
      toast.success(`Exported ${results.length} result${results.length === 1 ? '' : 's'} to ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const grouped = useMemo(() => {
    const acc: Record<string, SearchResult[]> = {};
    for (const r of results) {
      (acc[r.type] ??= []).push(r);
    }
    return acc;
  }, [results]);

  const showPanel = query.trim().length >= 2;

  return (
    <div ref={wrapperRef} className="global-search-wrapper">
      <div className="global-search-trigger" onClick={() => setOpen(true)}>
        <span className="search-icon">🔍</span>
        <span className="search-placeholder">Search... <kbd>⌘K</kbd></span>
      </div>

      {open && (
        <div className="global-search-modal">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search samples, protocols, instruments, and more..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>
            )}
          </div>

          {showPanel && (
            <>
              {results.length > 0 && (
                <div className="search-results-toolbar">
                  <span className="search-results-count">
                    {results.length} result{results.length === 1 ? '' : 's'}
                  </span>
                  <div className="search-download-actions">
                    <button
                      type="button"
                      className="search-download-btn"
                      onClick={() => handleDownload('excel')}
                      title="Download results as Excel"
                    >
                      ⬇ Excel
                    </button>
                    <button
                      type="button"
                      className="search-download-btn"
                      onClick={() => handleDownload('pdf')}
                      title="Download results as PDF"
                    >
                      ⬇ PDF
                    </button>
                  </div>
                </div>
              )}

              <div className="search-results">
                {loading ? (
                  <div className="search-no-results">Searching...</div>
                ) : results.length === 0 ? (
                  <div className="search-no-results">No results found for "{query}"</div>
                ) : (
                  Object.entries(grouped).map(([type, items]) => (
                    <div key={type} className="search-result-group">
                      <div className="search-group-label">{type}</div>
                      {items.map((result) => (
                        <div
                          key={result.id}
                          className="search-result-item"
                          onClick={() => handleNavigate(result.page)}
                        >
                          <span className="result-icon">{result.icon}</span>
                          <div className="result-content">
                            <div className="result-title">{result.title}</div>
                            <div className="result-subtitle">{result.subtitle}</div>
                          </div>
                          {result.date && (
                            <div className="result-date">{new Date(result.date).toLocaleDateString()}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
