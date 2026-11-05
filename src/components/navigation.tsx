'use client';
import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {ArrowDownLeft,BookOpen,MessagesSquare,CalendarDays,Info,Layers3,LayoutDashboard,Send,Settings,ShieldCheck,X} from 'lucide-react';
import {IntegrationIdentity} from './integration-brand';

type NavigationProps={screen:string;base:string;demo:boolean;moves?:boolean;settings?:boolean;assistant?:boolean;onNavigate?:()=>void};
function Content({screen,base,demo,moves=false,settings=false,assistant=false,onNavigate}:NavigationProps){
  return <>
    <Link className="brand" href="/" onClick={onNavigate}><span className="brand-mark">s</span>sui money<span className="brand-dot">.</span></Link>
    <nav aria-label="Primary navigation">{[{id:'today',label:'Today',icon:LayoutDashboard},{id:'activity',label:'Activity',icon:Layers3},{id:'plan',label:'Plan',icon:CalendarDays},...(assistant?[{id:'assistant',label:'Ask',icon:MessagesSquare}]:[]),...(moves?[{id:'send',label:'Send',icon:Send},{id:'receive',label:'Receive',icon:ArrowDownLeft}]:[])].map(({id,label,icon:Icon})=><Link key={id} href={id==='today'&&demo?'/demo':base+'/'+id} onClick={onNavigate} className={'nav-item '+(screen===id?'active':'')} aria-current={screen===id?'page':undefined}><Icon size={20}/>{label}{screen===id&&<span className="nav-dot"/>}</Link>)}</nav>
    <nav className="secondary-nav" aria-label="Details"><Link href={base+'/memories'} onClick={onNavigate} className={'nav-item '+(screen==='memories'?'active':'')} aria-current={screen==='memories'?'page':undefined}><BookOpen size={19}/>Memories</Link><Link href="/proof" onClick={onNavigate} className={'nav-item '+(screen==='proof'?'active':'')} aria-current={screen==='proof'?'page':undefined}><ShieldCheck size={19}/>Integration proof</Link>{settings&&<Link href="/settings" onClick={onNavigate} className={'nav-item '+(screen==='settings'?'active':'')} aria-current={screen==='settings'?'page':undefined}><Settings size={19}/>Settings</Link>}<Link href="/about" onClick={onNavigate} className={'nav-item '+(screen==='about'?'active':'')} aria-current={screen==='about'?'page':undefined}><Info size={19}/>About & privacy</Link></nav>
    <div className="sidebar-bottom"><span className="sidebar-memory-brand"><span className="micro">Memory on</span><IntegrationIdentity provider="walrus"/></span><span className="network-chip"><span className="status-dot"/> Sui Mainnet only</span><span className="micro">{moves?'No custody. You approve every send.':'No custody. No payments.'}</span></div>
  </>;
}
export function DesktopNavigation(props:NavigationProps){return <aside className="sidebar desktop-sidebar"><Content {...props}/></aside>;}
export function MobileNavigation({open,onClose,...props}:NavigationProps&{open:boolean;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;if(open&&!dialog?.open)dialog?.showModal();else if(!open&&dialog?.open)dialog.close();},[open]);
  useEffect(()=>{const wide=window.matchMedia('(min-width: 1001px)'),closeWhenWide=()=>{if(wide.matches)onClose();};wide.addEventListener('change',closeWhenWide);return()=>wide.removeEventListener('change',closeWhenWide);},[onClose]);
  return <dialog ref={ref} id="mobile-navigation" className="mobile-drawer" aria-label="Navigation" onCancel={event=>{event.preventDefault();onClose();}} onClose={onClose}><button className="icon-button drawer-close" aria-label="Close navigation" onClick={onClose}><X size={23}/></button><Content {...props} onNavigate={onClose}/></dialog>;
}
