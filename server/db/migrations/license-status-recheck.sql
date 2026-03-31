BEGIN;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    INNER JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'licenses'
      AND c.conname = 'licenses_status_check'
  ) THEN
    ALTER TABLE licenses DROP CONSTRAINT licenses_status_check;
  END IF;
END
$$;

ALTER TABLE licenses
  ADD CONSTRAINT licenses_status_check
  CHECK (status IN ('pending', 'recheck', 'approved', 'rejected'));

COMMIT;
