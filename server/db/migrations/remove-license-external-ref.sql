BEGIN;

DROP INDEX IF EXISTS idx_licenses_import_external_ref_active;

ALTER TABLE licenses
  DROP COLUMN IF EXISTS import_external_ref;

COMMIT;
