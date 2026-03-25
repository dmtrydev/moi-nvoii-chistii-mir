import { HeroBannerSection } from '@/components/sections';

export default function HomePage(): JSX.Element {
  return (
    <div className="flex flex-col w-full max-w-full min-w-0 items-start relative min-h-screen overflow-x-hidden glass-bg">
      <main className="relative z-10 flex flex-col min-w-0 items-stretch self-stretch w-full flex-[0_0_auto] overflow-x-hidden">
        <HeroBannerSection />
      </main>
    </div>
  );
}
