'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Calculator, CheckCircle2, Database, Link2, PiggyBank, RefreshCw } from 'lucide-react';
import type { AccountState } from '@/domain/state';
import { answer, type AssistantAnswer, type AssistantBlock, type Source } from '@/domain/assistant';
import { amount } from '@/domain/money';
import { api, ApiError } from './http';

type Turn = { id: number; role: 'user' | 'assistant'; text: string; reply?: AssistantAnswer; failed?: boolean };
const usd = (v: string) => amount(v);
const longDate = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d.slice(0, 10) + 'T12:00:00Z'));
const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const SOURCE: Record<Source, { label: string; icon: typeof Database }> = { walrus: { label: 'Walrus Memory', icon: Database }, sui: { label: 'Sui blockchain', icon: Link2 }, calculated: { label: 'Calculated', icon: Calculator } };
// Memory jobs that still need the page to move them along (there is no background worker).
const UNSETTLED = ['queued', 'submitting', 'accepted', 'saved', 'submission_outcome_unknown'];
const POLL_MS = 6000; // inside the server's 10-a-minute poll limit per profile

// The financial assistant screen. Answers come from the server (live) or from the same engine on the fictional demo
// data (demo). Conversation lives only in this screen: a fresh session starts empty and reads everything again.
export function Assistant({ state, demo, onChanged }: { state: AccountState; demo: boolean; onChanged?: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]), [draft, setDraft] = useState(''), [thinking, setThinking] = useState(false), [kick, setKick] = useState(0);
  const counter = useRef(0), end = useRef<HTMLDivElement>(null), field = useRef<HTMLTextAreaElement>(null), reload = useRef(onChanged);
  useEffect(() => { reload.current = onChanged; }, [onChanged]);
  const welcome = answer(state, 'help', { demo });
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [turns, thinking]);

  // Moves any pending memory save on to Walrus while this screen is open: straight after a confirmation (kick), and
  // for saves left pending from earlier visits. Each step asks the server to advance the oldest job; the account
  // refreshes in place (no reload, so the conversation stays) once a job settles.
  const pending = demo ? '' : state.memories.filter(m => m.envelope.profileId === state.profile.id && UNSETTLED.includes(m.state)).map(m => m.envelope.eventId).join(',');
  useEffect(() => {
    if (demo || (!pending && !kick)) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 20 && !cancelled; attempt++) {
        try {
          const job = await api<{ state: string }>('/memory-jobs/advance', {});
          if (cancelled) return;
          if (job.state === 'idle') { if (attempt > 0) reload.current?.(); setKick(0); return; }
          if (['recall_confirmed', 'failed', 'submission_outcome_unknown'].includes(job.state)) { reload.current?.(); return; }
        } catch (e) { if (!(e instanceof ApiError && e.code === 'RATE_LIMITED')) return; }
        await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
    })();
    return () => { cancelled = true; };
  }, [pending, kick, demo]);
  const submitted = () => { setKick(k => k + 1); reload.current?.(); };

  async function ask(message: string) {
    const text = message.trim();
    if (!text || thinking) return;
    setDraft('');
    setTurns(t => [...t, { id: ++counter.current, role: 'user', text }]);
    setThinking(true);
    try {
      const reply = demo ? answer(state, text, { demo: true }) : await api<AssistantAnswer>('/assistant', { message: text });
      setTurns(t => [...t, { id: ++counter.current, role: 'assistant', text: reply.text, reply }]);
    } catch (e) {
      const limited = e instanceof ApiError && e.code === 'RATE_LIMITED';
      setTurns(t => [...t, { id: ++counter.current, role: 'assistant', text: limited ? 'That\'s a lot of questions at once. Wait a moment and ask again.' : `I couldn't answer that just now: ${(e as Error).message}`, failed: true }]);
    } finally { setThinking(false); field.current?.focus(); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void ask(draft); }

  return <section className="assistant" aria-label="Financial assistant">
    <div className="assistant-thread" role="log" aria-live="polite" aria-busy={thinking}>
      {turns.length === 0 && <div className="assistant-intro">
        <h2>Ask about your money</h2>
        <p className="muted">Answers come from your Walrus Memory, your wallet on Sui and your plan, and each one shows its source. It doesn&rsquo;t guess numbers, and nothing changes unless you confirm it.{demo ? ' This demo uses fictional data.' : ''}</p>
      </div>}
      {turns.map(turn => turn.role === 'user'
        ? <div key={turn.id} className="assistant-turn user"><p>{turn.text}</p></div>
        : <div key={turn.id} className={'assistant-turn reply' + (turn.failed ? ' failed' : '')}>
            <p>{turn.text}</p>
            {turn.reply?.blocks.map((block, i) => <Block key={i} block={block} demo={demo} state={state} onSubmitted={submitted}/>)}
            {!!turn.reply?.suggestions.length && <Suggestions items={turn.reply.suggestions} onPick={ask} disabled={thinking}/>}
          </div>)}
      {thinking && <div className="assistant-turn reply pending"><p><RefreshCw size={14} className="spin" aria-hidden="true"/> Checking your memory, wallet and plan…</p></div>}
      <div ref={end}/>
    </div>
    {turns.length === 0 && <Suggestions items={welcome.suggestions} onPick={ask} disabled={thinking}/>}
    {turns.length === 0 && pending && <p className="micro assistant-resume"><RefreshCw size={12} className="spin" aria-hidden="true"/> Finishing a save to Walrus Memory from earlier. Your previous goal stays in use until Walrus confirms it.</p>}
    <form className="assistant-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="assistant-input">Ask a question</label>
      <textarea id="assistant-input" ref={field} rows={1} maxLength={500} value={draft} placeholder="Ask about your goal, wallet or plan" onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(draft); } }}/>
      <button className="button primary assistant-send" disabled={thinking || !draft.trim()} aria-label="Send question"><ArrowUp size={18} aria-hidden="true"/></button>
    </form>
  </section>;
}

