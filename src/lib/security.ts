import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { required } from './config';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export function namespaceFor(profileId: string) { return 'sm-' + createHmac('sha256', required('MEMWAL_NAMESPACE_SECRET')).update(profileId).digest('hex').slice(0,40); }
export function destinationId(profileId: string, address: string) { return 'dest_' + hash(profileId + ':' + address).slice(0,32); }
export function equalSecret(a: string, b: string) { const left = Buffer.from(hash(a)), right = Buffer.from(hash(b)); return timingSafeEqual(left,right); }
export class AppError extends Error { constructor(readonly code: string, readonly status: number, message: string, readonly retryable = false) { super(message); } }
export function assertSameOrigin(request: Request) {
  const configured = new URL(required('APP_ORIGIN')).origin;
  if (request.headers.get('origin') !== configured || new URL(request.url).origin !== configured || request.headers.get('sec-fetch-site') === 'cross-site') throw new AppError('ORIGIN_REJECTED',403,'Use this application’s own page to make changes.');
}
