import { useEffect, useRef, useState } from 'react';

interface UseInViewOptions {
  /** Root margin (e.g. "0px 0px -80px 0px" to trigger when 80px from bottom of viewport) */
  rootMargin?: string;
  /** Threshold 0-1, fraction of element visible to trigger */
  threshold?: number;
  /** Trigger only once (default true) */
  once?: boolean;
}

/**
 * Returns ref and whether the element is in viewport.
 * Add ref to element and add class "is-visible" when isInView is true for scroll-triggered reveals.
 */
export function useInView(options: UseInViewOptions = {}): [React.RefObject<HTMLDivElement>, boolean] {
  const { rootMargin = '0px 0px -60px 0px', threshold = 0.1, once = true } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        } else if (!once) {
          setIsInView(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return [ref, isInView];
}
