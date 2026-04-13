import { RevealOnScroll } from '@/components/ui/RevealOnScroll';

export function MissionStatementSection(): JSX.Element {
  return (
    <section
      className="items-center justify-center px-0 py-[130px] bg-[#F9FAFB] flex relative self-stretch w-full flex-[0_0_auto]"
      aria-labelledby="mission-heading"
    >
      <div className="max-w-[1510px] w-full justify-center px-[50px] py-0 flex items-center relative">
        <RevealOnScroll variant="reveal-scale" className="flex flex-col items-center justify-center gap-[60px] px-0 py-[100px] relative flex-1 grow">
          <div className="flex flex-col max-w-[780px] w-full items-center justify-center gap-5 relative flex-[0_0_auto]">
            <div className="flex self-stretch w-full flex-[0_0_auto] flex-col items-start relative">
              <div className="relative self-stretch w-full h-[420px]">
                <h1
                  id="mission-heading"
                  className="typo-h1 absolute top-0 left-[calc(50.00%_-_385px)] w-[789px] h-[168px] text-transparent text-center"
                >
                  <span className="text-[#151e1b] tracking-[-0.49px]">
                    Our mission is to create <br />
                    and provide{' '}
                  </span>

                  <span className="text-[#2e7d32] tracking-[-0.49px]">
                    innovative,
                  </span>
                </h1>

                <p className="absolute top-[168px] left-[calc(50.00%_-_369px)] w-[756px] h-[168px] text-transparent text-center font-manrope font-medium text-[70px] tracking-[-0.70px] leading-[84px]">
                  <span className="text-[#2e7d32] tracking-[-0.49px]">
                    eco-friendly solutions
                  </span>

                  <span className="text-[#151e1b] tracking-[-0.49px]">
                    {' '}
                    <br />
                    that promote recycling
                  </span>
                </p>

                <p className="absolute top-[336px] left-[calc(50.00%_-_272px)] w-[544px] h-[84px] flex items-center justify-center font-manrope font-medium text-[#151e1b] text-[70px] text-center tracking-[-0.70px] leading-[84px] whitespace-nowrap">
                  and green living.
                </p>
              </div>
            </div>

            <div className="max-w-[520px] w-full flex flex-col items-start relative flex-[0_0_auto]">
              <div className="relative self-stretch w-full h-[66px]">
                <p className="absolute top-0 left-[calc(50.00%_-_252px)] w-[510px] h-[33px] flex items-center justify-center font-manrope font-normal text-[#6b7b76] text-[length:var(--moinoviichistiimir-template-framer-website-inter-regular-font-size)] text-center tracking-[var(--moinoviichistiimir-template-framer-website-inter-regular-letter-spacing)] leading-[var(--moinoviichistiimir-template-framer-website-inter-regular-line-height)] whitespace-nowrap">
                  We believe in a future where style and sustainability
                </p>

                <p className="absolute top-8 left-[calc(50.00%_-_106px)] w-[213px] h-[33px] flex items-center justify-center font-manrope font-normal text-[#6b7b76] text-[length:var(--moinoviichistiimir-template-framer-website-inter-regular-font-size)] text-center tracking-[var(--moinoviichistiimir-template-framer-website-inter-regular-letter-spacing)] leading-[var(--moinoviichistiimir-template-framer-website-inter-regular-line-height)] whitespace-nowrap">
                  coexist harmoniously.
                </p>
              </div>
            </div>
          </div>

          <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
            <a
              className="inline-flex flex-col items-center justify-center px-[30px] py-5 relative flex-[0_0_auto] bg-[#4caf50] rounded-[60px] hover:bg-[#43a047] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4caf50] focus:ring-offset-2 focus:ring-offset-[#F9FAFB] shadow-sm"
              href="https://moinoviichistiimir-template.framer.website/about-us"
              rel="noopener noreferrer"
              target="_blank"
              aria-label="Подробнее о проекте"
            >
              <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
                <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                  <span className="flex items-center w-fit font-manrope font-medium text-[22px] tracking-[-0.22px] leading-[24.2px] whitespace-nowrap relative mt-[-1.00px] text-white">
                    О проекте
                  </span>
                </div>
              </div>

              <div className="absolute w-full h-full top-0 left-0 rounded-[60px] border border-solid border-[#43a047]" />
            </a>
          </div>
        </RevealOnScroll>

        <div
          className="absolute w-full h-[15.16%] top-0 left-0"
          aria-hidden="true"
        >
          <div className="absolute top-[-30px] left-[-50px] w-[230px] h-[300px] rounded-[20px] aspect-[0.77] bg-[url(/trees.png)] bg-cover bg-[50%_50%]" />

          <div className="absolute top-[-30px] right-[-120px] w-[290px] h-[390px] rounded-[20px] aspect-[0.74] bg-[url(/steps.png)] bg-cover bg-[50%_50%]" />
        </div>

        <div
          className="absolute w-full h-[14.16%] top-[85.92%] left-0"
          aria-hidden="true"
        >
          <div className="absolute -left-5 bottom-[-41px] w-[290px] h-[390px] rounded-[20px] aspect-[0.74] bg-[url(/solar-panels.png)] bg-cover bg-[50%_50%]" />

          <div className="absolute right-10 bottom-[-21px] w-[230px] h-[300px] rounded-[20px] aspect-[0.77] bg-[url(/windmills.png)] bg-cover bg-[50%_50%]" />
        </div>
      </div>
    </section>
  );
}
