import Link from 'next/link';
import { ArrowUpRight,ArrowRight,ShieldCheck,Wallet,Layers3 } from 'lucide-react';
import { IntegrationSources,MemoryMascot } from '@/components/integration-brand';

export default function Home(){
  return <main className="landing">
    <header className="landing-header">
      <Link className="brand" href="/"><span className="brand-mark">s</span>sui money<span className="brand-dot">.</span></Link>
      <div className="landing-links"><Link href="/about">About</Link><Link href="/proof">Integration proof <ArrowUpRight size={14}/></Link><Link className="button" href="/today">Your account <Wallet size={16}/></Link></div>
    </header>
    <section className="landing-hero">
      <div className="landing-intro">
        <h1>Your money.<br/>A clearer next step.</h1>
        <p>Understand what you spent. Make room for what’s coming. A spending tracker and forward budget for your Sui wallet, with context you can remember and correct.</p>
        <div className="hero-buttons"><Link className="button primary large" href="/demo">Explore the demo <ArrowRight size={18}/></Link><Link className="button large" href="/proof">See the live evidence <ArrowUpRight size={18}/></Link></div>
        <div className="landing-facts"><span><ShieldCheck size={17}/> Your wallet stays yours</span><span><Layers3 size={17}/> Native USDC · Sui Mainnet</span></div>
      </div>
      <figure className="landing-mascot"><MemoryMascot hero/><figcaption>Wallet facts. Remembered context.<br/>A plan you can explain.</figcaption></figure>
    </section>
    <IntegrationSources/>
    <section className="landing-preview">
      <div><h2>Less guessing.<br/>More breathing room.</h2><p>Start with the balance already in your wallet. Set aside your bills and a reserve. See what remains before your next income date.</p><Link href="/demo">See the numbers <ArrowRight size={17}/></Link></div>
      <div className="preview-paper"><div className="row"><span>Fictional account · 28 Oct</span><span className="pill">Demo</span></div><p>Money remaining after your plan</p><strong>598.50 <small>USDC</small></strong><div className="preview-line"/><div className="row"><span>Wallet balance</span><b>1,240.50 USDC</b></div><div className="row"><span>Upcoming commitments</span><b>−462.00 USDC</b></div><div className="row"><span>Your virtual reserve</span><b>−180.00 USDC</b></div><p className="micro">Synthetic numbers. Estimate based on the entered plan.</p></div>
    </section>
    <footer className="landing-footer"><span>Built with Tatum and Walrus Memory. Independent hackathon project.</span><Link href="/about">Scope, privacy & limitations <ArrowUpRight size={14}/></Link></footer>
  </main>;
}
