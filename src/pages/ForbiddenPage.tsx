import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';

export default function ForbiddenPage(): JSX.Element {
  return (
    <SitePublicPageShell>
      <SiteFrameWithTopNav>
        <div className="flex min-h-[min(480px,70dvh)] flex-col items-center justify-center px-4 py-16 text-ink">
          <h1 className="typo-h1 mb-2">403</h1>
          <p className="mb-4 max-w-md text-center text-sm text-ink-muted">
            Недостаточно прав для просмотра этой страницы.
          </p>
          <p className="max-w-md text-center text-xs text-ink-muted">
            Вернитесь на главную через логотип в шапке.
          </p>
        </div>
      </SiteFrameWithTopNav>
    </SitePublicPageShell>
  );
}
