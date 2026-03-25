import type { AnchorHTMLAttributes } from 'react';

interface LogoProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  ariaLabel?: string;
  /** Белый цвет для прозрачного хедера над героем */
  light?: boolean;
}

export function Logo({ href, ariaLabel = 'Мой новый чистый мир — на главную', className, light, ...props }: LogoProps): JSX.Element {
  return (
    <a
      href={href ?? '#'}
      rel="noopener noreferrer"
      target="_blank"
      aria-label={ariaLabel}
      className={className}
      {...props}
    >
      <div className="flex flex-col min-h-[37px] items-center justify-center relative">
        <span
          className={`font-medium text-xl sm:text-2xl tracking-tight whitespace-nowrap ${
            light ? 'text-white' : 'text-slate-900'
          }`}
        >
          Мой новый чистый мир
        </span>
      </div>
    </a>
  );
}
