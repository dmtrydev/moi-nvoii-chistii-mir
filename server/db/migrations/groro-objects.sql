BEGIN;

CREATE TABLE IF NOT EXISTS groro_objects (
  id BIGSERIAL PRIMARY KEY,
  source_object_id TEXT,
  groro_number TEXT NOT NULL,
  object_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  status_ru TEXT,
  region TEXT,
  operator_name TEXT,
  operator_inn TEXT,
  operator_address TEXT,
  linked_license_id INTEGER REFERENCES licenses(id) ON DELETE SET NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE groro_objects ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE groro_objects ADD COLUMN IF NOT EXISTS reward INTEGER NOT NULL DEFAULT 100;
ALTER TABLE groro_objects ADD COLUMN IF NOT EXISTS moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE groro_objects ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
ALTER TABLE groro_objects ADD COLUMN IF NOT EXISTS moderated_comment TEXT;
ALTER TABLE groro_objects ADD COLUMN IF NOT EXISTS rejection_note TEXT;
ALTER TABLE groro_objects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE groro_objects ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    INNER JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'groro_objects'
      AND c.conname = 'groro_objects_moderation_status_check'
  ) THEN
    ALTER TABLE groro_objects
      ADD CONSTRAINT groro_objects_moderation_status_check
      CHECK (moderation_status IN ('pending', 'recheck', 'approved', 'rejected'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_groro_objects_number ON groro_objects (groro_number);
CREATE INDEX IF NOT EXISTS idx_groro_objects_operator_inn ON groro_objects (operator_inn);
CREATE INDEX IF NOT EXISTS idx_groro_objects_region ON groro_objects (region);
CREATE INDEX IF NOT EXISTS idx_groro_objects_status ON groro_objects (status);
CREATE INDEX IF NOT EXISTS idx_groro_objects_moderation_status ON groro_objects (moderation_status);
CREATE INDEX IF NOT EXISTS idx_groro_objects_deleted_at ON groro_objects (deleted_at);
CREATE INDEX IF NOT EXISTS idx_groro_objects_source_id ON groro_objects (source_object_id);

CREATE TABLE IF NOT EXISTS groro_wastes (
  id BIGSERIAL PRIMARY KEY,
  groro_object_id BIGINT NOT NULL REFERENCES groro_objects(id) ON DELETE CASCADE,
  fkko_code TEXT NOT NULL,
  waste_name TEXT,
  hazard_class TEXT,
  activity_type TEXT NOT NULL DEFAULT 'Размещение',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(groro_object_id, fkko_code, activity_type, waste_name)
);

CREATE INDEX IF NOT EXISTS idx_groro_wastes_object_id ON groro_wastes (groro_object_id);
CREATE INDEX IF NOT EXISTS idx_groro_wastes_fkko_code ON groro_wastes (fkko_code);
CREATE INDEX IF NOT EXISTS idx_groro_wastes_activity ON groro_wastes (activity_type);

COMMIT;
