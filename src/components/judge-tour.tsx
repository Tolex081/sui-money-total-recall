'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Compass, X } from 'lucide-react';

type Step = { route: string; target: string; title: string; text: string };
const KEY = 'sm-tour';

// Five stops through what makes Sui Money different. The demo and a signed-in Mainnet wallet get the same story on
// their own screens.
const DEMO: Step[] = [
  { route: '/demo', target: '.lead-main', title: 'One answer first', text: 'Today answers one question: what can I spend? One sentence, one figure, and a timeline of bills below that shows why.' },
  { route: '/demo', target: '.lead-trail', title: 'Every number is traceable', text: 'Open this to see every part of the figure and where it came from: the wallet read, each bill with its Walrus record, and the arithmetic.' },
  { route: '/demo/activity', target: '.pay-prompt', title: 'Payments ask what they were for', text: 'The chain records what moved. You add what it was for, and Sui Money remembers it on Walrus. Try it: the demo saves in your browser only.' },
  { route: '/demo/memories', target: '.memory-record', title: 'Memory you can check', text: 'Each remembered item shows its version, its earlier versions and its Walrus proof. Corrections never overwrite.' },
  { route: '/demo/memories', target: '.ask-fab', title: 'Ask, with sources', text: 'Ask answers from fixed rules over your data, never an AI guess. Every answer is labelled Walrus Memory, Sui blockchain or Calculated.' },
];
const LIVE: Step[] = [
  { route: '/today', target: '.read-balance-card', title: 'Your wallet, from Sui Mainnet', text: 'Balances are read from Sui Mainnet through Tatum, with the time of the read. Sui Money never holds your keys.' },
  { route: '/activity', target: '.tatum-proof', title: 'A Tatum proof for every payment', text: 'Open it, then "Check with Tatum": Sui Money asks Tatum for that transaction again and shows whether it matches.' },
  { route: '/plan', target: '.trail-button', title: 'Every number is traceable', text: 'See exactly where "Left to spend" comes from: the Tatum balance, each bill and goal with its Walrus record, and the arithmetic.' },
  { route: '/memories', target: '.memories-intro .button', title: 'Memory you can check', text: '"Verify memories from Walrus" reads every memory back from Walrus Mainnet and checks it matches what you confirmed.' },
  { route: '/plan', target: '.ask-fab', title: 'Ask, with sources', text: 'Ask answers from fixed rules over your data, never an AI guess, and nothing changes until you confirm.' },
];
const read = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); return v && typeof v.step === 'number' ? v as { step: number; demo: boolean } : null; } catch { return null; } };
const write = (v: { step: number; demo: boolean } | null) => { try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch { /* storage blocked: the tour simply ends */ } };

export function TourButton({ demo }: { demo: boolean }) {
  const router = useRouter();
  return <button type="button" className="button tour-start" onClick={() => { write({ step: 0, demo }); router.push((demo ? DEMO : LIVE)[0].route); window.dispatchEvent(new Event('sm-tour')); }}>
    <Compass size={15} aria-hidden="true"/>Take the 1-minute tour
  </button>;
}

export function TourGuide() {
  const router = useRouter(), pathname = usePathname();
  const [tour, setTour] = useState<{ step: number; demo: boolean } | null>(null), [found, setFound] = useState<{ key: string; rect: DOMRect | null } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => { const sync = () => setTour(read()); sync(); window.addEventListener('sm-tour', sync); return () => window.removeEventListener('sm-tour', sync); }, [pathname]);
  const steps = useMemo(() => (tour ? (tour.demo ? DEMO : LIVE) : []), [tour]), step = tour ? steps[tour.step] : null, onRoute = !!step && step.route === pathname;
  const stepKey = tour ? tour.demo + '-' + tour.step + '-' + pathname : '', ready = !!found && found.key === stepKey, rect = ready ? found!.rect : null;

  // Find the step's target once its screen has loaded; after a few seconds without it, show the card on its own.
  useLayoutEffect(() => {
    if (!step || !onRoute) return;
    let cancelled = false, tries = 0;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (el) { el.scrollIntoView({ block: 'center' }); requestAnimationFrame(() => { if (!cancelled) setFound({ key: stepKey, rect: el.getBoundingClientRect() }); }); return; }
      if (++tries > 40) { setFound({ key: stepKey, rect: null }); return; }
      setTimeout(find, 250);
    };
    setTimeout(find, 0);
    const track = () => { const el = document.querySelector(step.target) as HTMLElement | null; if (el) setFound({ key: stepKey, rect: el.getBoundingClientRect() }); };
    window.addEventListener('resize', track); window.addEventListener('scroll', track, true);
    return () => { cancelled = true; window.removeEventListener('resize', track); window.removeEventListener('scroll', track, true); };
  }, [step, onRoute, stepKey]);
  useEffect(() => { if (ready) card.current?.focus(); }, [ready, tour?.step]);

  const go = useCallback((n: number) => {
    if (!tour) return;
    if (n < 0 || n >= steps.length) { write(null); setTour(null); return; }
    const next = { step: n, demo: tour.demo }; write(next); setTour(next);
    if (steps[n].route !== pathname) router.push(steps[n].route);
  }, [tour, steps, pathname, router]);
  useEffect(() => { if (!tour) return; const key = (e: KeyboardEvent) => { if (e.key === 'Escape') go(-1); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [tour, go]);

  if (!tour || !step || !onRoute || !ready) return null;
  const pad = 8, below = rect ? rect.bottom + 16 + 220 < window.innerHeight : true;
  const cardStyle = rect && window.innerWidth > 760
    ? { left: Math.min(Math.max(16, rect.left), window.innerWidth - 400), top: below ? rect.bottom + 16 : Math.max(16, rect.top - 16 - 210) }
    : undefined;
  return <div className="tour-layer">
    {rect ? <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}/> : <div className="tour-dim"/>}
    <div ref={card} className={'tour-card' + (cardStyle ? '' : ' centered')} style={cardStyle} role="dialog" aria-modal="false" aria-labelledby="tour-title" tabIndex={-1}>
      <div className="tour-card-head"><span className="tour-count">{tour.step + 1} of {steps.length}</span><button type="button" className="icon-button" aria-label="End the tour" onClick={() => go(-1)}><X size={18} aria-hidden="true"/></button></div>
      <h2 id="tour-title">{step.title}</h2>
      <p>{step.text}</p>
      <div className="tour-actions">
        {tour.step > 0 && <button type="button" className="button small" onClick={() => go(tour.step - 1)}>Back</button>}
        <button type="button" className="button primary small" onClick={() => go(tour.step + 1)}>{tour.step === steps.length - 1 ? 'Finish' : 'Next'}</button>
      </div>
    </div>
  </div>;
}
