import { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { useAuth } from '../context/AuthContext';
import type { FunctionReference } from 'convex/server';

interface UseConvexPagedOptions {
  initialPerPage?: number;
  extraArgs?: Record<string, any>;
}

export function useConvexPaged<T>(
  queryRef: FunctionReference<"query", "public", any, any>,
  opts: UseConvexPagedOptions = {}
) {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(opts.initialPerPage ?? 20);

  const args = useMemo(() => ({
    token: token ?? undefined,
    search: search || undefined,
    paginationOpts: { numItems: perPage, cursor: null },
    ...opts.extraArgs,
  }), [token, search, perPage, opts.extraArgs]);

  const result = useQuery(queryRef, token ? args : 'skip');

  const items = (result?.page ?? result?.items ?? []) as T[];
  const hasMore = result?.hasMore ?? (result?.isDone === undefined ? false : !result.isDone);
  const total = items.length + (hasMore ? 1 : 0);

  return {
    items,
    total,
    pages: 1,
    page,
    setPage,
    perPage,
    setPerPage,
    search,
    setSearch,
    loading: result === undefined,
    reload: () => {},
  };
}

export function useConvexList<T>(
  queryRef: FunctionReference<"query", "public", any, any>,
  args?: Record<string, any> | 'skip'
) {
  const result = useQuery(queryRef, args ?? {});
  return {
    items: (result ?? []) as T[],
    loading: result === undefined,
  };
}
