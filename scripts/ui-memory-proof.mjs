import {readFile,writeFile} from 'node:fs/promises';
const file='src/components/dashboard.tsx';let source=await readFile(file,'utf8');
const anchor="  const base=demo?'/demo':'';";
if(!source.includes(anchor))throw Error('Missing UI insertion anchor');
source=source.replace(anchor,`  useEffect(()=>{if(!demo)return;let cancelled=false;api<{memories:AccountState['memories'];reason:string}>('/demo/memories').then(result=>{if(!cancelled)setState(current=>current?{...current,memories:result.memories,memoryStatus:result.reason}:current);}).catch(()=>{});return()=>{cancelled=true;};},[demo]);
${anchor}`);
const banner='Fictional finance data · Fixed date 28 October 2026 · Mainnet memory proof pending';
if(!source.includes(banner))throw Error('Missing demo banner anchor');
source=source.replace(banner,"Fictional finance data · Fixed date 28 October 2026 · {state?.memories.some(m=>m.state==='recall_confirmed')?'Mainnet recall evidence available':'Mainnet memory proof pending'}");
// Public demo displays real synthetic seed provenance, but every mutation remains disabled.
source=source.replace("disabled={busy||row.state!=='recall_confirmed'}","disabled={demo||busy||row.state!=='recall_confirmed'}");
await writeFile(file,source);
