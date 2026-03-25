-- Eco Auth + Dashboard migration
-- Safe re-runnable: adds missing columns/tables without deleting data.
-- Run in existing database without dropping anything.

BEGIN;

-- licenses: reward + rejection_note for moderation outcomes
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS reward INTEGER NOT NULL DEFAULT 100;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS rejection_note TEXT;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS file_original_name TEXT;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS file_stored_name TEXT;

-- moderation metadata used by admin approve/reject
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS moderated_by INTEGER;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS moderated_comment TEXT;

-- owner used for user dashboard + coin awarding
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;

-- status used for moderation flow
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- users: eco_coins balance
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS eco_coins INTEGER NOT NULL DEFAULT 0;

-- If the column existed previously but had NULLs (defensive), normalize them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'eco_coins'
  ) THEN
    UPDATE users
    SET eco_coins = 0
    WHERE eco_coins IS NULL;
  END IF;
END
$$;

-- transactions: history of eco-coin начислений (reward per approved license)
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

COMMIT;

