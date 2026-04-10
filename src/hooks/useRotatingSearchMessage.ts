import { useEffect, useState } from 'react';

/** Фразы по очереди, чтобы при долгом ответе API было видно, что процесс живой */
export const SEARCH_STATUS_MESSAGES = [
  'Идёт поиск…',
  'Сверяем данные с реестром лицензий…',
  'Проверяем площадки по выбранным критериям…',
  'Сопоставляем виды обращения и регион…',
  'Собираем результаты…',
] as const;

export function useRotatingSearchMessage(active: boolean, intervalMs = 3200): string {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) {
      setIdx(0);
      return;
    }
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % SEARCH_STATUS_MESSAGES.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return SEARCH_STATUS_MESSAGES[idx] ?? SEARCH_STATUS_MESSAGES[0];
}
