/**
 * Нормализация российского ИНН: только цифры, длина 10 (ЮЛ) или 12 (ФЛ/ИП).
 * В SQL используйте тот же смысл: regexp_replace(COALESCE(inn, ''), '[^0-9]', '', 'g')
 */
export function normalizeInn(inn) {
  if (inn == null) return null;
  const digits = String(inn).replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 12) return null;
  return digits;
}

/** Фрагмент Postgres: нормализованный ИНН из колонки licenses.inn */
export const LICENSE_INN_NORMALIZED_EXPR = `regexp_replace(COALESCE(inn, ''), '[^0-9]', '', 'g')`;

export const DUPLICATE_INN_MESSAGE =
  'Организация с этим ИНН уже зарегистрирована. Дубликаты лицензий по одному ИНН не допускаются.';
