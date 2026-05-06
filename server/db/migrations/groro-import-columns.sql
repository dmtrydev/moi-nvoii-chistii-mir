BEGIN;

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS groro_number TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS groro_status TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS groro_status_ru TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS groro_object_name TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS groro_operator_name TEXT;

CREATE INDEX IF NOT EXISTS idx_licenses_groro_number
  ON licenses (groro_number)
  WHERE groro_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_licenses_groro_number_source
  ON licenses (groro_number, import_source)
  WHERE import_source = 'groro_parser' AND groro_number IS NOT NULL AND deleted_at IS NULL;

COMMIT;
