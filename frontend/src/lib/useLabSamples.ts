import { useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';

/** The shape the Samples page works with. */
export interface LabSample {
  id: Id<'samples'>;
  sampleId: string;
  type: string;
  status: string;
  location: string;
  date: string;
  owner: string;
  quantity: string;
  unit: string;
  temperature: string;
  notes: string;
  parentSampleId?: string;
  barcode?: string;
}

export type SampleInput = Omit<LabSample, 'id' | 'date'> & { date?: string };

/** Extra fields live together in the record's `metadata` JSON. */
const META = ['owner', 'quantity', 'unit', 'temperature', 'notes', 'parentSampleId'] as const;
const parseMeta = (s?: string): Record<string, string> => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

const toLab = (d: Doc<'samples'>): LabSample => {
  const m = parseMeta(d.metadata);
  return {
    id: d._id, sampleId: d.sample_id, type: d.type ?? '', status: d.status, location: d.location ?? '',
    date: new Date(d.collected_at ?? d.created_at).toISOString().slice(0, 10),
    owner: m.owner ?? '', quantity: m.quantity ?? '', unit: m.unit ?? '', temperature: m.temperature ?? '', notes: m.notes ?? '',
    parentSampleId: m.parentSampleId || undefined, barcode: d.barcode,
  };
};

const toArgs = (s: Partial<SampleInput>) => ({
  ...(s.sampleId !== undefined ? { sample_id: s.sampleId, name: s.type ? `${s.type} ${s.sampleId}` : s.sampleId } : {}),
  ...(s.type !== undefined ? { type: s.type } : {}),
  ...(s.status !== undefined ? { status: s.status } : {}),
  ...(s.location !== undefined ? { location: s.location } : {}),
  ...(s.date ? { collected_at: new Date(`${s.date}T00:00:00`).getTime() } : {}),
  ...(s.barcode !== undefined ? { barcode: s.barcode } : {}),
  metadata: JSON.stringify(Object.fromEntries(META.filter(k => s[k] !== undefined && s[k] !== '').map(k => [k, s[k]]))),
});

/** Samples saved in Convex, shared by the lab and updating live. */
export function useLabSamples(token: string | null) {
  const rows = useQuery(api.samples.listAll, token ? { token } : 'skip');
  const createM = useMutation(api.samples.create);
  const updateM = useMutation(api.samples.update);
  const removeM = useMutation(api.samples.remove);
  const t = token ?? undefined;
  const samples = useMemo(() => (rows ?? []).map(toLab), [rows]);
  return {
    samples, loading: rows === undefined,
    create: (s: SampleInput) => createM({ token: t, ...toArgs(s), sample_id: s.sampleId, name: s.type ? `${s.type} ${s.sampleId}` : s.sampleId, status: s.status }),
    update: (id: Id<'samples'>, s: Partial<SampleInput>) => updateM({ token: t, id, ...toArgs(s) }),
    remove: (id: Id<'samples'>) => removeM({ token: t, id }),
  };
}
