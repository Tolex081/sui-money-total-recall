'use client';
import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {ArrowUpRight,BookOpen,CalendarDays,Info,Layers3,LayoutDashboard,ShieldCheck,X} from 'lucide-react';
import {IntegrationIdentity} from './integration-brand';

type NavigationProps={screen:string;base:string;demo:boolean;onNavigate?:()=>void};
function Content({screen,base,demo,onNavigate}:NavigationProps){
  return <>
    <Link className="brand" href="/" onClick={onNavigate}><span className="brand-mark">s</span>sui money<span className="brand-dot">.</span></Link>
    <nav aria-label="Primary navigation">{[{id:'today',label:'Today',icon:LayoutDashboard},{id:'activity',label:'Activity',icon:Layers3},{id:'plan',label:'Plan',icon:CalendarDays}].map(({id,label,icon:Icon})=><Link key={id} href={id==='today'&&demo?'/demo':base+'/'+id} onClick={onNavigate} className={'nav-item '+(screen===id?'active':'')} aria-current={screen===id?'page':undefined}><Icon size={20}/>{label}{screen===id&&<span className="nav-dot"/>}</Link>)}</nav>
    <div className="sidebar-note"><div className="sidebar-memory-brand"><IntegrationIdentity provider="walrus"/></div><h3>A plan that remembers.</h3><p>Confirmed context helps the next plan make a little more sense.</p><Link href={base+'/memories'} onClick={onNavigate}>Your remembered context <ArrowUpRight size={15}/></Link></div>
    <nav className="secondary-nav" aria-label="Details"><Link href={base+'/memories'} onClick={onNavigate} className={'nav-item '+(screen==='memories'?'active':'')}><BookOpen size={19}/>Memories</Link><Link href="/proof" onClick={onNavigate} className={'nav-item '+(screen==='proof'?'active':'')}><ShieldCheck size={19}/>Integration proof</Link><Link href="/about" onClick={onNavigate} className={'nav-item '+(screen==='about'?'active':'')}><Info size={19}/>About & privacy</Link></nav>
    <div className="sidebar-bottom"><span className="network-chip"><span className="status-dot"/> Sui Mainnet only</span><span className="micro">No custody. No payments.</span></div>
  </>;
}
export function DesktopNavigation(props:NavigationProps){return <aside className="sidebar desktop-sidebar"><Content {...props}/></aside>;}
export function MobileNavigation({open,onClose,...props}:NavigationProps&{open:boolean;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;if(open&&!dialog?.open)dialog?.showModal();else if(!open&&dialog?.open)dialog.close();},[open]);
  useEffect(()=>{const wide=window.matchMedia('(min-width: 1001px)'),closeWhenWide=()=>{if(wide.matches)onClose();};wide.addEventListener('change',closeWhenWide);return()=>wide.removeEventListener('change',closeWhenWide);},[onClose]);
  return <dialog ref={ref} id="mobile-navigation" className="mobile-drawer" aria-label="Navigation" onCancel={event=>{event.preventDefault();onClose();}} onClose={onClose}><button className="icon-button drawer-close" aria-label="Close navigation" onClick={onClose}><X size={23}/></button><Content {...props} onNavigate={onClose}/></dialog>;
}
