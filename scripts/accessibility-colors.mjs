import { readFile,writeFile } from 'node:fs/promises';
const path='src/app/globals.css';let css=await readFile(path,'utf8');
const darkSurface=/(?:brand-mark|remainder-card|card-label|outline-pill|hero-amount|hero-caption|light-label|daily-row small|horizon-badge|hero-footnote)/;
const luminance=hex=>{const c=hex.match(/\w\w/g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
css=css.replace(/([^{}]+)\{([^{}]+)\}/g,(block,selector,declarations)=>{
  if(darkSurface.test(selector))return block;
  const changed=declarations.replace(/(?<![-\w])color:#([0-9a-f]{6})(?=;|$)/gi,(match,hex)=>((1.05/(luminance(hex)+.05))<5.1?'color:#596950':match));
  return selector+'{'+changed+'}';
});
css=css.replace(/font-size:([6-9])px/g,'font-size:10px');
await writeFile(path,css);console.log('Improved secondary text contrast and minimum label sizes.');
