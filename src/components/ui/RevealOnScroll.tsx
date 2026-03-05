import { useInView } from '@/hooks/useInView';
import type { ReactNode } from 'react';

type RevealVariant = 'reveal' | 'reveal-scale' | 'reveal-blur' | 'reveal-hero';

interface RevealOnScrollProps {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: string;
  className?: string;
}

export function RevealOnScroll({
  children,
  variant = 'reveal',
  delay,
  className = '',
}: RevealOnScrollProps): JSX.Element {
  const [ref, isInView] = useInView({ rootMargin: '0px 0px -80px 0px', threshold: 0.08 });

  return (
    <div
      ref={ref}
      className={`${variant} ${isInView ? 'is-visible' : ''} ${className}`}
      style={delay ? { ['--reveal-delay' as string]: delay } : undefined}
    >
      {children}
    </div>
  );
}
