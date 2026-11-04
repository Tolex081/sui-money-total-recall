import { learnedEventSchema, validateRecall, type LearnedEvent } from './learning';

// What Walrus returned for one remembered event, judged against the copy saved when it was confirmed.
// Semantic recall can return neighbouring records; only hits carrying this event's ID are considered, and only an
// exact match for this profile counts. Nothing from other hits is ever passed on.
export type RecallHit = { text: string; blob_id: string };
export type RecallVerdict =
  | { verdict: 'matched'; blobId: string; sameBlob: boolean; copies: number; recalled: LearnedEvent }
  | { verdict: 'not_returned'; reason: string }
  | { verdict: 'failed_verification'; reason: string };

export function verifyRecall(expected: LearnedEvent, profileId: string, hits: RecallHit[], expectedBlobId: string | null): RecallVerdict {
  const forThisEvent = hits.filter(hit => { try { return JSON.parse(hit.text)?.eventId === expected.eventId; } catch { return false; } });
  if (!forThisEvent.length) return { verdict: 'not_returned', reason: 'Walrus did not return a record with this event ID.' };
  const exact = forThisEvent.filter(hit => validateRecall(hit.text, expected, profileId));
  if (!exact.length) return { verdict: 'failed_verification', reason: 'Walrus returned a record with this event ID, but it does not match the saved copy for this profile.' };
  const best = exact.find(hit => hit.blob_id === expectedBlobId) ?? exact[0];
  return { verdict: 'matched', blobId: best.blob_id, sameBlob: best.blob_id === expectedBlobId, copies: exact.length, recalled: learnedEventSchema.parse(JSON.parse(best.text)) };
}

// The application fields worth showing for a remembered event, read from the record Walrus returned.
export function rememberedSummary(event: LearnedEvent): Record<string, string | boolean> {
  switch (event.kind) {
    case 'payment_explanation': return { note: event.payload.note, category: event.payload.category, ownTransfer: event.payload.ownTransfer };
    case 'planning_preference': return { preference: event.payload.preference, value: event.payload.value };
    case 'recurrence_confirmation': return { alias: event.payload.alias, amount: event.payload.amount, frequency: event.payload.frequency, nextDate: event.payload.nextDate };
    case 'correction': return event.payload.targetKind === 'annotation' ? { note: event.payload.value.note, category: event.payload.value.category } : { targetKind: event.payload.targetKind };
    case 'suggestion_decision': return { decision: event.payload.decision };
    default: return {};
  }
}
