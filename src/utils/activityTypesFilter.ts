/** Порядок пунктов «вид обращения» в фильтрах UI (без «Захоронение» в списке выбора). */
export const ACTIVITY_TYPE_FILTER_ORDER = [
  'Сбор',
  'Транспортирование',
  'Обработка',
  'Утилизация',
  'Обезвреживание',
  'Размещение',
] as const;

const ORDER_INDEX = new Map<string, number>(
  ACTIVITY_TYPE_FILTER_ORDER.map((label, i) => [label, i]),
);

/** Убираем «Иное», «Захоронение», сортируем известные по заданному порядку, остальное — по алфавиту. */
export function normalizeActivityTypesForFilter(raw: string[]): string[] {
  const cleaned = raw
    .map((x) => String(x).trim())
    .filter(
      (x) => x && x.toLowerCase() !== 'иное' && x !== 'Захоронение',
    );
  const ordered = ACTIVITY_TYPE_FILTER_ORDER.filter((a) => cleaned.includes(a));
  const extras = cleaned
    .filter((x) => !ORDER_INDEX.has(x))
    .sort((a, b) => a.localeCompare(b, 'ru'));
  return [...ordered, ...extras];
}
