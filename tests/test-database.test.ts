import { it, expect } from 'vitest';
import { testDatabaseUrl } from '../scripts/test-database';

const neon = 'postgresql://user:pw@ep-example-123.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const neonPooled = 'postgresql://user:pw@ep-example-123-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const ci = 'postgres://suimoney:test-password@localhost:5432/suimoney_test';

it('requires TEST_DATABASE_URL and never falls back to DATABASE_URL', () => {
  expect(() => testDatabaseUrl({ DATABASE_URL: ci })).toThrow(/never fall back/);
});
it('accepts a local test database, including CI where DATABASE_URL is the same throwaway server', () => {
  expect(testDatabaseUrl({ TEST_DATABASE_URL: ci, DATABASE_URL: ci })).toBe(ci);
});
it('refuses the production database, through the direct or the pooled endpoint', () => {
  expect(() => testDatabaseUrl({ TEST_DATABASE_URL: neon, DATABASE_URL: neonPooled, TEST_DATABASE_ALLOW_REMOTE: 'true' })).toThrow(/same database as DATABASE_URL/);
  expect(() => testDatabaseUrl({ TEST_DATABASE_URL: neon, PRODUCTION_DATABASE_URL: neon, TEST_DATABASE_ALLOW_REMOTE: 'true' })).toThrow(/PRODUCTION_DATABASE_URL/);
});
it('refuses a remote database unless it is explicitly marked as a dedicated test database', () => {
  expect(() => testDatabaseUrl({ TEST_DATABASE_URL: neon })).toThrow(/remote database/);
  const separate = 'postgresql://user:pw@ep-other-999.c-7.eu-central-1.aws.neon.tech/testdb';
  expect(testDatabaseUrl({ TEST_DATABASE_URL: separate, DATABASE_URL: neonPooled, TEST_DATABASE_ALLOW_REMOTE: 'true' })).toBe(separate);
});
it('refuses inside a production deployment and rejects malformed URLs', () => {
  expect(() => testDatabaseUrl({ TEST_DATABASE_URL: ci, VERCEL_ENV: 'production' })).toThrow(/production deployment/);
  expect(() => testDatabaseUrl({ TEST_DATABASE_URL: 'not a url' })).toThrow(/not a valid/);
});
