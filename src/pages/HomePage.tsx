import { HomeLanding, SitePublicPageShell } from '@/components/home-landing';

export default function HomePage(): JSX.Element {
  return (
    <SitePublicPageShell>
      <HomeLanding />
    </SitePublicPageShell>
  );
}
