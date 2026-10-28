import { transaction } from '@/adapters/postgres/client';
import { AppError } from './security';
export async function consumeLimits(buckets: { key: string; max: number; seconds: number }[]) {
  await transaction(async db => {
    for (const bucket of [...buckets].sort((a,b) => a.key.localeCompare(b.key))) {
      const result = await db.query<{count:number}>(`INSERT INTO rate_limit_buckets(key,window_start,count) VALUES($1,now(),1)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limit_buckets.window_start < now()-($2 * interval '1 second') THEN 1 ELSE rate_limit_buckets.count+1 END,
      window_start=CASE WHEN rate_limit_buckets.window_start < now()-($2 * interval '1 second') THEN now() ELSE rate_limit_buckets.window_start END RETURNING count`,[bucket.key,bucket.seconds]);
      if (result.rows[0].count > bucket.max) throw new AppError('RATE_LIMITED',429,'Please wait before trying again.',true);
    }
  });
}
export async function chainReadBudget(profileId: string) {
  await consumeLimits([{key:'tatum:global:second',max:2,seconds:1},{key:'tatum:global:day',max:1200,seconds:86400},{key:`tatum:${profileId}:minute`,max:40,seconds:60}]);
}
