import { database } from '@/adapters/postgres/client';
import { OPERATOR_MANAGED_CONSENT_VERSION, READ_ONLY_WALLET_CONSENT_VERSION } from '@/domain/consent';
import type { Profile } from './auth';

export async function acceptReadOnlyWalletConsent(profile: Profile) {
  const result = await database().query<{ consent_version: string }>(
    `UPDATE profiles
       SET consent_version=CASE WHEN consent_version=$2 THEN $2 ELSE $3 END
     WHERE id=$1
     RETURNING consent_version`,
    [profile.id, OPERATOR_MANAGED_CONSENT_VERSION, READ_ONLY_WALLET_CONSENT_VERSION],
  );
  if (!result.rows[0]) throw new Error('PROFILE_NOT_FOUND');
  return { accepted: true, consentVersion: result.rows[0].consent_version };
}

// Labels are Walrus memories, so they need the operator-managed memory terms on top of read access.
export async function acceptMemoryConsent(profile: Profile) {
  const result = await database().query<{ consent_version: string }>(
    'UPDATE profiles SET consent_version=$2 WHERE id=$1 RETURNING consent_version',
    [profile.id, OPERATOR_MANAGED_CONSENT_VERSION],
  );
  if (!result.rows[0]) throw new Error('PROFILE_NOT_FOUND');
  return { accepted: true, consentVersion: result.rows[0].consent_version };
}
