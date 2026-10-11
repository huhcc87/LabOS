import { useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { LabSample } from './useLabSamples';

/** The shape the Chain of Custody tab works with. */
export interface SampleEvent {
  id: Id<'sample_events'>;
  sampleId: string;
  event: string;
  user: string;
  timestamp: string;
  details?: string;
}

/** Chain-of-custody events saved in Convex. `samples` maps the typed sample ID to its record. */
export function useLabSampleEvents(token: string | null, samples: LabSample[]) {
  const rows = useQuery(api.samples.listAllEvents, token ? { token } : 'skip');
  const createM = useMutation(api.samples.createEvent);
  const updateM = useMutation(api.samples.updateEvent);
  const removeM = useMutation(api.samples.deleteEvent);
  const t = token ?? undefined;
  const events = useMemo<SampleEvent[]>(() => (rows ?? []).map(r => ({
    id: r._id, sampleId: r.sample_code, event: r.event_type, user: r.user_name,
    timestamp: new Date(r.performed_at).toLocaleString(), details: r.description,
  })), [rows]);
  const idOf = (code: string) => {
    const s = samples.find(x => x.sampleId === code);
    if (!s) throw new Error(`Unknown sample ${code}`);
    return s.id;
  };
  return {
    events, loading: rows === undefined,
    add: (sampleCode: string, event: string, details?: string) =>
      createM({ token: t, sample_id: idOf(sampleCode), event_type: event, description: details || undefined }),
    update: (id: Id<'sample_events'>, event: string, details?: string) =>
      updateM({ token: t, id, event_type: event, description: details ?? '' }),
    remove: (id: Id<'sample_events'>) => removeM({ token: t, id }),
  };
}
