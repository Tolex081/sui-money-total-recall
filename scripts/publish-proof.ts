import {readFile} from 'node:fs/promises';
import {database} from '../src/adapters/postgres/client';
const db=database();
try{
  // This is a public-data cache, never a wallet import or a memory write.
  const reference=JSON.parse(await readFile('evidence/public/transfer-reference.json','utf8'));
  if(!reference.publicReference||!reference.unrelatedToUserWallet||!reference.incomingNotSentByReference||!reference.paginationVerified)throw Error('Reference verification incomplete.');
  const types=new Set(reference.transactions.map((m:{coinType:string})=>m.coinType));
  const both=reference.transactions.some((m:{delta:string;status:string})=>m.status==='success'&&BigInt(m.delta)>0n)&&reference.transactions.some((m:{delta:string;status:string})=>m.status==='success'&&BigInt(m.delta)<0n);
  if(types.size!==1||!both)throw Error('Reference proof must include both native-USDC directions.');
  await db.query("INSERT INTO public_proof(id,payload,checked_at) VALUES('reference',$1,now()) ON CONFLICT(id) DO UPDATE SET payload=$1,checked_at=now()",[{...reference,bothDirectionsVerified:both}]);
  console.log('Public reference evidence cached; no personal ledger or external memory modified.');
}finally{await db.end();}
