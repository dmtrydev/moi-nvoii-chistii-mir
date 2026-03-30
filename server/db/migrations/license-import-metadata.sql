-- Метаданные импорта из внешних реестров (например парсер Росприроднадзора).
-- Безопасно переисполняемо.

BEGIN;

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS import_source TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS import_external_ref TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS import_needs_review BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_licenses_import_source
  ON licenses (import_source)
  WHERE import_source IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_import_external_ref_active
  ON licenses (import_external_ref)
  WHERE import_external_ref IS NOT NULL AND deleted_at IS NULL;

COMMIT;
