import {mkdir,writeFile} from 'node:fs/promises';
import {demoComparison} from '../src/adapters/mock/demo';
await mkdir('evidence/public',{recursive:true});
await writeFile('evidence/public/learning-replay.json',JSON.stringify({capturedAt:new Date().toISOString(),...demoComparison()},(_,v)=>typeof v==='bigint'?v.toString():v,2));
console.log('Captured a labelled synthetic learning replay. No real personal sessions are claimed.');
