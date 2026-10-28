import { execFileSync } from 'node:child_process';
import { readFile,readdir,stat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import path from 'node:path';
const files=execFileSync('git',['-c','safe.directory='+process.cwd(),'ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
async function walk(directory:string):Promise<string[]>{try{const list=await readdir(directory,{withFileTypes:true});return (await Promise.all(list.map(e=>e.isDirectory()?walk(path.join(directory,e.name)):Promise.resolve([path.join(directory,e.name)])))).flat();}catch{return [];}}
files.push(...await walk('.next/static'));
let config:Record<string,string|undefined>={};try{config=parseEnv(await readFile('.env.local','utf8'));}catch{}
const keys=['TATUM_API_KEY','MEMWAL_PRIVATE_KEY','MEMWAL_NAMESPACE_SECRET','SESSION_SECRET','INTERNAL_ADMIN_SECRET','DATABASE_URL','TEST_DATABASE_URL'];
const issues:string[]=[];
for(const file of [...new Set(files)]){
  if((await stat(file)).size>8_000_000)continue;
  const content=await readFile(file,'utf8');
  for(const key of keys){const value=config[key];if(value&&value.length>=12&&content.includes(value))issues.push(file+': configured '+key+' value found');}
  if(/suiprivkey1[a-z0-9]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))issues.push(file+': private-key material found');
  if(/^\.env(?:\.|$)/.test(file)&&file!=='.env.example')issues.push(file+': environment file would be published');
}
if(issues.length){issues.forEach(i=>console.error(i));process.exitCode=1;}else console.log('Source and client-bundle secret scan passed. No secret values printed.');
