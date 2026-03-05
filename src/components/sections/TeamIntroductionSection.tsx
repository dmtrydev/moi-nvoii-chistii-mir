import { Component1_2 } from '@/components/icons';
import { RevealOnScroll } from '@/components/ui/RevealOnScroll';
import { TEAM_FEATURES } from '@/constants/team';

export function TeamIntroductionSection(): JSX.Element {
  return (
    <section className="flex items-center justify-center relative self-stretch w-full flex-[0_0_auto] bg-[#f2f8f5]">
      <RevealOnScroll variant="reveal-blur" className="flex flex-col max-w-[1410px] w-full items-center justify-center gap-[60px] pt-10 pb-[60px] px-0 relative bg-[#4f7363] rounded-[20px]">
        <div className="flex items-start gap-10 relative self-stretch w-full flex-[0_0_auto]">
          <div className="flex-col w-[705px] items-start gap-[60px] pl-[50px] pr-0 py-0 flex relative">
            <div className="flex self-stretch w-full flex-[0_0_auto] flex-col items-start relative">
              <h2 className="relative self-stretch mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-white text-[70px] tracking-[-0.70px] leading-[84px]">
                Join us in building a <br />
                greener future.
              </h2>
            </div>

            <a
              className="inline-flex flex-col px-[30px] py-5 flex-[0_0_auto] bg-white rounded-[60px] items-center justify-center relative"
              href="https://greenx-template.framer.website/contact-us"
              rel="noopener noreferrer"
              target="_blank"
              aria-label="Let's Save The World - Contact us"
            >
              <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
                <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                  <span className="relative flex items-center w-fit mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-[#151e1b] text-[22px] tracking-[-0.22px] leading-[24.2px] whitespace-nowrap">
                    Let&apos;s Save The World
                  </span>
                </div>
              </div>

              <div className="rounded-[60px] border border-solid border-white absolute w-full h-full top-0 left-0" />
            </a>
          </div>

          <img
            className="relative self-stretch flex-[0_0_auto]"
            alt="Team collaboration illustration"
            src="/div-framer-zy0nz3-container-align-stretch.svg"
          />
        </div>

        <div className="flex items-start justify-between px-[50px] py-0 relative self-stretch w-full flex-[0_0_auto]">
          {TEAM_FEATURES.map((feature) => (
            <div
              key={feature.id}
              className="inline-flex items-center justify-center gap-0.5 relative flex-[0_0_auto]"
            >
              <div className="flex flex-col w-6 items-start justify-center relative aspect-[1]">
                <Component1_2 className="!relative !self-stretch !w-full !h-6 !object-cover" />
              </div>

              <div className="inline-flex flex-[0_0_auto] flex-col items-start relative">
                <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                  <p className="relative flex items-center w-fit mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-white text-xl tracking-[-0.20px] leading-6 whitespace-nowrap">
                    {feature.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </RevealOnScroll>
    </section>
  );
}
