BEGIN;
ALTER TABLE public_proof DROP CONSTRAINT public_proof_id_check;
ALTER TABLE public_proof ADD CONSTRAINT public_proof_id_check CHECK(id IN('integrations','seed','reference'));
INSERT INTO schema_migrations(version) VALUES(3);
COMMIT;
