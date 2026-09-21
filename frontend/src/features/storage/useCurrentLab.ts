import { useEffect, useState, useCallback } from 'react';
import { labMembersApi } from '../../lib/api';

export interface LabMembership {
  id: string;
  lab_id: string;
  lab_role: string;
  status: string;
  lab?: { name: string } & Record<string, unknown>;
}

const STORAGE_KEY = 'labos_current_lab_id';

/** Resolves the labs the logged-in user belongs to and tracks which one is "current". */
export function useCurrentLab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<LabMembership[]>([]);
  const [labId, setLabIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setLabId = useCallback((id: string) => {
    setLabIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore: storage unavailable */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await labMembersApi.listMy();
        if (cancelled) return;
        const active = (res.data as LabMembership[]).filter((m) => m.status === 'active');
        setMemberships(active);
        setLabIdState((current) => {
          if (current && active.some((m) => m.lab_id === current)) return current;
          return active[0]?.lab_id ?? null;
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load lab membership');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { loading, error, memberships, labId, setLabId };
}
