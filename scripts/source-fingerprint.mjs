import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function sourceFingerprint(){
  const files=[];
  async function collect(path){for(const f of await readdir(path,{withFileTypes:true})){const p=path+'/'+f.name;if(f.isDirectory())await collect(p);else files.push(p);}}
  for(const dir of ['src','tests','db','scripts','.github'])await collect(dir);
  files.push('package.json','package-lock.json','next.config.ts','tsconfig.json','playwright.config.ts','vercel.json');
  const hash=createHash('sha256');for(const f of files.sort()){hash.update(f+'\0');hash.update((await readFile(f,'utf8')).replaceAll('\r\n','\n'));}
  return hash.digest('hex');
}