function Suggestions({ items, onPick, disabled }: { items: string[]; onPick: (q: string) => void; disabled: boolean }) {
  return <div className="assistant-suggestions" role="group" aria-label="Suggested questions">{items.map(q => <button key={q} type="button" className="read-filter" disabled={disabled} onClick={() => onPick(q)}>{q}</button>)}</div>;
}
function SourceTag({ source, note }: { source: Source; note?: string }) {
  const { label, icon: Icon } = SOURCE[source];
  return <span className={'assistant-source ' + source}><Icon size={12} aria-hidden="true"/>{label}{note ? <small> · {note}</small> : null}</span>;
}

function Block({ block, demo, state, onSubmitted }: { block: AssistantBlock; demo: boolean; state: AccountState; onSubmitted: () => void }) {
  switch (block.kind) {
    case 'goal': {
      const { goal, schedule } = block;
      return <div className="assistant-card"><SourceTag source="walrus" note={`version ${goal.revision}${goal.confirmedAt ? ', confirmed ' + when(goal.confirmedAt) : ''}`}/>
        <h3><PiggyBank size={16} aria-hidden="true"/> Saving for {goal.purpose}</h3>
        <dl className="assistant-figures"><div><dt>Target</dt><dd>{usd(goal.target)} USDC</dd></div><div><dt>By</dt><dd>{longDate(goal.targetDate)}</dd></div><div><dt>Saved so far</dt><dd>{usd(goal.saved)} USDC <small>(you entered)</small></dd></div><div><dt>Suggested</dt><dd>{schedule.reached ? 'Reached' : `${usd(schedule.contribution)} USDC a ${schedule.per}`}</dd></div></dl>
        <div className="goal-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={schedule.progress} aria-label="Progress towards the goal"><span style={{ width: `${schedule.progress}%` }}/></div>
      </div>;
    }
    case 'goal_history':
      return <div className="assistant-card"><SourceTag source="walrus" note="every version is kept"/>
        <ol className="assistant-list">{[...block.revisions].reverse().map(r => <li key={r.revision}><span>Version {r.revision}: {r.purpose}, {usd(r.target)} USDC</span><span className={'pill' + (r.state === 'active' ? '' : ' muted-pill')}>{r.state === 'active' ? 'In use' : r.state === 'replaced' ? 'Replaced' : r.state === 'saving' ? 'Saving…' : 'Didn’t save'}</span></li>)}</ol>
      </div>;
    case 'contribution':
      return <div className="assistant-card"><SourceTag source="calculated" note={block.hypothetical ? 'what-if, nothing changed' : 'from your goal'}/>
        <dl className="assistant-figures"><div><dt>Target</dt><dd>{usd(block.target)} USDC</dd></div><div><dt>Still to save</dt><dd>{usd(block.schedule.remaining)} USDC</dd></div><div><dt>Suggested</dt><dd>{block.schedule.reached ? 'Nothing' : `${usd(block.schedule.contribution)} USDC a ${block.schedule.per}`}</dd></div><div><dt>Contributions left</dt><dd>{block.schedule.dates}</dd></div></dl>
        <p className="micro">Planned contributions, not payments. Nothing is moved or locked in your wallet.</p>
      </div>;
    case 'balances':
      return <div className="assistant-card"><SourceTag source="sui" note={block.observedAt ? (block.stale ? 'out of date, ' : '') + 'read ' + when(block.observedAt) : 'not read yet'}/>
        <dl className="assistant-figures"><div><dt>USDC</dt><dd>{block.usdc === null || block.stale ? 'Unknown' : usd(block.usdc)}</dd></div><div><dt>SUI</dt><dd>{block.sui === null || block.stale ? 'Unknown' : amount(block.sui, 9, 4)}</dd></div></dl>
        {block.stale && block.usdc !== null && <p className="micro">Last reading: {usd(block.usdc)} USDC, {amount(block.sui!, 9, 4)} SUI. Shown as unknown until it refreshes.</p>}
      </div>;
    case 'transactions':
      return <div className="assistant-card"><SourceTag source="sui" note={block.coverage.state === 'complete' ? 'imported history' : 'history incomplete'}/>
        {block.rows.length ? <ul className="assistant-list">{block.rows.map(r => <li key={r.id}><span>{r.direction === 'in' ? 'Received' : 'Sent'} <strong>{r.amount} {r.coin}</strong>{r.counterparty ? ` ${r.direction === 'in' ? 'from' : 'to'} ${r.counterparty}` : ''}{r.label ? <em> · “{r.label}”</em> : null}</span><span className="micro">{when(r.timestamp)}</span></li>)}</ul> : <p className="micro">No matching transactions.</p>}
      </div>;
    case 'plan':
      if (!block.ready) return null;
      return <div className="assistant-card"><SourceTag source="calculated" note={`until ${longDate(block.endDate!)}`}/>
        <dl className="assistant-figures"><div><dt>Left to spend</dt><dd>{usd(block.leftToSpend!)} USDC</dd></div><div><dt>Bills</dt><dd>{usd(block.bills!)} USDC</dd></div>{block.goalSetAside !== '0' && <div><dt>Savings goal</dt><dd>{usd(block.goalSetAside!)} USDC</dd></div>}<div><dt>Reserve</dt><dd>{usd(block.reserve!)} USDC</dd></div>{block.held !== '0' && <div><dt>Paid, still set aside</dt><dd>{usd(block.held!)} USDC</dd></div>}</dl>
      </div>;
    case 'proposal': return <Proposal block={block} demo={demo} state={state} onSubmitted={onSubmitted}/>;
    case 'memories':
      return <div className="assistant-card"><SourceTag source="walrus" note="confirmed, in use"/>
        {block.items.length ? <ul className="assistant-list">{block.items.map((m, i) => <li key={i}><span>{m.summary}</span><span className="micro">{when(m.recordedAt)}</span></li>)}</ul> : <p className="micro">Nothing yet.</p>}
      </div>;
    case 'verify':
      if (!block.results) return null;
      return <div className="assistant-card"><SourceTag source="walrus" note={block.checkedAt ? 'read back ' + when(block.checkedAt) : undefined}/>
        <ul className="assistant-list">{block.results.map((r, i) => <li key={i}><span>{r.summary || r.kind.replaceAll('_', ' ')} <small>(version {r.revision})</small></span><span className={'pill' + (r.verdict === 'matched' ? '' : ' amber')}>{r.verdict === 'matched' ? 'Matches' : r.verdict.replaceAll('_', ' ')}</span></li>)}</ul>
      </div>;
  }
}

