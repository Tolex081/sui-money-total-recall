'use client';
import { createDAppKit,DAppKitProvider,useCurrentAccount,useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { useEffect,useRef,useState } from 'react';
import { api,setCurrentWalletAddress } from './http';
// This client is used for wallet selection/signing only. Any accidental read fails locally:
// the app has no browser RPC proxy and no public-node fallback.
const noChainFetch:typeof fetch=async()=>{throw new Error('Application chain reads must use the authenticated Tatum server adapter.');};
const dAppKit=createDAppKit({networks:['mainnet'],createClient:()=>new SuiGrpcClient({network:'mainnet',baseUrl:'https://sui-mainnet-grpc.gateway.tatum.io',fetch:noChainFetch}),slushWalletConfig:null,enableBurnerWallet:false,autoConnect:false});
function WalletControl({onSession}:{onSession:()=>void}) {
  const account=useCurrentAccount(),kit=useDAppKit(dAppKit),previous=useRef<string|null>(null);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    const current=account?.address??null;
    setCurrentWalletAddress(current);
    if(previous.current&&previous.current!==current){window.dispatchEvent(new Event('sm-wallet-changed'));void api('/auth/logout',{}).catch(()=>{});}
    previous.current=current;
  },[account?.address,onSession]);
  async function signIn(){if(!account)return;setBusy(true);setMessage('');try{const challenge=await api<{id:string;message:string}>('/auth/challenge',{wallet:account.address});const signed=await kit.signPersonalMessage({message:new TextEncoder().encode(challenge.message)});await api('/auth/verify',{id:challenge.id,wallet:account.address,signature:signed.signature});setMessage('Wallet identity verified. Financial access remains subject to release checks.');onSession();}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
  return <div className="wallet-control"><ConnectButton />{account&&<button className="button primary" onClick={signIn} disabled={busy}>{busy?'Verifying signature…':'Sign in with wallet'}</button>}{message&&<p role="alert" className="form-error">{message}</p>}<p className="micro">A personal-message signature. No gas or payment approval.</p></div>;
}
export default function Wallet({onSession}:{onSession:()=>void}){return <DAppKitProvider dAppKit={dAppKit}><WalletControl onSession={onSession}/></DAppKitProvider>;}
