import { useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import type { ProtocolApproval } from './protocolApproval';

/** The shape the Lab Hub protocols tab works with. */
export interface LabProtocol {
  id: Id<'protocols'>;
  name: string;
  version: string;
  status?: 'active' | 'draft' | 'archived';
  lastUpdated: string;
  description?: string;
  category?: string;
  duration?: string;
  materials?: string;
  steps?: string;
  safety?: string;
  approval?: ProtocolApproval;
  useCount: number;
  authorId: Id<'users'>;
}

/** Fields the forms edit; `approval` here is only the settings (who approves). */
export interface ProtocolInput {
  name: string;
  version?: string;
  status?: string;
  description?: string;
  category?: string;
  duration?: string;
  materials?: string;
  steps?: string;
  safety?: string;
  approval?: Pick<ProtocolApproval, 'mode' | 'approver'> | null;
}

const toLab = (p: Doc<'protocols'>): LabProtocol => ({
  id: p._id,
  name: p.title,
  version: p.version,
  status: p.status as LabProtocol['status'],
  lastUpdated: new Date(p.updated_at).toISOString().slice(0, 10),
  description: p.description,
  category: p.category,
  duration: p.duration,
  materials: p.materials,
  steps: p.steps,
  safety: p.safety,
  approval: p.approval,
  useCount: p.use_count ?? 0,
  authorId: p.author_id,
});

const toArgs = ({ name, approval, status, ...rest }: Partial<ProtocolInput>) => ({
  ...rest,
  ...(name !== undefined ? { title: name } : {}),
  ...(status !== undefined ? { status } : {}),
  ...(approval !== undefined ? { approval: approval && { mode: approval.mode, approver: approval.approver } } : {}),
});

/** Protocols saved in Convex, shared by everyone in the lab, updating live. */
export function useLabProtocols(token: string | null) {
  const rows = useQuery(api.protocols.listAll, token ? { token } : 'skip');
  const createM = useMutation(api.protocols.create);
  const updateM = useMutation(api.protocols.update);
  const removeM = useMutation(api.protocols.remove);
  const removeManyM = useMutation(api.protocols.removeMany);
  const setStatusManyM = useMutation(api.protocols.setStatusMany);
  const decideM = useMutation(api.protocols.decide);
  const markUsedM = useMutation(api.protocols.markUsed);

  const protocols = useMemo(() => (rows ?? []).map(toLab), [rows]);
  const t = token ?? undefined;

  return {
    protocols,
    loading: rows === undefined,
    create: (p: ProtocolInput) => createM({ token: t, ...toArgs(p), title: p.name }),
    update: (id: Id<'protocols'>, patch: Partial<ProtocolInput>) => updateM({ token: t, id, ...toArgs(patch) }),
    remove: (id: Id<'protocols'>) => removeM({ token: t, id }),
    removeMany: (ids: Id<'protocols'>[]) => removeManyM({ token: t, ids }),
    setStatusMany: (ids: Id<'protocols'>[], status: string) => setStatusManyM({ token: t, ids, status }),
    decide: (id: Id<'protocols'>, state: 'approved' | 'rejected') => decideM({ token: t, id, state }),
    markUsed: (id: Id<'protocols'>) => markUsedM({ token: t, id }),
  };
}

export const errText = (e: unknown) =>
  (e as { data?: string })?.data ?? (e instanceof Error ? e.message : 'Something went wrong');