// A proposed goal change. Confirming posts it straight to the normal goal route (consent, revision and pending checks)
// without reloading the page, so this card stays on screen; its progress is read from the account's own memory jobs.
// The current goal stays in use until Walrus confirms the new version.
function Proposal({ block, demo, state, onSubmitted }: { block: Extract<AssistantBlock, { kind: 'proposal' }>; demo: boolean; state: AccountState; onSubmitted: () => void }) {
  const [phase, setPhase] = useState<'open' | 'cancelled' | 'sending' | 'submitted'>('open'), [eventId, setEventId] = useState<string | null>(null), [error, setError] = useState('');
  async function confirm() {
    setPhase('sending'); setError('');
    try {
      const result = await api<{ eventId?: string }>(block.request.path, block.request.body);
      setEventId(result.eventId ?? null); setPhase('submitted'); onSubmitted();
    } catch (e) { setError((e as Error).message); setPhase('open'); }
  }
  const job = eventId ? state.memories.find(m => m.envelope.eventId === eventId) : undefined;
  const progress = phase !== 'submitted' ? null : job?.state === 'recall_confirmed' ? 'confirmed' : job?.state === 'failed' ? 'failed' : job?.state === 'submission_outcome_unknown' ? 'unknown' : 'saving';
  const { current, proposed } = block;
  return <div className="assistant-card proposal"><SourceTag source="calculated" note="proposal, not saved"/>
    <h3>{current ? 'Change your goal?' : 'Save this goal?'}</h3>
    <dl className="assistant-figures">
      <div><dt>Target</dt><dd>{current ? <><s>{usd(current.target)}</s> → </> : null}<strong>{usd(proposed.target)} USDC</strong></dd></div>
      <div><dt>Suggested</dt><dd>{current ? <><s>{usd(current.contribution)}</s> → </> : null}<strong>{usd(proposed.contribution)} USDC a {proposed.per}</strong></dd></div>
      <div><dt>By</dt><dd>{longDate(proposed.targetDate)}</dd></div><div><dt>Saved so far</dt><dd>{usd(proposed.saved)} USDC</dd></div>
    </dl>
    <p className="micro">Saved to Walrus Memory as a new version{current ? ' that replaces the current one; the current goal stays in use until Walrus confirms' : ''}. Walrus keeps every version.</p>
    {error && <p className="memory-failed" role="alert">{error}</p>}
    {demo ? <p className="micro">Demo: this is what you&rsquo;d confirm. Nothing is saved; sign in with your wallet to save a real goal.</p>
      : phase === 'open' ? <div className="read-label-actions"><button className="button primary small" onClick={() => void confirm()}>{current ? 'Yes, change it' : 'Yes, save it'}</button><button className="button small" onClick={() => setPhase('cancelled')}>No, keep it</button></div>
      : phase === 'cancelled' ? <p className="micro">Kept as it is. Nothing was saved.</p>
      : phase === 'sending' ? <p className="micro"><RefreshCw size={12} className="spin" aria-hidden="true"/> Sending…</p>
      : progress === 'confirmed' ? <p className="assistant-confirmed"><CheckCircle2 size={14} aria-hidden="true"/> Confirmed by Walrus. Ask &ldquo;What am I saving towards?&rdquo; to see it.</p>
      : progress === 'failed' ? <p className="memory-failed">It didn&rsquo;t save. Your previous goal is still in use.</p>
      : progress === 'unknown' ? <p className="micro">Walrus didn&rsquo;t confirm whether this saved. It won&rsquo;t be sent twice; your previous goal stays in use until it&rsquo;s checked.</p>
      : <p className="micro"><RefreshCw size={12} className="spin" aria-hidden="true"/> Saving to Walrus Memory. This usually takes under a minute; keep this screen open. Your current goal stays in use until Walrus confirms.</p>}
  </div>;
}
