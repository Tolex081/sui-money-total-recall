import {status} from '@grpc/grpc-js';
import {AppError} from '@/lib/security';

type RecoveryOptions={sleep?:(milliseconds:number)=>Promise<void>;random?:()=>number};
function codeOf(error:unknown){
  const code=typeof error==='object'&&error!==null&&'code' in error?error.code:undefined;
  return typeof code==='number'?status[code]:typeof code==='string'?code:undefined;
}

// This wrapper is exclusively for read-only Tatum RPCs. It must never wrap a
// memory submission, database mutation, signature or transaction execution.
export async function readTatum<T>(operation:()=>Promise<T>,beforeRead:()=>Promise<void>,options:RecoveryOptions={}):Promise<T>{
  const sleep=options.sleep??(milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)));
  const random=options.random??Math.random;
  for(let attempt=0;attempt<2;attempt++){
    // Budget/cooldown rejection does not consume a provider retry or retry itself.
    await beforeRead();
    try{return await operation();}catch(error){
      const code=codeOf(error),transient=['RESOURCE_EXHAUSTED','UNAVAILABLE','DEADLINE_EXCEEDED'].includes(code??'');
      if(transient&&attempt===0){await sleep(250+Math.floor(random()*250));continue;}
      if(code==='RESOURCE_EXHAUSTED')throw new AppError('TATUM_RATE_LIMITED',429,'The onchain data provider is busy. Your saved data is preserved; wait and try again.',true);
      if(code==='UNAVAILABLE'||code==='DEADLINE_EXCEEDED')throw new AppError('TATUM_UNAVAILABLE',503,'The onchain data provider is temporarily unavailable. Your saved data is preserved; try again shortly.',true);
      if(code==='UNAUTHENTICATED'||code==='PERMISSION_DENIED')throw new AppError('TATUM_AUTH_UNAVAILABLE',503,'The onchain data connection could not authenticate. It must be restored before refreshing data.');
      if(code==='NOT_FOUND'||code==='OUT_OF_RANGE')throw new AppError('TATUM_RECORD_UNAVAILABLE',409,'The requested onchain range or record is unavailable. History may be retention-limited; saved coverage has not advanced.');
      throw error;
    }
  }
  throw new Error('Unreachable Tatum read state');
}
