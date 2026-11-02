BEGIN;
-- USDC sends the user starts in Sui Money. The server builds the transaction through Tatum, the user's own
-- wallet signs it, and the server submits the signed bytes through Tatum. No key ever reaches the server.
CREATE TABLE transfers (
 profile_id uuid NOT NULL REFERENCES profiles(id), id uuid NOT NULL, recipient text NOT NULL,
 amount numeric(78,0) NOT NULL CHECK(amount>0), coin_type text NOT NULL, tx_bytes_hash text NOT NULL, tx_json text NOT NULL,
 state text NOT NULL CHECK(state IN ('prepared','submitted','confirmed','failed','expired')),
 digest text, error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,id)
);
CREATE INDEX transfers_recent ON transfers(profile_id,created_at DESC);
CREATE UNIQUE INDEX transfers_digest ON transfers(profile_id,digest) WHERE digest IS NOT NULL;
INSERT INTO schema_migrations(version) VALUES(4);
COMMIT;
