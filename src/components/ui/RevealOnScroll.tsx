import { useInView } from '@/hooks/useInView';
import type { ReactNode } from 'react';

type RevealVariant = 'reveal' | 'reveal-scale' | 'reveal-blur' | 'reveal-hero';

interface RevealOnScrollProps {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: string;
  className?: string;
  /** Если false — класс is-visible не ставится, пока не станет true (например, после вводной анимации страницы). */
  revealAllowed?: boolean;
}

export function RevealOnScroll({
  children,
  variant = 'reveal',
  delay,
  className = '',
  revealAllowed = true,
}: RevealOnScrollProps): JSX.Element {
  const [ref, isInView] = useInView({ rootMargin: '0px 0px -80px 0px', threshold: 0.08 });
  const revealed = isInView && revealAllowed;

  return (
    <div
      ref={ref}
      className={`${variant} ${revealed ? 'is-visible' : ''} ${className}`}
      style={delay ? { ['--reveal-delay' as string]: delay } : undefined}
    >
      {children}
    </div>
  );
}
