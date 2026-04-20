import type { JSX } from 'react';

/** Совпадает с лимитом списка на карте и в блоке результатов на главной. */
export const SEARCH_RESULTS_PAGE_SIZE = 20;

type SearchResultsPaginationProps = {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Переключатель страниц для длинного списка предприятий (клиентская пагинация).
 * Не рендерится, если записей не больше одной страницы.
 */
export function SearchResultsPagination({
  total,
  page,
  pageCount,
  pageSize,
  onPrev,
  onNext,
}: SearchResultsPaginationProps): JSX.Element | null {
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-solid border-white/50 pt-2.5">
      <p className="font-nunito text-xs font-semibold text-[#5e6567]">
        Показано {from}–{to} из {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 0}
          onClick={onPrev}
          aria-label="Предыдущая страница результатов"
          className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-xl border border-black/[0.08] bg-[#ffffffb3] px-3 font-nunito text-sm font-semibold text-[#2b3335] shadow-sm transition-[opacity,background-color] hover:bg-white disabled:pointer-events-none disabled:opacity-40"
        >
          Назад
        </button>
        <span className="min-w-[3.5rem] text-center font-nunito text-xs font-semibold tabular-nums text-[#5e6567]">
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={onNext}
          aria-label="Следующая страница результатов"
          className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-xl border border-black/[0.08] bg-[#ffffffb3] px-3 font-nunito text-sm font-semibold text-[#2b3335] shadow-sm transition-[opacity,background-color] hover:bg-white disabled:pointer-events-none disabled:opacity-40"
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
