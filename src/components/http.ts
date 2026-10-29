export class ApiError extends Error{constructor(message:string,readonly code:string,readonly status:number,readonly retryable:boolean){super(message);}}
export async function api<T=Record<string,unknown>>(path:string,body?:unknown):Promise<T>{
  const csrf=typeof document==='undefined'?'':document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('sm_csrf='))?.slice(8)??'';
  const response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{...(currentWalletAddress?{'X-Wallet-Address':currentWalletAddress}:{}),...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new ApiError(data.error?.message??'The request could not be completed.',data.error?.code??'REQUEST_FAILED',response.status,data.error?.retryable===true);return data;
}
let currentWalletAddress:string|null=null;
export function setCurrentWalletAddress(address:string|null){currentWalletAddress=address;}
