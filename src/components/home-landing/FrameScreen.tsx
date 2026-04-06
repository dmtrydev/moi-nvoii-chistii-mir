import type { ReactNode } from 'react';

/** Холст главной: ограничение по ширине как у макета, без горизонтального скролла; высота — от контента + минимум под экран. */
export function FrameScreen({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[1920px] min-h-[min(100dvh,1080px)] pb-8 sm:pb-10 md:pb-12">
      {children}
    </div>
  );
}
