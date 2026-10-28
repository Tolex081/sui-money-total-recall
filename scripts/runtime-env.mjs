import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
const config=parseEnv(await readFile('.env.local','utf8'));
const target=process.argv[2];
if(!['production','preview'].includes(target))throw Error('Specify production or preview.');
// CLI executable is invoked without shell interpolation; secret values travel only through stdin.
const cli=process.env.VERCEL_CLI_ENTRY;
if(!cli)throw Error('Set VERCEL_CLI_ENTRY to the installed Vercel CLI JS entry.');
const scope='oyewole-toluwalase-oluwaseuns-projects';
const values={APP_MODE:'live',APP_ORIGIN:config.APP_ORIGIN,TATUM_API_KEY:config.TATUM_API_KEY,TATUM_GRPC_TARGET:config.TATUM_GRPC_TARGET,MEMWAL_PRIVATE_KEY:config.MEMWAL_PRIVATE_KEY,MEMWAL_ACCOUNT_ID:config.MEMWAL_ACCOUNT_ID,MEMWAL_SERVER_URL:config.MEMWAL_SERVER_URL,MEMWAL_NAMESPACE_DEMO:config.MEMWAL_NAMESPACE_DEMO,MEMWAL_NAMESPACE_SECRET:config.MEMWAL_NAMESPACE_SECRET,SESSION_SECRET:config.SESSION_SECRET,INTERNAL_ADMIN_SECRET:config.INTERNAL_ADMIN_SECRET,REFERENCE_SUI_ADDRESS:config.REFERENCE_SUI_ADDRESS,MEMWAL_FREE_WRITES_CONFIRMED:config.MEMWAL_FREE_WRITES_CONFIRMED,PERSONAL_ACCESS_ENABLED:'false'};
for(const [key,value] of Object.entries(values)){
  if(!value)continue;
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,'env','add',key,target,'--force','--scope',scope],{stdio:['pipe','ignore','ignore'],windowsHide:true});child.stdin.end(value);child.on('exit',code=>code===0?resolve():reject(Error('Environment setup failed for '+key+'; inspect CLI access without printing values.')));});
  console.log('Configured '+key+' for '+target);
}
