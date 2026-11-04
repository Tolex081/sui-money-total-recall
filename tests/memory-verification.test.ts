// MOCKED: synthetic recall hits only. These check our verification rules, not Mainnet Walrus behaviour.
import { it, expect } from 'vitest';
import { verifyRecall, rememberedSummary } from '@/domain/memory-verification';
import { learnedEventSchema, type LearnedEvent } from '@/domain/learning';

const profileId = 'profile-a';
const event: LearnedEvent = learnedEventSchema.parse({ schemaVersion: 1, eventId: 'event-1', profileId, logicalKey: 'annotation:mov_1', revision: 2, recordedAt: '2026-11-04T10:00:00.000Z', effectiveFrom: '2026-11-04', provenance: 'user_confirmed', sourceRecordIds: ['mov_1'], supersedesEventId: 'event-0', kind: 'payment_explanation', payload: { movementId: 'mov_1', category: 'Groceries', note: 'Groceries', ownTransfer: false } });
const hit = (value: unknown, blob_id = 'blob-1') => ({ text: JSON.stringify(value), blob_id });

it('matches only an exact copy for this profile and reports the remembered values from it', () => {
  const verdict = verifyRecall(event, profileId, [hit({ eventId: 'neighbour', note: 'other' }, 'other'), hit(event)], 'blob-1');
  expect(verdict.verdict).toBe('matched');
  if (verdict.verdict !== 'matched') return;
  expect(verdict.blobId).toBe('blob-1'); expect(verdict.sameBlob).toBe(true); expect(rememberedSummary(verdict.recalled)).toEqual({ note: 'Groceries', category: 'Groceries', ownTransfer: false });
});
it('accepts the same record under property reordering but reports a different stored copy', () => {
  const reordered = Object.fromEntries(Object.entries(event).reverse());
  const verdict = verifyRecall(event, profileId, [hit(reordered, 'blob-2')], 'blob-1');
  expect(verdict.verdict).toBe('matched'); if (verdict.verdict === 'matched') expect(verdict.sameBlob).toBe(false);
});
it('rejects another profile’s record, a changed payload, a different revision or supersession', () => {
  for (const forged of [{ ...event, profileId: 'profile-b' }, { ...event, payload: { ...event.payload, note: 'Lunch' } }, { ...event, revision: 1 }, { ...event, supersedesEventId: 'event-x' }])
    expect(verifyRecall(event, profileId, [hit(forged)], 'blob-1').verdict).toBe('failed_verification');
});
it('treats neighbouring results and unreadable text as not returned', () => {
  expect(verifyRecall(event, profileId, [], 'blob-1').verdict).toBe('not_returned');
  expect(verifyRecall(event, profileId, [{ text: 'not json', blob_id: 'x' }, hit({ ...event, eventId: 'event-9' })], 'blob-1').verdict).toBe('not_returned');
});
