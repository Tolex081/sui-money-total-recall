import { credentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { GrpcTypes, SuiGrpcClient } from '@mysten/sui/grpc';
import { isValidSuiAddress, normalizeSuiAddress, normalizeStructTag } from '@mysten/sui/utils';
import { normalize } from '@/domain/normalize';
import { integer, SUI_TYPE, USDC_TYPE } from '@/domain/money';
import type { ChainPort, HistoryRequest, ServiceObservation } from '@/ports/chain';
import type { Balance, Movement } from '@/domain/types';
import { required } from '@/lib/config';
import { createHash } from 'node:crypto';

const MASK = { paths: ['digest','checkpoint','timestamp','transaction','effects.status','effects.gas_used','balance_changes'] };
export function canonicalAddress(input: string) {
  if (!isValidSuiAddress(input)) throw new Error('Invalid Sui address.');
  return normalizeSuiAddress(input);
}
function timestamp(value: { seconds: bigint; nanos: number } | undefined) {
  if (!value) throw new Error('TATUM_SHAPE:timestamp');
  return new Date(Number(value.seconds) * 1000 + Math.floor(value.nanos / 1_000_000)).toISOString();
}
export function extractTransaction(tx: GrpcTypes.ExecutedTransaction, owner: string): Movement[] {
  if (!tx.digest || tx.checkpoint === undefined || tx.effects?.status?.success === undefined) throw new Error('TATUM_SHAPE:transaction');
  const data = tx.transaction?.kind?.data;
  const commands = data?.oneofKind === 'programmableTransaction' ? data.programmableTransaction.commands : [];
  const changes = tx.balanceChanges.map(c => {
    if (!c.address || !c.coinType || c.amount === undefined) throw new Error('TATUM_SHAPE:balanceChange');
    return { owner: canonicalAddress(c.address), coinType: normalizeStructTag(c.coinType), amount: integer(c.amount).toString() };
  });
  const usdcOwners = [...new Set(changes.filter(c => c.coinType === USDC_TYPE && integer(c.amount) !== 0n).map(c => c.owner))];
  const allowedStablecoinCalls = new Set(['balance::send_funds','balance::redeem_funds','coin::send_funds','coin::into_balance','funds_accumulator::withdrawal_split']);
  const supportedCommand = (c: GrpcTypes.Command) => {
    if(['transferObjects','splitCoins','mergeCoins'].includes(c.command.oneofKind ?? ''))return true;
    if(c.command.oneofKind!=='moveCall')return false;
    const call=c.command.moveCall;
    return !!call.package && normalizeSuiAddress(call.package)===normalizeSuiAddress('0x2') && allowedStablecoinCalls.has(call.module+'::'+call.function) && call.typeArguments.length===1 && normalizeStructTag(call.typeArguments[0])===USDC_TYPE;
  };
  const transfersValue=commands.some(c=>c.command.oneofKind==='transferObjects'||(c.command.oneofKind==='moveCall'&&c.command.moveCall.function==='send_funds'));
  const usdcConserved=changes.filter(c=>c.coinType===USDC_TYPE).reduce((n,c)=>n+integer(c.amount),0n)===0n;
  const simple = commands.length > 0 && commands.every(supportedCommand) && transfersValue && usdcOwners.length === 2 && usdcConserved && !changes.some(c => c.coinType !== SUI_TYPE && c.coinType !== USDC_TYPE);
  const gas = tx.effects.gasUsed;
  const cost = gas ? (gas.computationCost ?? 0n) + (gas.storageCost ?? 0n) - (gas.storageRebate ?? 0n) : 0n;
  return normalize({ digest: tx.digest, checkpoint: tx.checkpoint.toString(), timestamp: timestamp(tx.timestamp), success: tx.effects.status.success, simple, changes, counterparty: simple ? usdcOwners.find(a => a !== owner) ?? null : null, gasOwner: tx.transaction?.gasPayment?.owner ? canonicalAddress(tx.transaction.gasPayment.owner) : null, gasCost: cost.toString() }, owner).map(m => ({...m,id:'mov_'+createHash('sha256').update(m.id).digest('hex').slice(0,40)}));
}
export class TatumChain implements ChainPort {
  readonly client: SuiGrpcClient;
  readonly transport: GrpcTransport;
  constructor(private beforeRead: () => Promise<void> = async () => {}) {
    const host = process.env.TATUM_GRPC_TARGET ?? 'sui-mainnet-grpc.gateway.tatum.io:443';
    if (host !== 'sui-mainnet-grpc.gateway.tatum.io:443') throw new Error('Only the verified Tatum Sui Mainnet target is supported.');
    this.transport = new GrpcTransport({ host, channelCredentials: credentials.createSsl(), meta: { 'x-api-key': required('TATUM_API_KEY') }, timeout: 12000 });
    this.client = new SuiGrpcClient({ network: 'mainnet', transport: this.transport });
  }
  close() { this.transport.close(); }
  async serviceStatus(): Promise<ServiceObservation> {
    await this.beforeRead();
    const { response } = await this.client.ledgerService.getServiceInfo({});
    if (response.chain !== 'mainnet' || !response.chainId || response.checkpointHeight === undefined) throw new Error('TATUM_NETWORK: Mainnet service identity not established.');
    return { network: 'mainnet', chainId: response.chainId, checkpoint: response.checkpointHeight.toString(), observedAt: new Date().toISOString(), lowestCheckpoint: response.lowestAvailableCheckpoint?.toString() ?? null, lowestTransactionCheckpoint: response.lowestAvailableCheckpoint?.toString() ?? null };
  }
  async coinMetadata(coinType: string) {
    if (coinType !== USDC_TYPE && coinType !== SUI_TYPE) throw new Error('Unsupported coin.');
    await this.beforeRead();
    const { response } = await this.client.stateService.getCoinInfo({ coinType });
    if (!response.coinType || normalizeStructTag(response.coinType) !== coinType || response.metadata?.decimals !== (coinType === USDC_TYPE ? 6 : 9)) throw new Error('TATUM_METADATA: token identity or precision differs.');
    return { coinType, decimals: response.metadata.decimals, symbol: response.metadata.symbol ?? '' };
  }
  async balances(address: string): Promise<Balance> {
    const owner = canonicalAddress(address);
    await this.serviceStatus();
    await this.coinMetadata(USDC_TYPE); await this.coinMetadata(SUI_TYPE);
    const values: string[] = [];
    for (const coinType of [USDC_TYPE, SUI_TYPE]) {
      await this.beforeRead();
      const call = this.client.stateService.getBalance({ owner, coinType });
      const { response } = await call;
      if (!response.balance?.coinType || normalizeStructTag(response.balance.coinType) !== coinType || response.balance.balance === undefined) throw new Error('TATUM_SHAPE: Missing balance is unknown, never zero.');
      values.push(response.balance.balance.toString());
    }
    // GetBalance's installed response has no snapshot checkpoint. A separate service read is not evidence of snapshot consistency.
    return { usdc: values[0], sui: values[1], checkpoint: null, observedAt: new Date().toISOString(), source: 'tatum', stale: false };
  }
  async transaction(digest: string, owner: string) {
    await this.beforeRead();
    const { response } = await this.client.ledgerService.getTransaction({ digest, readMask: MASK });
    if (!response.transaction) throw new Error('TATUM_NOT_FOUND');
    return extractTransaction(response.transaction, canonicalAddress(owner));
  }
  async checkpointTime(checkpoint: string) {
    await this.beforeRead();
    const { response } = await this.client.ledgerService.getCheckpoint({ checkpointId: { oneofKind: 'sequenceNumber', sequenceNumber: BigInt(checkpoint) }, readMask: { paths: ['summary.timestamp','summary.sequence_number'] } });
    if (!response.checkpoint?.summary?.timestamp) throw new Error('TATUM_SHAPE:checkpoint');
    return timestamp(response.checkpoint.summary.timestamp);
  }
  async historyPage(input: HistoryRequest) {
    const address = canonicalAddress(input.address);
    if (integer(input.fromCheckpoint) < 0n || integer(input.toCheckpoint) <= integer(input.fromCheckpoint)) throw new Error('Invalid bounded history range.');
    await this.beforeRead();
    const stream = this.client.ledgerService.listTransactions({ startCheckpoint: BigInt(input.fromCheckpoint), endCheckpoint: BigInt(input.toCheckpoint), readMask: MASK, filter: { terms: [{ literals: [{ negated: false, predicate: { oneofKind: 'affectedAddress', affectedAddress: { address } } }] }] }, options: { limit: 30, ordering: GrpcTypes.Ordering.DESCENDING, before: input.cursor ? Buffer.from(input.cursor, 'base64url') : undefined } });
    const movements: Movement[] = [];
    let cursor: string | null = input.cursor ?? null, scanned: string | null = null;
    let end = GrpcTypes.QueryEndReason.UNKNOWN, count = 0;
    for await (const frame of stream.responses) {
      if (frame.transaction) { movements.push(...extractTransaction(frame.transaction, address)); count++; }
      if (frame.watermark?.cursor) cursor = Buffer.from(frame.watermark.cursor).toString('base64url');
      if (frame.watermark?.checkpoint !== undefined) scanned = frame.watermark.checkpoint.toString();
      if (frame.end?.reason !== undefined) end = frame.end.reason;
    }
    await stream.status;
    const complete = end === GrpcTypes.QueryEndReason.CHECKPOINT_BOUND;
    const reason = GrpcTypes.QueryEndReason[end] ?? 'NO_QUERY_END';
    return { movements, continuation: complete ? null : cursor, complete, reason, transactionCount: count, coverage: { state: complete ? 'complete' as const : 'partial' as const, from: null, to: null, reason, cursor: complete ? null : cursor, scannedCheckpoint: scanned } };
  }
}
