BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE profiles (
 id uuid PRIMARY KEY, wallet text UNIQUE NOT NULL CHECK(wallet ~ '^0x[0-9a-f]{64}$'),
 namespace text UNIQUE NOT NULL, timezone text NOT NULL DEFAULT 'Africa/Lagos',
 consent_version text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_challenges (
 id uuid PRIMARY KEY, wallet text NOT NULL, nonce_hash text UNIQUE NOT NULL, origin text NOT NULL,
 message text NOT NULL, message_hash text NOT NULL, issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE INDEX challenge_expiry ON auth_challenges(expires_at);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, profile_id uuid NOT NULL REFERENCES profiles(id), csrf_hash text NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_profile ON sessions(profile_id);
CREATE TABLE balance_observations (
 id uuid PRIMARY KEY, profile_id uuid NOT NULL REFERENCES profiles(id), usdc numeric(78,0), sui numeric(78,0),
 checkpoint numeric(78,0), observed_at timestamptz NOT NULL, metadata_version text NOT NULL,
 source text NOT NULL CHECK(source='tatum'), error_code text,
 CHECK(usdc IS NULL OR usdc >= 0), CHECK(sui IS NULL OR sui >= 0), UNIQUE(profile_id,id)
);
CREATE INDEX balance_latest ON balance_observations(profile_id,observed_at DESC);
CREATE TABLE chain_movements (
 profile_id uuid NOT NULL REFERENCES profiles(id), id text NOT NULL, digest text NOT NULL,
 coin_type text NOT NULL, delta numeric(78,0) NOT NULL, checkpoint numeric(78,0) NOT NULL,
 event_time timestamptz NOT NULL, execution_status text NOT NULL CHECK(execution_status IN ('success','failed')),
 operation text NOT NULL CHECK(operation IN ('simple_transfer','complex')), counterparty text,
 facts jsonb NOT NULL, source text NOT NULL CHECK(source='tatum'), PRIMARY KEY(profile_id,id)
);
CREATE INDEX movements_time ON chain_movements(profile_id,event_time DESC,id);
CREATE TABLE sync_progress (
 profile_id uuid PRIMARY KEY REFERENCES profiles(id), filter_version integer NOT NULL, cursor text,
 from_checkpoint numeric(78,0), to_checkpoint numeric(78,0), scanned_checkpoint numeric(78,0),
 coverage jsonb NOT NULL, version integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE plans (
 profile_id uuid PRIMARY KEY REFERENCES profiles(id), end_date date, end_kind text NOT NULL CHECK(end_kind IN ('income','planning')),
 reserve numeric(78,0) NOT NULL CHECK(reserve >= 0), expected_income numeric(78,0) CHECK(expected_income >= 0),
 version integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE learned_events (
 profile_id uuid NOT NULL REFERENCES profiles(id), id text NOT NULL, logical_key text NOT NULL, revision integer NOT NULL CHECK(revision>0),
 envelope jsonb NOT NULL, activated_at timestamptz, available boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(profile_id,id), UNIQUE(profile_id,logical_key,revision)
);
CREATE TABLE memory_jobs (
 profile_id uuid NOT NULL, id uuid NOT NULL, event_id text NOT NULL, state text NOT NULL CHECK(state IN ('queued','submitting','accepted','saved','recall_confirmed','failed','submission_outcome_unknown')),
 logical_key text NOT NULL, remote_job_id text, blob_id text, attempts integer NOT NULL DEFAULT 0,
 error_code text, recalled_at timestamptz, expires_at timestamptz, end_epoch bigint,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(profile_id,id), UNIQUE(profile_id,event_id),
 FOREIGN KEY(profile_id,event_id) REFERENCES learned_events(profile_id,id)
);
CREATE UNIQUE INDEX pending_logical_lock ON memory_jobs(profile_id,logical_key) WHERE state IN ('queued','submitting','accepted','saved','submission_outcome_unknown');
CREATE TABLE payment_annotations (
 profile_id uuid NOT NULL, movement_id text NOT NULL, event_id text NOT NULL, revision integer NOT NULL,
 category text NOT NULL, note text NOT NULL, own_transfer boolean NOT NULL,
 PRIMARY KEY(profile_id,movement_id), FOREIGN KEY(profile_id,movement_id) REFERENCES chain_movements(profile_id,id),
 FOREIGN KEY(profile_id,event_id) REFERENCES learned_events(profile_id,id)
);
CREATE TABLE commitment_rules (
 profile_id uuid NOT NULL REFERENCES profiles(id), id text NOT NULL, definition jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1, event_id text, PRIMARY KEY(profile_id,id),
 FOREIGN KEY(profile_id,event_id) REFERENCES learned_events(profile_id,id)
);
CREATE TABLE commitment_occurrences (
 profile_id uuid NOT NULL, id text NOT NULL, rule_id text NOT NULL, scheduled_date date NOT NULL,
 amount numeric(78,0) NOT NULL CHECK(amount>=0), cancelled boolean NOT NULL DEFAULT false, definition jsonb NOT NULL,
 PRIMARY KEY(profile_id,id), UNIQUE(profile_id,rule_id,scheduled_date),
 FOREIGN KEY(profile_id,rule_id) REFERENCES commitment_rules(profile_id,id)
);
CREATE TABLE reimbursement_allocations (
 profile_id uuid NOT NULL, id uuid NOT NULL, source_id text NOT NULL, target_id text NOT NULL,
 amount numeric(78,0) NOT NULL CHECK(amount>0), state text NOT NULL CHECK(state IN ('pending','active','reversed')),
 event_id text, reverses_id uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(profile_id,id),
 FOREIGN KEY(profile_id,source_id) REFERENCES chain_movements(profile_id,id), FOREIGN KEY(profile_id,target_id) REFERENCES chain_movements(profile_id,id),
 FOREIGN KEY(profile_id,event_id) REFERENCES learned_events(profile_id,id), FOREIGN KEY(profile_id,reverses_id) REFERENCES reimbursement_allocations(profile_id,id)
);
CREATE TABLE commitment_allocations (
 profile_id uuid NOT NULL, id uuid NOT NULL, source_id text NOT NULL, target_id text NOT NULL,
 amount numeric(78,0) NOT NULL CHECK(amount>0), checkpoint numeric(78,0) NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','reversed')), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,id), FOREIGN KEY(profile_id,source_id) REFERENCES chain_movements(profile_id,id),
 FOREIGN KEY(profile_id,target_id) REFERENCES commitment_occurrences(profile_id,id)
);
CREATE TABLE learning_snapshots (
 profile_id uuid NOT NULL REFERENCES profiles(id), id uuid NOT NULL, inputs jsonb NOT NULL, outputs jsonb NOT NULL,
 event_ids jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(profile_id,id)
);
CREATE TABLE rate_limit_buckets (key text PRIMARY KEY, window_start timestamptz NOT NULL, count integer NOT NULL CHECK(count>=0));
CREATE TABLE public_proof (id text PRIMARY KEY CHECK(id IN ('integrations','seed')), payload jsonb NOT NULL, checked_at timestamptz NOT NULL);

CREATE FUNCTION immutable_chain_fact() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Chain facts are immutable'; END $$;
CREATE TRIGGER immutable_movements BEFORE UPDATE OR DELETE ON chain_movements FOR EACH ROW EXECUTE FUNCTION immutable_chain_fact();
CREATE FUNCTION immutable_event_envelope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.envelope IS DISTINCT FROM NEW.envelope OR OLD.id<>NEW.id OR OLD.profile_id<>NEW.profile_id OR OLD.revision<>NEW.revision OR OLD.logical_key<>NEW.logical_key THEN RAISE EXCEPTION 'Event envelope is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_envelope BEFORE UPDATE ON learned_events FOR EACH ROW EXECUTE FUNCTION immutable_event_envelope();

-- Lock parent rows in a stable order: protects capacity even across concurrent tabs/instances.
CREATE FUNCTION guard_reimbursement_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_delta numeric; target_delta numeric; allocated_source numeric; allocated_target numeric;
BEGIN
 IF NEW.state='reversed' THEN RETURN NEW; END IF;
 PERFORM id FROM chain_movements WHERE profile_id=NEW.profile_id AND id IN(NEW.source_id,NEW.target_id) ORDER BY id FOR UPDATE;
 SELECT delta INTO source_delta FROM chain_movements WHERE profile_id=NEW.profile_id AND id=NEW.source_id AND execution_status='success' AND operation='simple_transfer' AND coin_type='0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
 SELECT delta INTO target_delta FROM chain_movements WHERE profile_id=NEW.profile_id AND id=NEW.target_id AND execution_status='success' AND operation='simple_transfer' AND coin_type='0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
 IF source_delta IS NULL OR source_delta<=0 OR target_delta IS NULL OR target_delta>=0 OR EXISTS(SELECT 1 FROM payment_annotations WHERE profile_id=NEW.profile_id AND movement_id=NEW.target_id AND own_transfer) THEN RAISE EXCEPTION 'Ineligible reimbursement'; END IF;
 SELECT coalesce(sum(amount),0) INTO allocated_source FROM reimbursement_allocations WHERE profile_id=NEW.profile_id AND source_id=NEW.source_id AND state IN('active','pending') AND id<>NEW.id;
 SELECT coalesce(sum(amount),0) INTO allocated_target FROM reimbursement_allocations WHERE profile_id=NEW.profile_id AND target_id=NEW.target_id AND state IN('active','pending') AND id<>NEW.id;
 IF allocated_source+NEW.amount>source_delta OR allocated_target+NEW.amount>-target_delta THEN RAISE EXCEPTION 'Reimbursement capacity exceeded'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reimbursement_capacity BEFORE INSERT OR UPDATE ON reimbursement_allocations FOR EACH ROW EXECUTE FUNCTION guard_reimbursement_capacity();
CREATE FUNCTION guard_commitment_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment numeric; obligation numeric; source_used numeric; target_used numeric;
BEGIN
 IF NEW.state='reversed' THEN RETURN NEW; END IF;
 SELECT -delta INTO payment FROM chain_movements WHERE profile_id=NEW.profile_id AND id=NEW.source_id AND execution_status='success' AND operation='simple_transfer' AND checkpoint=NEW.checkpoint AND coin_type='0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC' FOR UPDATE;
 SELECT amount INTO obligation FROM commitment_occurrences WHERE profile_id=NEW.profile_id AND id=NEW.target_id AND NOT cancelled FOR UPDATE;
 IF payment IS NULL OR payment<=0 OR obligation IS NULL OR EXISTS(SELECT 1 FROM payment_annotations WHERE profile_id=NEW.profile_id AND movement_id=NEW.source_id AND own_transfer) THEN RAISE EXCEPTION 'Ineligible commitment payment'; END IF;
 SELECT coalesce(sum(amount),0) INTO source_used FROM commitment_allocations WHERE profile_id=NEW.profile_id AND source_id=NEW.source_id AND state='active' AND id<>NEW.id;
 SELECT coalesce(sum(amount),0) INTO target_used FROM commitment_allocations WHERE profile_id=NEW.profile_id AND target_id=NEW.target_id AND state='active' AND id<>NEW.id;
 IF source_used+NEW.amount>payment OR target_used+NEW.amount>obligation THEN RAISE EXCEPTION 'Commitment capacity exceeded'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commitment_capacity BEFORE INSERT OR UPDATE ON commitment_allocations FOR EACH ROW EXECUTE FUNCTION guard_commitment_capacity();
INSERT INTO schema_migrations(version) VALUES(1);
COMMIT;
