BEGIN;
-- Bring your own memory account. By default a profile's memories live in Sui Money's operator Walrus Memory account,
-- separated by namespace. A user can instead create their own Walrus Memory account with their wallet and add a
-- delegate key that Sui Money generated for them. New memories are then written to the account the user owns; they
-- can remove Sui Money's key from it at any time and give other apps their own keys.
ALTER TABLE profiles
  ADD COLUMN memory_owner text NOT NULL DEFAULT 'operator' CHECK (memory_owner IN ('operator','pending','user')),
  ADD COLUMN memory_account_id text,
  ADD COLUMN memory_delegate_public text,
  -- AES-256-GCM ciphertext of the delegate private key (iv.tag.ciphertext, base64url). Never sent to a browser.
  ADD COLUMN memory_delegate_secret text,
  ADD COLUMN memory_owner_changed_at timestamptz;
-- Which account each memory was written to, so it is always read back and verified from that same account.
-- NULL means the operator account (every memory written before this migration).
ALTER TABLE memory_jobs ADD COLUMN account_id text;
INSERT INTO schema_migrations(version) VALUES(6);
COMMIT;
