BEGIN;
-- A SUI budget beside the USDC plan, in SUI's own units: there is no price conversion between the two.
-- It shares the USDC plan's end date. Bills are simple schedules; paid dates are kept so a paid bill stops counting.
CREATE TABLE sui_budgets (
 profile_id uuid PRIMARY KEY REFERENCES profiles(id), reserve numeric(78,0) NOT NULL DEFAULT 0 CHECK(reserve>=0),
 version integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sui_bills (
 profile_id uuid NOT NULL REFERENCES profiles(id), id uuid NOT NULL, alias text NOT NULL, amount numeric(78,0) NOT NULL CHECK(amount>0),
 start_date date NOT NULL, frequency text NOT NULL CHECK(frequency IN ('once','weekly','monthly')), paid_dates jsonb NOT NULL DEFAULT '[]',
 removed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(profile_id,id)
);
-- Sessions end after an hour without activity, like a wallet that locks itself.
ALTER TABLE sessions ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
INSERT INTO schema_migrations(version) VALUES(5);
COMMIT;
