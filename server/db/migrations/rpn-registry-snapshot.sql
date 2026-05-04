-- Снимок реестра лицензий Росприроднадзора (wasteLicensing).
--
-- Хранится отдельно от licenses, чтобы:
--   * cron-синхронизация никогда не затирала ручные правки админа;
--   * можно было хранить компактный raw_json как страховку для будущих полей реестра;
--   * легко делать LEFT JOIN по нормализованному ИНН (см. innUtils.LICENSE_INN_NORMALIZED_EXPR).
--
-- pps_deadline_at — расчётный срок ближайшего периодического подтверждения соответствия
-- лицензионным требованиям (ППС), вычисляется в server/ppsDeadline.js при импорте.
-- Хранится здесь, а не как GENERATED COLUMN, чтобы при изменении закона можно было
-- пересчитать одной миграцией без правки expression.

BEGIN;

CREATE TABLE IF NOT EXISTS rpn_registry_snapshot (
  inn_norm TEXT PRIMARY KEY,
  license_number TEXT,
  date_issued TIMESTAMPTZ,
  registry_status TEXT NOT NULL DEFAULT 'unknown',
  registry_status_ru TEXT,
  registry_inactive BOOLEAN NOT NULL DEFAULT FALSE,
  unit_short_name TEXT,
  registry_modified_at TIMESTAMPTZ,
  pps_deadline_at TIMESTAMPTZ,
  raw_json JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rpn_registry_snapshot_inn_format
    CHECK (length(inn_norm) IN (10, 12) AND inn_norm ~ '^[0-9]+$')
);

CREATE INDEX IF NOT EXISTS idx_rpn_snap_pps_deadline_at
  ON rpn_registry_snapshot (pps_deadline_at);

CREATE INDEX IF NOT EXISTS idx_rpn_snap_synced_at
  ON rpn_registry_snapshot (synced_at);

CREATE INDEX IF NOT EXISTS idx_rpn_snap_registry_status
  ON rpn_registry_snapshot (registry_status);

COMMIT;
