import { database } from '@/adapters/postgres/client';
import { WalrusMemory } from '@/adapters/memwal/memory';
import { activeEvents, learnedEventSchema, type ConfirmedEvent } from '@/domain/learning';
import { rememberedSummary, verifyRecall, type RecallHit } from '@/domain/memory-verification';
import { consumeLimits } from '@/lib/rate-limit';
import type { Profile } from './auth';

// Read-only check that this profile's active memories can be read back from Walrus. PostgreSQL only says which
// events to look for and what their confirmed copies were; the remembered values shown come from Walrus' answers.
// It writes no memory, label, plan or job: the only database write is the shared rate-limit counter.
// The namespace comes from the signed-in profile loaded on the server; nothing in the request can change it.
export type RecallSource = { recallCandidates(eventId: string): Promise<RecallHit[]> };
const MAX_CHECKED = 10;

export async function verifyMemoriesFromWalrus(profile: Profile, sourceFor: (namespace: string) => RecallSource = namespace => new WalrusMemory(namespace)) {
  await consumeLimits([{ key: 'memory:recall:global', max: 12, seconds: 60 }, { key: `memory:recall:${profile.id}`, max: 3, seconds: 60 }]);
  const rows = (await database().query('SELECT e.envelope,e.available,j.state,j.blob_id,j.recalled_at,j.expires_at FROM learned_events e JOIN memory_jobs j ON j.profile_id=e.profile_id AND j.event_id=e.id WHERE e.profile_id=$1 ORDER BY e.created_at', [profile.id])).rows;
  const memories: ConfirmedEvent[] = rows.map(r => ({ envelope: learnedEventSchema.parse(r.envelope), available: r.available && (!r.expires_at || new Date(r.expires_at).getTime() > Date.now()), state: r.state, blobId: r.blob_id, recalledAt: r.recalled_at ? new Date(r.recalled_at).toISOString() : null }));
  const active = activeEvents(memories, profile.id).sort((a, b) => b.envelope.recordedAt.localeCompare(a.envelope.recordedAt));
  const source = sourceFor(profile.namespace);
  const checked = [];
  for (const memory of active.slice(0, MAX_CHECKED)) {
    const event = memory.envelope;
    // The previous revision must be the one this event says it replaces.
    const previous = memories.find(m => m.envelope.logicalKey === event.logicalKey && m.envelope.revision === event.revision - 1)?.envelope ?? null;
    const supersessionConsistent = event.revision === 1 ? !event.supersedesEventId : !!previous && event.supersedesEventId === previous.eventId;
    const base = { eventId: event.eventId, logicalKey: event.logicalKey, revision: event.revision, kind: event.kind, recordedAt: event.recordedAt, supersedes: previous ? { eventId: previous.eventId, revision: previous.revision } : null, supersessionConsistent };
    try {
      const verdict = verifyRecall(event, profile.id, await source.recallCandidates(event.eventId), memory.blobId);
      checked.push(verdict.verdict === 'matched'
        ? { ...base, verdict: 'matched' as const, blobId: verdict.blobId, sameBlob: verdict.sameBlob, remembered: rememberedSummary(verdict.recalled), recalledAt: new Date().toISOString() }
        : { ...base, verdict: verdict.verdict, reason: verdict.reason, recalledAt: new Date().toISOString() });
    } catch {
      checked.push({ ...base, verdict: 'unavailable' as const, reason: 'Walrus could not be reached for this record. Nothing was changed; try again shortly.', recalledAt: new Date().toISOString() });
    }
  }
  return { checkedAt: new Date().toISOString(), activeCount: active.length, checkedCount: checked.length, results: checked };
}
