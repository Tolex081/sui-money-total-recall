'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Maximize2, X } from 'lucide-react';
import type { AccountState } from '@/domain/state';
import mascot from '../../public/brand/walrus-tatum.png';
import { Assistant } from './assistant';

// A shortcut to Ask from any screen: the Walrus mascot holding the Tatum mark, bottom right. It opens Ask in a side
// panel so the screen behind stays in place; "Full screen" goes to the Ask page itself.
export function AskShortcut({ state, demo, fullHref, onChanged }: { state: AccountState; demo: boolean; fullHref: string; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDialogElement>(null), opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = panel.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) { dialog.close(); opener.current?.focus(); }
  }, [open]);
  return <>
    <button ref={opener} type="button" className="ask-fab" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls="ask-panel">
      <span className="ask-fab-mascot"><Image src={mascot} alt="" sizes="48px"/></span>
      <span className="ask-fab-label">Ask</span>
      <span className="sr-only"> about your money</span>
    </button>
    <dialog ref={panel} id="ask-panel" className="ask-panel" aria-labelledby="ask-panel-title" onCancel={event => { event.preventDefault(); setOpen(false); }} onClick={event => { if (event.target === panel.current) setOpen(false); }}>
      <div className="ask-panel-head">
        <h2 id="ask-panel-title">Ask</h2>
        <Link className="text-link ask-panel-full" href={fullHref} onClick={() => setOpen(false)}><Maximize2 size={14} aria-hidden="true"/>Full screen</Link>
        <button type="button" className="icon-button" aria-label="Close Ask" onClick={() => setOpen(false)}><X size={20} aria-hidden="true"/></button>
      </div>
      {open && <Assistant state={state} demo={demo} onChanged={onChanged}/>}
    </dialog>
  </>;
}
