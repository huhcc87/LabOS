import { useState, useEffect, useCallback } from 'react';
import type { PaginatedResponse } from '../lib/types';
import toast from 'react-hot-toast';

interface UseApiOptions {
  initialPage?: number;
  initialPerPage?: number;
}

export function usePagedApi<T>(
  fetcher: (page: number, perPage: number, search: string) => Promise<{ data: PaginatedResponse<T> }>,
  opts: UseApiOptions = {}
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(opts.initialPage ?? 1);
  const [perPage, setPerPage] = useState(opts.initialPerPage ?? 20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetcher(page, perPage, search);
      setItems(resp.data.items);
      setTotal(resp.data.total);
      setPages(resp.data.pages);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search]);

  useEffect(() => { load(); }, [load]);

  return { items, total, pages, page, setPage, perPage, setPerPage, search, setSearch, loading, reload: load };
}
