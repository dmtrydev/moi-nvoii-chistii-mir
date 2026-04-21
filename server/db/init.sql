CREATE TABLE IF NOT EXISTS licenses (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  inn TEXT,
  address TEXT,
  region TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  fkko_codes TEXT[] NOT NULL DEFAULT '{}',
  activity_types TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  reward INTEGER NOT NULL DEFAULT 100,
  owner_user_id INTEGER,
  moderated_by INTEGER,
  moderated_at TIMESTAMPTZ,
  moderated_comment TEXT,
  rejection_note TEXT,
  file_original_name TEXT,
  file_stored_name TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Миграция для существующих БД: добавить activity_types, если отсутствует
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS activity_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS reward INTEGER NOT NULL DEFAULT 100;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS rejection_note TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS file_original_name TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS file_stored_name TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS import_source TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS import_needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS import_registry_inactive BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS import_registry_status TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS import_registry_status_ru TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    INNER JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'licenses'
      AND c.conname = 'licenses_status_check'
  ) THEN
    ALTER TABLE licenses
      ADD CONSTRAINT licenses_status_check
      CHECK (status IN ('pending', 'recheck', 'approved', 'rejected'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_licenses_import_source
  ON licenses (import_source)
  WHERE import_source IS NOT NULL;

-- Площадки (адреса осуществления деятельности) в рамках одной лицензии.
-- Здесь хранится привязка: адрес -> виды работ -> коды ФККО.
-- Старые поля licenses.address/lat/lng/fkko_codes/activity_types сохраняем как совместимость/агрегат,
-- но новые данные пишем в license_sites.
CREATE TABLE IF NOT EXISTS license_sites (
  id BIGSERIAL PRIMARY KEY,
  license_id INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  site_label TEXT,
  address TEXT,
  region TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  fkko_codes TEXT[] NOT NULL DEFAULT '{}',
  activity_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_sites_license_id ON license_sites (license_id);
CREATE INDEX IF NOT EXISTS idx_license_sites_region ON license_sites (region);
CREATE INDEX IF NOT EXISTS idx_license_sites_fkko_codes_gin ON license_sites USING GIN (fkko_codes);
CREATE INDEX IF NOT EXISTS idx_license_sites_activity_types_gin ON license_sites USING GIN (activity_types);
CREATE INDEX IF NOT EXISTS idx_license_sites_lat_lng ON license_sites (lat, lng);

-- Бэкфилл: для существующих licenses создаём 1 площадку, если ещё нет ни одной.
-- Безопасно переисполняемо: вставка только при отсутствии site для license_id.
INSERT INTO license_sites (license_id, site_label, address, region, lat, lng, fkko_codes, activity_types)
SELECT
  l.id,
  'Основная площадка',
  l.address,
  l.region,
  l.lat,
  l.lng,
  COALESCE(l.fkko_codes, '{}'),
  COALESCE(l.activity_types, '{}')
FROM licenses l
WHERE NOT EXISTS (
  SELECT 1 FROM license_sites s WHERE s.license_id = l.id
);

-- Гранулярная привязка: ФККО-код → вид работы на конкретной площадке.
-- Позволяет фильтровать точно: «код X + вид Y» без ложных совпадений.
CREATE TABLE IF NOT EXISTS site_fkko_activities (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES license_sites(id) ON DELETE CASCADE,
  fkko_code TEXT NOT NULL,
  waste_name TEXT,
  hazard_class TEXT,
  activity_type TEXT NOT NULL,
  UNIQUE(site_id, fkko_code, activity_type)
);

CREATE INDEX IF NOT EXISTS idx_sfa_site_id ON site_fkko_activities(site_id);
CREATE INDEX IF NOT EXISTS idx_sfa_fkko_code ON site_fkko_activities(fkko_code);
CREATE INDEX IF NOT EXISTS idx_sfa_activity_type ON site_fkko_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_sfa_fkko_activity ON site_fkko_activities(fkko_code, activity_type);
-- idx_sfa_activity_site создаётся в фоне при старте приложения (CONCURRENTLY), см. server/index.js

-- Бэкфилл site_fkko_activities из старых данных license_sites:
-- для каждой пары (fkko_code, activity_type) на площадке создаём запись.
-- Важно: не сканируем площадки, у которых уже есть хотя бы одна строка в site_fkko_activities —
-- иначе при каждом рестарте app снова строится огромный LATERAL по всей таблице (I/O, минуты тишины в логах).
-- Частично заполненные площадки (редкий кейс) можно добить вручную или удалить их sfa и перезапустить бэкфилл.
INSERT INTO site_fkko_activities (site_id, fkko_code, activity_type)
SELECT s.id, f.code, a.activity
FROM license_sites s
CROSS JOIN LATERAL unnest(s.fkko_codes) AS f(code)
CROSS JOIN LATERAL unnest(s.activity_types) AS a(activity)
WHERE cardinality(s.fkko_codes) > 0
  AND cardinality(s.activity_types) > 0
  AND NOT EXISTS (SELECT 1 FROM site_fkko_activities sfa WHERE sfa.site_id = s.id)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_licenses_region ON licenses (region);
CREATE INDEX IF NOT EXISTS idx_licenses_inn ON licenses (inn);
CREATE INDEX IF NOT EXISTS idx_licenses_fkko_codes_gin ON licenses USING GIN (fkko_codes);
CREATE INDEX IF NOT EXISTS idx_licenses_activity_types_gin ON licenses USING GIN (activity_types);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses (status);
CREATE INDEX IF NOT EXISTS idx_licenses_deleted_at ON licenses (deleted_at);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'USER',
  eco_coins INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS eco_coins INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  attempts_used INTEGER NOT NULL DEFAULT 0,
  resend_count INTEGER NOT NULL DEFAULT 1,
  resend_window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON email_verification_codes (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_id INTEGER NOT NULL UNIQUE REFERENCES licenses(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'LICENSE_REWARD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  session_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  severity TEXT NOT NULL DEFAULT 'INFO',
  ip_address INET,
  user_agent TEXT,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

-- Система поддержки (чат пользователь <-> администраторы)
CREATE TABLE IF NOT EXISTS support_conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  subject TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON support_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_last_message_at ON support_conversations (last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL,
  body_text TEXT,
  attachment_path TEXT,
  attachment_original_name TEXT,
  attachment_mime TEXT,
  read_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (body_text IS NOT NULL OR attachment_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages (created_at ASC);

