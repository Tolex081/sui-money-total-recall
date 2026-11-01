import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { TatumChain, canonicalAddress } from '../src/adapters/tatum/chain';
import { amount, SUI_TYPE, USDC_TYPE } from '../src/domain/money';

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const suppliedAddress = arg('--address');
if (!suppliedAddress) throw new Error('Usage: npm run verify:personal-tatum -- --address <public-sui-address>');
const address = canonicalAddress(suppliedAddress);
const addressHash = createHash('sha256').update(address).digest('hex');
let reads = 0;
const chain = new TatumChain(async () => {
  reads++;
  await new Promise(resolve => setTimeout(resolve, 550));
});

try {
  const service = await chain.serviceStatus();
  if (service.network !== 'mainnet' || !service.chainId) throw new Error('MAINNET_IDENTITY_CHECK_FAILED');

  const usdcMetadata = await chain.coinMetadata(USDC_TYPE);
  const suiMetadata = await chain.coinMetadata(SUI_TYPE);
  if (usdcMetadata.coinType !== USDC_TYPE || usdcMetadata.decimals !== 6) throw new Error('NATIVE_USDC_METADATA_CHECK_FAILED');
  if (suiMetadata.coinType !== SUI_TYPE || suiMetadata.decimals !== 9) throw new Error('SUI_METADATA_CHECK_FAILED');

  const balance = await chain.balances(address);
  if (balance.source !== 'tatum' || balance.checkpoint !== null) throw new Error('UNEXPECTED_BALANCE_PROVENANCE');

  const checkedAt = new Date().toISOString();
  const privateEvidence = `evidence/private/tatum-personal-${addressHash.slice(0, 12)}.json`;
  const evidence = {
    checkedAt,
    provider: 'Tatum Sui Mainnet gRPC',
    endpoint: 'sui-mainnet-grpc.gateway.tatum.io:443',
    address,
    addressHash,
    network: service.network,
    chainId: service.chainId,
    separatelyObservedServiceCheckpoint: service.checkpoint,
    serviceObservedAt: service.observedAt,
    metadata: [usdcMetadata, suiMetadata],
    balance: {
      usdcBaseUnits: balance.usdc,
      suiBaseUnits: balance.sui,
      source: balance.source,
      observedAt: balance.observedAt,
      checkpoint: balance.checkpoint,
    },
    limitation: 'The balance response has no snapshot checkpoint. The separately observed service checkpoint is not asserted as the balance checkpoint.',
    providerReadsStarted: reads,
    chainWrites: 0,
    walrusWrites: 0,
  };

  await mkdir('evidence/private', { recursive: true });
  await writeFile(privateEvidence, JSON.stringify(evidence, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({
    result: 'passed',
    provider: evidence.provider,
    network: service.network,
    chainId: service.chainId,
    addressStart: address.slice(0, 8),
    addressEnd: address.slice(-6),
    exactNativeUsdcTypeVerified: usdcMetadata.coinType === USDC_TYPE,
    usdcDecimals: usdcMetadata.decimals,
    usdcRead: amount(balance.usdc, 6, 6),
    exactSuiTypeVerified: suiMetadata.coinType === SUI_TYPE,
    suiDecimals: suiMetadata.decimals,
    suiRead: amount(balance.sui, 9, 9),
    balanceObservedAt: balance.observedAt,
    balanceCheckpoint: balance.checkpoint,
    privateEvidence,
    chainWrites: 0,
    walrusWrites: 0,
  }, null, 2));
} catch (error) {
  const candidate = error as { code?: unknown; message?: unknown };
  const safeCode = typeof candidate.message === 'string' && candidate.message.startsWith('CONFIG_MISSING:')
    ? candidate.message
    : typeof candidate.code === 'string' ? candidate.code : 'TATUM_READ_FAILED';
  console.error(`Personal Tatum verification failed (${safeCode}). No API key or provider response was logged.`);
  process.exitCode = 1;
} finally {
  chain.close();
}
