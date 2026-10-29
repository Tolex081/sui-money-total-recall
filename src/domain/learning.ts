import { z } from 'zod';
const safeText = z.string().trim().min(1).max(160).refine(s => !/suiprivkey|(?:0x)?[a-f0-9]{64}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d ()-]{9,}|(?:\b[a-z]+\b\s+){11,}/i.test(s), 'Use a short alias; omit personal details, keys and recovery phrases.');
export { safeText };
const base = z.object({ schemaVersion: z.literal(1), eventId: z.string().min(1).max(100), profileId: z.string().min(1).max(100), logicalKey: z.string().min(1).max(160), revision: z.number().int().positive(), recordedAt: z.iso.datetime(), effectiveFrom: z.iso.date(), provenance: z.enum(['user_confirmed', 'synthetic_demo']), sourceRecordIds: z.array(z.string().max(120)).max(20), supersedesEventId: z.string().max(100).optional() });
const annotation = z.object({ movementId: z.string().max(120), category: safeText, note: safeText, ownTransfer: z.boolean() }).strict();
const recurrence = z.object({ ruleId: z.string().max(100), alias: safeText, amount: z.string().regex(/^\d{1,78}$/), category: safeText, nextDate: z.iso.date(), frequency: z.enum(['once','weekly','monthly']), destination: z.string().max(100).nullable().optional(), associateRuleId: z.string().max(100).optional(), origin:z.enum(['manual','history']).optional() }).strict();
const decision = z.object({ suggestionId: z.string().max(2000), decision: z.enum(['confirmed','rejected']) }).strict();
const preference=z.union([z.object({preference:z.enum(['reserve','horizon','category']),value:safeText}).strict(),z.object({preference:z.literal('reserve'),value:z.string().regex(/^\d{1,78}$/)}).strict()]);
const variants = [
  z.object({ kind: z.literal('payment_explanation'), payload: annotation }),
  z.object({ kind: z.literal('category_rule'), payload: z.object({ destinationId: z.string().max(100), category: safeText }).strict() }),
  z.object({ kind: z.literal('own_destination_rule'), payload: z.object({ destinationId: z.string().max(100), ownTransfer: z.boolean() }).strict() }),
  z.object({ kind: z.literal('reimbursement_link'), payload: z.object({ allocationIds: z.array(z.string().max(100)).min(1).max(20) }).strict() }),
  z.object({ kind: z.literal('recurrence_confirmation'), payload: recurrence }),
  z.object({ kind: z.literal('suggestion_decision'), payload: decision }),
  z.object({ kind: z.literal('planning_preference'), payload: preference }),
  z.object({ kind: z.literal('correction'), payload: z.discriminatedUnion('targetKind', [z.object({ targetKind: z.literal('annotation'), value: annotation }).strict(), z.object({ targetKind: z.literal('recurrence'), value: recurrence }).strict(), z.object({ targetKind: z.literal('reimbursement'), value: z.object({ reverseIds: z.array(z.string().max(100)).max(20) }).strict() })]) }),
  z.object({ kind: z.literal('deactivation'), payload: z.object({ reason: safeText }).strict() }),
] as const;
export const learnedEventSchema = z.discriminatedUnion('kind', [
  base.extend(variants[0].shape).strict(), base.extend(variants[1].shape).strict(),
  base.extend(variants[2].shape).strict(), base.extend(variants[3].shape).strict(),
  base.extend(variants[4].shape).strict(), base.extend(variants[5].shape).strict(),
  base.extend(variants[6].shape).strict(), base.extend(variants[7].shape).strict(),
  base.extend(variants[8].shape).strict(),
]);
export type LearnedEvent = z.infer<typeof learnedEventSchema>;
export type ConfirmedEvent = { envelope: LearnedEvent; state: string; blobId: string | null; recalledAt: string | null; available: boolean };
export function activeEvents(rows: ConfirmedEvent[], profileId: string) {
  const latest = new Map<string, ConfirmedEvent>();
  for (const row of rows) {
    const parsed = learnedEventSchema.safeParse(row.envelope);
    if (!parsed.success || parsed.data.profileId !== profileId || row.state !== 'recall_confirmed' || !row.blobId || !row.recalledAt) continue;
    const prior = latest.get(row.envelope.logicalKey);
    if (!prior || row.envelope.revision > prior.envelope.revision) latest.set(row.envelope.logicalKey, row);
  }
  return [...latest.values()].filter(r => r.available && r.envelope.kind !== 'deactivation');
}
export function validateRecall(text: string, expected: LearnedEvent, profileId: string): boolean {
  try { const candidate = learnedEventSchema.parse(JSON.parse(text)); return candidate.profileId === profileId && JSON.stringify(candidate) === JSON.stringify(learnedEventSchema.parse(expected)); } catch { return false; }
}
export type JobState = 'queued' | 'submitting' | 'accepted' | 'saved' | 'recall_confirmed' | 'failed' | 'submission_outcome_unknown';
export function maySubmit(state: JobState) { return state === 'queued'; }
