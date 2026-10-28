import {readFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {sourceFingerprint} from './source-fingerprint.mjs';
const docs=['REQUIREMENTS','VERIFICATION_REPORT','OPEN_ITEMS','BUILD_LOG','EVIDENCE','INTEGRATION_EVIDENCE','ARCHITECTURE','FINANCIAL_RULES','API','SECURITY','OPERATIONS','LEARNING_LOG','BLOG','DEMO_SCRIPT','SOCIAL_POST','SUBMISSION_CHECKLIST'];
const issues:string[]=[];
for(const name of docs)try{await access('docs/'+name+'.md');}catch{issues.push('Missing docs/'+name+'.md');}
const matrix=await readFile('docs/EVIDENCE.md','utf8');
for(const [prefix,count] of [['H',11],['P',14],['G',13],['F',24]] as const)for(let n=1;n<=count;n++){const id=prefix+String(n).padStart(2,'0');if(!matrix.includes('| '+id+' |'))issues.push('Missing evidence row '+id);}
if(process.argv[2]==='submission'){
  let release:Record<string,unknown>={};try{release=JSON.parse(await readFile('evidence/release.json','utf8'));}catch{issues.push('Missing release evidence registry');}
  for(const key of ['appUrl','repositoryUrl','articleUrl','videoUrl','submissionReceipt'])if(typeof release[key]!=='string'||!release[key])issues.push('Missing '+key);
  const requirements=(release.requirements??{}) as Record<string,{status:string;artifact?:string}>;
  for(const [prefix,count] of [['H',10],['P',14],['G',13],['F',24]] as const)for(let n=1;n<=count;n++){const id=prefix+String(n).padStart(2,'0');const requirement=requirements[id];if(requirement?.status!=='passed'||!requirement?.artifact)issues.push('Unproven mandatory requirement '+id);else try{await access(requirement.artifact);}catch{issues.push('Missing acceptance artifact '+id);}}
  try{const seed=JSON.parse(await readFile('evidence/public/seed-mainnet.json','utf8'));if(seed.confirmedActiveStoredCount<15)issues.push('Fewer than 15 confirmed active stored product memories');if(!seed.retentionVerified)issues.push('Retention through judging/results is not established');}catch{issues.push('Missing Mainnet seed manifest');}
  try{const quality=JSON.parse(await readFile('evidence/public/quality.json','utf8'));if(!quality.complete)issues.push('Quality checks incomplete');if(quality.sourceSha256!==await sourceFingerprint())issues.push('Quality evidence does not match current source');}catch{issues.push('Missing quality evidence');}
  if((release.criticalOpenItems as unknown[]|undefined)?.length||release.criticalOpenItems===undefined)issues.push('Critical open items unresolved');
  // Evidence-only commits may follow the tested implementation commit. Requiring
  // a committed registry to contain its own commit hash would be a circular gate.
  try{if(typeof release.commit!=='string'||!/^\w{40}$/.test(release.commit))throw Error('No source commit');const git=['-c','safe.directory='+process.cwd()];execFileSync('git',[...git,'merge-base','--is-ancestor',release.commit,'HEAD']);execFileSync('git',[...git,'diff','--exit-code',release.commit,'--','src','tests','db','scripts','.github','package.json','package-lock.json','next.config.ts','tsconfig.json','playwright.config.ts','vercel.json'],{stdio:'ignore'});const untracked=execFileSync('git',[...git,'ls-files','--others','--exclude-standard','--','src','tests','db','scripts','.github'],{encoding:'utf8'});if(untracked.trim())issues.push('Uncommitted source files remain');}catch{issues.push('Release source commit does not match current implementation');}
}
if(issues.length){issues.forEach(i=>console.error(i));process.exitCode=1;}else console.log(process.argv[2]==='submission'?'Submission evidence audit passed.':'Requirement traceability documents exist. This does not certify live/deployed acceptance.');
