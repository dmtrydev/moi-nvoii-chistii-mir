import { useEffect, useMemo, useState, type ReactNode } from 'react';

/** Как у CTA на главной: filterCtaDurationClass 600ms, для полноэкранного reveal — дольше. */
const REVEAL_MS = 1200;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function PageLoadReveal({ children }: { children: ReactNode }): JSX.Element {
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const [revealed, setRevealed] = useState(prefersReducedMotion);
  const [overlayGone, setOverlayGone] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setRevealed(true));
    });
    return () => cancelAnimationFrame(id);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || overlayGone) return;
    const t = window.setTimeout(() => setOverlayGone(true), REVEAL_MS + 400);
    return () => window.clearTimeout(t);
  }, [prefersReducedMotion, overlayGone]);

  if (prefersReducedMotion) {
    return <div className="min-h-[100dvh] min-h-screen">{children}</div>;
  }

  const transition = `opacity ${REVEAL_MS}ms ${EASE}`;

  return (
    <div className="relative min-h-[100dvh] min-h-screen">
      <div
        className="min-h-[100dvh] min-h-screen"
        style={{
          opacity: revealed ? 1 : 0,
          transition,
        }}
      >
        {children}
      </div>
      {!overlayGone && (
        <div
          aria-hidden
          className="fixed inset-0 z-[99999] bg-white"
          style={{
            opacity: revealed ? 0 : 1,
            pointerEvents: revealed ? 'none' : 'auto',
            transition,
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName === 'opacity' && revealed) {
              setOverlayGone(true);
            }
          }}
        />
      )}
    </div>
  );
}
