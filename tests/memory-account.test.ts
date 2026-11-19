import { it, expect, beforeEach } from 'vitest';
import { sealSecret, openSecret, ownershipConfig } from '@/application/memory-account';
import { memoryWritesPaused } from '@/adapters/memwal/memory';

beforeEach(() => {
  process.env.MEMWAL_DELEGATE_ENCRYPTION_SECRET = 'test-only-secret-that-is-long-enough-123';
  delete process.env.MEMWAL_WRITES_PAUSED; delete process.env.MEMWAL_FREE_WRITES_CONFIRMED;
});

it('delegate keys are encrypted at rest and only open with the same secret', () => {
  const sealed = sealSecret('a1b2c3-delegate-private-key');
  expect(sealed).not.toContain('delegate');
  expect(openSecret(sealed)).toBe('a1b2c3-delegate-private-key');
  expect(sealSecret('same')).not.toBe(sealSecret('same')); // fresh IV each time
  process.env.MEMWAL_DELEGATE_ENCRYPTION_SECRET = 'a-different-secret-that-is-long-enough-456';
  expect(() => openSecret(sealed)).toThrow();
});

it('own accounts stay off until package, registry and encryption secret are all set', () => {
  delete process.env.MEMWAL_PACKAGE_ID; delete process.env.MEMWAL_REGISTRY_ID;
  expect(ownershipConfig().enabled).toBe(false);
  process.env.MEMWAL_PACKAGE_ID = '0x1'; process.env.MEMWAL_REGISTRY_ID = '0x2';
  expect(ownershipConfig().enabled).toBe(true);
  process.env.MEMWAL_DELEGATE_ENCRYPTION_SECRET = 'short';
  expect(ownershipConfig().enabled).toBe(false);
});

it('Walrus writes are on by default and paused only on purpose', () => {
  expect(memoryWritesPaused()).toBe(false);
  process.env.MEMWAL_FREE_WRITES_CONFIRMED = 'true'; expect(memoryWritesPaused()).toBe(false);
  process.env.MEMWAL_WRITES_PAUSED = 'true'; expect(memoryWritesPaused()).toBe(true);
  delete process.env.MEMWAL_WRITES_PAUSED; process.env.MEMWAL_FREE_WRITES_CONFIRMED = 'false'; expect(memoryWritesPaused()).toBe(true);
});
