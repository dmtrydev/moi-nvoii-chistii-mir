-- Один активный нормализованный ИНН (10–12 цифр) на организацию. Снимает гонку двух POST /api/licenses.
-- Если в таблице уже есть дубли, создание индекса завершится ошибкой — сначала слейте дубли в админке.
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_active_inn_normalized
ON licenses ((regexp_replace(COALESCE(inn, ''), '[^0-9]', '', 'g')))
WHERE deleted_at IS NULL
  AND length(regexp_replace(COALESCE(inn, ''), '[^0-9]', '', 'g')) IN (10, 12);
