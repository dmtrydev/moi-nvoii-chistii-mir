import type { CSSProperties, ReactNode } from 'react';
import { FrameScreen } from '@/components/home-landing/FrameScreen';
import { TopNavigationSection } from '@/components/home-landing/TopNavigationSection';

export type SiteFrameStacking = 'landing' | 'map';

/**
 * Та же разметка вокруг `TopNavigationSection`, что на главной: колонка z-[10] + `FrameScreen` + слот z-[50].
 * Для `/map` — `stacking="map"` (z-40), `frameLayout="header"` без min-height фрейма.
 */
export function SiteFrameWithTopNav({
  children,
  navSlotStyle,
  frameLayout = 'page',
  stacking = 'landing',
}: {
  children?: ReactNode;
  navSlotStyle?: CSSProperties;
  frameLayout?: 'page' | 'header';
  stacking?: SiteFrameStacking;
}): JSX.Element {
  const outer =
    stacking === 'map'
      ? 'relative z-40 w-full max-w-full min-w-0'
      : 'relative z-[10] w-full max-w-full min-w-0';
  return (
    <div className={outer}>
      <FrameScreen layout={frameLayout}>
        <div className="relative z-[50]" style={navSlotStyle}>
          <TopNavigationSection />
        </div>
        {children}
      </FrameScreen>
    </div>
  );
}
