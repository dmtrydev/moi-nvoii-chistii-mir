import type { ReactNode } from 'react';

/** Внешняя оболочка как у `HomePage`: фон и `main` для контента с шапкой лендинга. */
export function SitePublicPageShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="relative flex min-h-screen w-full max-w-full min-w-0 flex-col items-start overflow-x-hidden glass-bg page-enter">
      <main className="relative z-10 flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch self-stretch overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
