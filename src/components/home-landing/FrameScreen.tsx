import type { ReactNode } from 'react';

type FrameScreenLayout = 'page' | 'header';

/** Холст главной: ограничение по ширине как у макета, без горизонтального скролла; высота — от контента + минимум под экран. */
export function FrameScreen({
  children,
  layout = 'page',
}: {
  children: ReactNode;
  /** `header` — только горизонтальная сетка 1920px (например шапка на /map без min-height лендинга). */
  layout?: FrameScreenLayout;
}): JSX.Element {
  const shell =
    layout === 'header'
      ? 'relative mx-auto w-full min-w-0 max-w-[1920px]'
      : 'relative mx-auto w-full min-w-0 max-w-[1920px] min-h-[min(100dvh,1080px)] pb-8 sm:pb-10 md:pb-12';
  return <div className={shell}>{children}</div>;
}
