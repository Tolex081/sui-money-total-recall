import { MemWal, type MemorySummary } from '@mysten-incubation/memwal';
import { required } from '@/lib/config';
import { validateRecall, type LearnedEvent } from '@/domain/learning';
// Walrus writes are ON by default. MEMWAL_WRITES_PAUSED=true is the operator's kill switch; the older
// MEMWAL_FREE_WRITES_CONFIRMED=false still pauses them so existing deployments keep the setting they chose.
export function memoryWritesPaused() {
  return process.env.MEMWAL_WRITES_PAUSED === 'true' || process.env.MEMWAL_FREE_WRITES_CONFIRMED === 'false';
}
// Which Walrus Memory account to use. Without credentials it is Sui Money's operator account; with them it is an
// account the user owns, reached through the delegate key they added to it.
export type MemoryCredentials = { accountId: string; delegateKey: string };
export function memoryClient(namespace: string, credentials?: MemoryCredentials) {
  const serverUrl = process.env.MEMWAL_SERVER_URL ?? 'https://relayer.memory.walrus.xyz';
  if (serverUrl !== 'https://relayer.memory.walrus.xyz') throw new Error('Only the verified Mainnet managed relayer is enabled.');
  const key = credentials?.delegateKey ?? required('MEMWAL_PRIVATE_KEY'), accountId = credentials?.accountId ?? required('MEMWAL_ACCOUNT_ID');
  return MemWal.create({ key, accountId, serverUrl, namespace, requestTimeoutMs: 12000, recallTimeoutMs: 12000, preflightTimeoutMs: 4000 });
}
export class WalrusMemory {
  readonly client: MemWal;
  readonly accountId: string | null;
  constructor(readonly namespace: string, credentials?: MemoryCredentials) { this.client = memoryClient(namespace, credentials); this.accountId = credentials?.accountId ?? null; }
  async submit(event: LearnedEvent) {
    if (memoryWritesPaused()) throw new Error('FREE_WRITE_ENTITLEMENT_UNCONFIRMED');
    return this.client.remember(JSON.stringify(event), this.namespace, { idempotencyKey: event.eventId, dedupe: true });
  }
  status(jobId: string) { return this.client.getRememberStatus(jobId); }
  async recallEvent(event: LearnedEvent) {
    const recalled = await this.client.recall({ query: event.eventId, namespace: this.namespace, limit: 20 });
    return recalled.results.filter(r => validateRecall(r.text, event, event.profileId));
  }
  // Raw hits for one event ID in this profile's namespace, for server-side verification only; never sent to a browser.
  async recallCandidates(eventId: string) {
    const recalled = await this.client.recall({ query: eventId, namespace: this.namespace, limit: 20, timeoutMs: 8000 });
    return recalled.results.map(r => ({ text: r.text, blob_id: r.blob_id }));
  }
  async metadataPage(cursor?: string) { return this.client.listMemories({ namespace: this.namespace, cursor, limit: 500 }); }
}
export async function enumerateMetadata(fetchPage: (cursor?: string) => Promise<{ memories: MemorySummary[]; has_more: boolean; next_cursor: string | null; must_resync: boolean }>, maxPages = 100) {
  const rows = new Map<string, MemorySummary>();
  let cursor: string | undefined, resyncs = 0;
  for (let index = 0; index < maxPages; index++) {
    const page = await fetchPage(cursor);
    if (page.must_resync) { if (++resyncs > 1) throw new Error('METADATA_CURSOR_INVALIDATED'); rows.clear(); cursor = undefined; continue; }
    page.memories.forEach(m => rows.set(m.memory_id, m));
    if (!page.has_more) return [...rows.values()];
    if (!page.next_cursor || page.next_cursor === cursor) throw new Error('METADATA_CURSOR_STALLED');
    cursor = page.next_cursor;
  }
  throw new Error('METADATA_ENUMERATION_PARTIAL');
}
