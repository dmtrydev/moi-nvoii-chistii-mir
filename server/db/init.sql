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

