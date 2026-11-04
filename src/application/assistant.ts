import { z } from 'zod';
import { accountState } from './state';
import { verifyMemoriesFromWalrus } from './memory-recall';
import { consumeLimits } from '@/lib/rate-limit';
import { amount } from '@/domain/money';
import { answer, type AssistantAnswer } from '@/domain/assistant';
import type { Profile } from './auth';

// The assistant reads only the signed-in profile's own state, loaded here on the server. The request carries one
// message and nothing else: no profile, wallet, namespace, history or tool results are accepted from the browser.
// It never writes; a proposed goal change is confirmed by the user through the existing goal route.
const askInput = z.object({ message: z.string().trim().min(1, 'Ask a question.').max(500, 'Keep questions under 500 characters.') }).strict();

export async function askAssistant(profile: Profile, raw: unknown): Promise<AssistantAnswer & { answeredAt: string }> {
  const { message } = askInput.parse(raw);
  await consumeLimits([{ key: 'assistant:global', max: 240, seconds: 60 }, { key: `assistant:${profile.id}`, max: 20, seconds: 60 }]);
  const state = await accountState(profile);
  const reply = answer(state, message);
  if (reply.intent === 'verify') {
    // A live read-back from Walrus, with the verification's own rate limit (3 a minute per profile).
    const checked = await verifyMemoriesFromWalrus(profile);
    const results = checked.results.map(r => {
      const v = 'remembered' in r && r.remembered ? r.remembered as Record<string, string | boolean> : null;
      const summary = !v ? '' : typeof v.target === 'string' ? `${v.purpose}: ${amount(v.target)} USDC` : typeof v.note === 'string' ? `"${v.note}"` : typeof v.value === 'string' ? String(v.value) : '';
      return { kind: r.kind, revision: r.revision, verdict: r.verdict, summary };
    });
    const matched = results.filter(r => r.verdict === 'matched').length;
    reply.blocks = [{ kind: 'verify', source: 'walrus', checkedAt: checked.checkedAt, results }];
    reply.text = results.length ? `Walrus returned and matched ${matched} of ${results.length} confirmed ${results.length === 1 ? 'memory' : 'memories'}, each compared with exactly what was saved.` : 'You have no confirmed memories to verify yet.';
  }
  return { ...reply, answeredAt: new Date().toISOString() };
}
