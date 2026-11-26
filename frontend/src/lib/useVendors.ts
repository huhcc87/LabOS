import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { BIOMEDICAL_SUPPLIERS, SUPPLIER_CATEGORIES, type SupplierEntry } from '../data/biomedicalSuppliers';

const TOKEN_KEY = 'labos_auth_token';
const getToken = () => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? undefined;

/** A website as `host` without www, so the built-in list and the community list can be compared. */
const hostOf = (url: string): string => {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return url.toLowerCase(); }
};

/**
 * The vendor directory: the built-in list plus the vendors LabOS users added (automatically from captures and
 * requests, or with "Add vendor"). A community vendor whose website is already in the built-in list is left out.
 */
export function useVendors(): { suppliers: SupplierEntry[]; categories: string[]; communityCount: number } {
  const rows = useQuery(api.communityVendors.list, { token: getToken() });
  return useMemo(() => {
    const known = new Set(BIOMEDICAL_SUPPLIERS.map((s) => hostOf(s.website)));
    const extra: SupplierEntry[] = (rows ?? [])
      .filter((r) => !known.has(r.key))
      .map((r) => ({
        name: r.name,
        category: r.category,
        specialty: [],
        website: r.website,
        catalogUrl: r.website,
        tag: 'Community',
        description: r.notes || (r.source === 'custom' ? 'Added by a LabOS user.' : 'Added automatically when a LabOS user captured a product from this vendor.'),
      }));
    const categories = [...SUPPLIER_CATEGORIES] as string[];
    for (const e of extra) if (!categories.includes(e.category)) categories.push(e.category);
    return { suppliers: [...BIOMEDICAL_SUPPLIERS, ...extra], categories, communityCount: extra.length };
  }, [rows]);
}
