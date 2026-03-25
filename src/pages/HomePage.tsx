import { HeroBannerSection } from '@/components/sections';
import { ContactsMenu } from '@/components/ui/ContactsMenu';
import { HeaderSection } from '@/components/sections/HeaderSection';

export default function HomePage(): JSX.Element {
  return (
    <div className="flex flex-col w-full max-w-full min-w-0 items-start relative min-h-screen overflow-x-hidden glass-bg pt-[90px]">
      <HeaderSection />
      <main className="relative z-10 flex flex-col min-w-0 items-stretch self-stretch w-full flex-[0_0_auto] overflow-x-hidden">
        <HeroBannerSection />
      </main>
      <ContactsMenu />
    </div>
  );
}
