export type MapMarkerVariant = 'eco' | 'storage' | 'tech';

/** Нормализация для сравнения подписей видов обращения */
function norm(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .trim();
}

/**
 * Цвет маркера на /map:
 * - tech — аренда/продажа технологий с ГЭЭ
 * - storage — хранение и захоронение, объекты ГРОРРО
 * - eco — остальные виды обращения (сбор, транспортирование, …)
 */
export function getMapMarkerVariant(activityTypes: string[] | undefined): MapMarkerVariant {
  const list = Array.isArray(activityTypes) ? activityTypes.map((x) => norm(String(x))) : [];
  const joined = norm(list.join(' | '));

  for (const t of list) {
    const hasGee =
      t.includes('геэ') || t.includes('гээ') || t.includes('гэк') || t.includes(' гэ ');
    const techLease =
      hasGee ||
      (t.includes('аренда') && t.includes('технолог')) ||
      (t.includes('продаж') && t.includes('технолог')) ||
      (t.includes('прошедш') && hasGee);
    if (techLease) return 'tech';
  }

  for (const t of list) {
    const storage =
      t.includes('грорро') ||
      t.includes('хранение и захорон') ||
      (t.includes('хранение') && t.includes('захорон')) ||
      t.includes('объект грорро');
    if (storage) return 'storage';
  }

  if (
    joined.includes('геэ') &&
    (joined.includes('технолог') || joined.includes('аренда') || joined.includes('продаж'))
  ) {
    return 'tech';
  }
  if (joined.includes('хранение') && joined.includes('захорон')) {
    return 'storage';
  }

  return 'eco';
}
