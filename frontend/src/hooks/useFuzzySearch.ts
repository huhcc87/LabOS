import { useMemo, useState } from 'react';
import Fuse, { IFuseOptions } from 'fuse.js';

export function useFuzzySearch<T>(
  items: T[],
  keys: IFuseOptions<T>['keys'],
  threshold = 0.35,
) {
  const [query, setQuery] = useState('');

  const fuse = useMemo(
    () => new Fuse(items, { keys, threshold, includeScore: true }),
    [items, keys, threshold],
  );

  const results = useMemo<T[]>(() => {
    if (!query.trim()) return items;
    return fuse.search(query).map((r) => r.item);
  }, [fuse, query, items]);

  return { query, setQuery, results };
}
