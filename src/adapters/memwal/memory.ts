import { MemWal, type MemorySummary } from '@mysten-incubation/memwal';
import { required } from '@/lib/config';
import { validateRecall, type LearnedEvent } from '@/domain/learning';
export function memoryClient(namespace: string) {
  const serverUrl = process.env.MEMWAL_SERVER_URL ?? 'https://relayer.memory.walrus.xyz';
  if (serverUrl !== 'https://relayer.memory.walrus.xyz') throw new Error('Only the verified Mainnet managed relayer is enabled.');
  return MemWal.create({ key: required('MEMWAL_PRIVATE_KEY'), accountId: required('MEMWAL_ACCOUNT_ID'), serverUrl, namespace, requestTimeoutMs: 12000, recallTimeoutMs: 12000, preflightTimeoutMs: 4000 });
}
export class WalrusMemory {
  readonly client: MemWal;
  constructor(readonly namespace: string) { this.client = memoryClient(namespace); }
  async submit(event: LearnedEvent) {
    if (process.env.MEMWAL_FREE_WRITES_CONFIRMED !== 'true') throw new Error('FREE_WRITE_ENTITLEMENT_UNCONFIRMED');
    return this.client.remember(JSON.stringify(event), this.namespace, { idempotencyKey: event.eventId, dedupe: true });
  }
  status(jobId: string) { return this.client.getRememberStatus(jobId); }
  async recallEvent(event: LearnedEvent) {
    const recalled = await this.client.recall({ query: event.eventId, namespace: this.namespace, limit: 20 });
    return recalled.results.filter(r => validateRecall(r.text, event, event.profileId));
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
