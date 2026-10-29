import Image from 'next/image';
import mascot from '../../public/brand/walrus-tatum.png';

export function IntegrationIdentity({provider}:{provider:'tatum'|'walrus'}) {
  return <span className={'integration-identity '+provider}>
    <Image src={'/brand/'+provider+'.svg'} width={provider==='tatum'?81:90} height={21} alt={provider==='tatum'?'Tatum':'Walrus'} unoptimized/>
  </span>;
}

export function IntegrationSources() {
  return <div className="integration-sources" aria-label="Integration roles">
    <div><IntegrationIdentity provider="tatum"/><span>Verified wallet facts</span></div>
    <span className="integration-join" aria-hidden="true">+</span>
    <div><IntegrationIdentity provider="walrus"/><span>Confirmed context that lasts across sessions</span></div>
  </div>;
}

export function MemoryMascot({hero=false}:{hero?:boolean}) {
  return <Image className={hero?'mascot-hero':'mascot-memory'} src={mascot} alt={hero?'The Walrus event mascot holding the Tatum mark':''} sizes={hero?'(max-width: 760px) 240px, 360px':'150px'} preload={hero}/>;
}
