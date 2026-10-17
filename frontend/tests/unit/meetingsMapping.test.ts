import { describe, expect, it } from 'vitest';
import { fromDoc, toFields } from '../../src/features/lab-meetings/hooks/useMeetings';

describe('meeting <-> Convex mapping', () => {
  it('round-trips the fields the page edits', () => {
    const start = Date.parse('2026-11-02T15:00:00Z');
    const fields = toFields({
      title: 'Lab meeting', type: 'journal_club', scheduledAt: new Date(start).toISOString(),
      endTime: new Date(start + 90 * 60000).toISOString(), tags: ['a', 'b'],
      attendees: [{ userId: 'x', name: 'X', role: 'member', status: 'present' }],
    });
    expect(fields).toMatchObject({ meeting_type: 'journal_club', scheduled_at: start, duration_minutes: 90, tags: 'a,b' });

    const m = fromDoc({ id: 'm1', ...fields, status: 'scheduled', created_at: start, updated_at: start });
    expect(m.type).toBe('journal_club');
    expect(m.scheduledAt).toBe(new Date(start).toISOString());
    expect(m.tags).toEqual(['a', 'b']);
    expect(m.attendees[0].status).toBe('present');
  });

  it('defaults reminders to a day and an hour, and keeps an explicit empty choice', () => {
    const base = { id: 'm', title: 't', scheduled_at: 1000, status: 'scheduled', created_at: 1, updated_at: 1 }
    expect(fromDoc(base).reminders).toEqual([1440, 60])
    expect(fromDoc({ ...base, reminders: '[]' }).reminders).toEqual([])
    expect(toFields({ reminders: [15] }).reminders).toBe('[15]')
  })

  it('survives missing or corrupt JSON lists', () => {
    const m = fromDoc({ id: 'm2', title: 't', scheduled_at: 1000, status: 'scheduled', agenda: '{oops', created_at: 1, updated_at: 1 });
    expect(m.agenda).toEqual([]);
    expect(m.actionItems).toEqual([]);
  });
});
