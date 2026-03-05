import { HeroBannerSection } from '@/components/sections';
import { ContactsMenu } from '@/components/ui/ContactsMenu';

export default function HomePage(): JSX.Element {
  return (
    <div className="flex flex-col w-full max-w-full min-w-0 items-start relative bg-[#1e1e1e] overflow-x-hidden">
      <main className="flex flex-col min-w-0 items-stretch relative self-stretch w-full flex-[0_0_auto] overflow-x-hidden">
        <HeroBannerSection />
      </main>
      <ContactsMenu />
    </div>
  );
}
