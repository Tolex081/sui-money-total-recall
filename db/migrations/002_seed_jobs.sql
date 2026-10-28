BEGIN;
CREATE TABLE operator_seed_jobs (
 namespace text NOT NULL, event_id text NOT NULL, envelope jsonb NOT NULL,
 state text NOT NULL CHECK(state IN('queued','submitting','accepted','saved','recall_confirmed','failed','submission_outcome_unknown')),
 remote_job_id text, blob_id text, recalled_at timestamptz, expires_at timestamptz, end_epoch bigint,
 error_code text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(namespace,event_id)
);
INSERT INTO schema_migrations(version) VALUES(2);
COMMIT;
