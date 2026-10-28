import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
const config=parseEnv(await readFile('.env.local','utf8'));
const cli=process.env.VERCEL_CLI_ENTRY;
if(!cli||!config.INTERNAL_ADMIN_SECRET)throw Error('Private local configuration required.');
const origin=process.env.DEPLOYMENT_ORIGIN??'https://sui-money.vercel.app';
if(new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('Use a production HTTPS origin.');
// Private header travels through stdin, never the process argument list or logs.
const output=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[cli,'curl',origin+'/api/internal/spike','--scope','oyewole-toluwalase-oluwaseuns-projects','--','--silent','--show-error','--config','-'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let body='';child.stdout.on('data',b=>{body+=b});child.stderr.on('data',()=>{});
  child.stdin.end('request = "POST"\nheader = "x-internal-admin: '+config.INTERNAL_ADMIN_SECRET+'"\n');
  child.on('exit',code=>code===0?resolve(body):reject(Error('Authenticated runtime probe failed.')));
});
const result=JSON.parse(output);
if(result.database?.state!=='write_read_passed'||result.tatum?.state!=='passed'||!result.tatum.bothDirectionsVerified||!result.walrus?.syntheticBlobIds?.length)throw Error('Runtime integration checks did not all pass: '+JSON.stringify(result));
await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/deployed-runtime.json',JSON.stringify({origin,...result},null,2));
console.log(JSON.stringify({origin,runtime:result.runtime,tatum:result.tatum.state,walrus:result.walrus.state,database:result.database.state}));
