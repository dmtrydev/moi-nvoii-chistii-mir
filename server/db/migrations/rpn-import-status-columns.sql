BEGIN;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS import_registry_status TEXT;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS import_registry_status_ru TEXT;

COMMIT;
