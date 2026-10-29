import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {sourceFingerprint} from './source-fingerprint.mjs';
const npmCli=process.env.npm_execpath;
if(!npmCli)throw Error('Run through npm run verify:quality.');
const report={checkedAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform},baseCommit:execFileSync('git',['-c','safe.directory='+process.cwd(),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256:await sourceFingerprint(),checks:[],sourceUnchanged:false,complete:false};
for(const name of ['lint','typecheck','test','test:db','test:e2e','build','test:e2e:personal','scan:secrets','verify:evidence']){
  const startedAt=new Date().toISOString();console.log('Checking '+name);
  const code=await new Promise(resolve=>{const p=spawn(process.execPath,[npmCli,'run',name],{stdio:'inherit',windowsHide:true});p.on('exit',c=>resolve(c??1));});
  report.checks.push({command:'npm run '+name,startedAt,finishedAt:new Date().toISOString(),exitCode:code,passed:code===0});
  if(code!==0)break;
}
report.sourceUnchanged=report.sourceSha256===await sourceFingerprint();
report.complete=report.sourceUnchanged&&report.checks.length===9&&report.checks.every(c=>c.passed);
await mkdir('evidence/public',{recursive:true});await writeFile('evidence/public/quality.json',JSON.stringify(report,null,2));
if(!report.complete)process.exitCode=1;
