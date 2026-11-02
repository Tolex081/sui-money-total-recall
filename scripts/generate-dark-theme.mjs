// Generates src/app/theme-dark.css from globals.css and theme.css. Run: npm run theme:dark
// Tokens flip by redefinition (see DARK_TOKENS). Hard-coded colours are found per rule: for each media query, selector
// and property, the declaration that wins across both files in source order is kept, and if it uses a colour literal
// that literal is mapped to a dark equivalent in OKLab (surfaces darken, text lightens). The light theme is untouched.
import {readFile,writeFile} from 'node:fs/promises';
import postcss from 'postcss';

const SOURCES=['src/app/globals.css','src/app/theme.css'],OUT='src/app/theme-dark.css',ROOT=':root[data-theme="dark"]';
const DARK_TOKENS={
  '--ink':'#e3e9f4','--muted':'#9eabc2','--line':'#26344d','--paper':'#131c2e','--canvas':'#0b1220',
  '--blue':'#3d6fe6','--blue-hover':'#5582f0','--blue-pressed':'#3260d0','--blue-tint':'#1a2a4a','--blue-soft':'#152038','--blue-light':'#1a2a4a',
  '--selection':'#2b4a86','--memory':'#162a4d','--memory-border':'#2b4570',
  '--positive':'#5fd39a','--positive-soft':'#123222','--warning':'#f2c36b','--warning-soft':'#33280f','--negative':'#ff9e8a','--negative-soft':'#3a1d18',
  '--link':'#8fb1ff','--link-hover':'#b6ccff','--border-strong':'#3d5a8f','--control-border':'#2f3f5c',
};
const FOREGROUND=new Set(['color','fill','stroke','caret-color','accent-color','text-decoration-color','-webkit-text-fill-color']);

// sRGB <-> OKLab (Björn Ottosson's reference matrices).
const toLinear=c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4,fromLinear=c=>c<=0.0031308?12.92*c:1.055*c**(1/2.4)-0.055;
function toOklab([r,g,b]){[r,g,b]=[r,g,b].map(v=>toLinear(v/255));
  const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b),m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b),s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  return [0.2104542553*l+0.793617785*m-0.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.808675766*s];}
function fromOklab([L,a,b]){const l=(L+0.3963377774*a+0.2158037573*b)**3,m=(L-0.1055613458*a-0.0638541728*b)**3,s=(L-0.0894841775*a-1.291485548*b)**3;
  return [4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.707614701*s].map(v=>Math.round(Math.min(1,Math.max(0,fromLinear(v)))*255));}
const hex=rgb=>'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');

function mapColour(rgb,foreground){
  const [L,a,b]=toOklab(rgb);
  if(foreground)return L>=0.62?rgb:fromOklab([Math.min(0.96,0.98-L*0.55),a,b]);
  return L<=0.6?rgb:fromOklab([0.18+(1-L)*0.5,a*0.7,b*0.7]);
}
function mapValue(value,foreground){
  if(foreground&&/var\(--blue\)/.test(value))return value.replace(/var\(--blue\)/g,'var(--link)');
  // White surfaces become the dark paper token so cards keep the palette's navy instead of a neutral grey.
  if(!foreground&&/^(#fff|#ffffff|white)$/i.test(value.trim()))return 'var(--paper)';
  let changed=false;
  const out=value
    .replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi,(_,h)=>{changed=true;const full=h.length===3?h.split('').map(c=>c+c).join(''):h;return hex(mapColour([0,2,4].map(i=>parseInt(full.slice(i,i+2),16)),foreground));})
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi,(_,r,g,b,alpha)=>{changed=true;const m=mapColour([+r,+g,+b],foreground);return alpha===undefined?hex(m):`rgba(${m.join(',')},${alpha})`;})
    .replace(/\b(white|black)\b/gi,w=>{changed=true;return hex(mapColour(w.toLowerCase()==='white'?[255,255,255]:[0,0,0],foreground));});
  return changed?out:null;
}

const winners=new Map();
let order=0;
for(const file of SOURCES){
  const root=postcss.parse(await readFile(file,'utf8'),{from:file});
  root.walkRules(rule=>{
    if(rule.parent.type==='atrule'&&!/^media$/i.test(rule.parent.name))return;
    if(rule.selectors.some(s=>s.trim()===':root'||s.includes('@keyframes')))return;
    const media=rule.parent.type==='atrule'?rule.parent.params:'';
    rule.walkDecls(decl=>{if(decl.prop.startsWith('--'))return; // component-scoped custom properties are deliberate values, not surfaces to remap
      for(const selector of rule.selectors)winners.set(`${media}\u0000${selector.trim()}\u0000${decl.prop}`,{media,selector:selector.trim(),prop:decl.prop,value:decl.value,important:decl.important,order:order++});});
  });
}
const byMedia=new Map();
for(const w of [...winners.values()].sort((a,b)=>a.order-b.order)){
  const mapped=mapValue(w.value,FOREGROUND.has(w.prop));
  if(mapped===null)continue;
  // :where() keeps each override at its original selector's specificity, so light-theme precedence (.button vs .button.primary) still holds.
  const selector=/^(html|:root)\b/.test(w.selector)?w.selector.replace(/^(html|:root)/,ROOT):`:where(${ROOT}) ${w.selector}`;
  const list=byMedia.get(w.media)??[];list.push(`${selector}{${w.prop}:${mapped}${w.important?' !important':''}}`);byMedia.set(w.media,list);
}
const tokens=`${ROOT}{color-scheme:dark;${Object.entries(DARK_TOKENS).map(([k,v])=>`${k}:${v}`).join(';')}}`;
const body=[...byMedia.entries()].map(([media,rules])=>media?`@media ${media}{\n${rules.join('\n')}\n}`:rules.join('\n')).join('\n');
await writeFile(OUT,`/* Generated by scripts/generate-dark-theme.mjs from globals.css and theme.css. Do not edit; edit the sources or the generator. */\n${tokens}\n${body}\n`);
console.log(`Wrote ${OUT}: ${[...byMedia.values()].reduce((n,r)=>n+r.length,0)} colour overrides.`);
