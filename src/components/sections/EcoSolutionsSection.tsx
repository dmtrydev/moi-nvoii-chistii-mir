import { Component1 } from '@/components/icons';
import { RevealOnScroll } from '@/components/ui/RevealOnScroll';
import { ECO_SERVICES } from '@/constants/services';

export function EcoSolutionsSection(): JSX.Element {
  return (
    <section className="items-center justify-center px-0 py-[130px] bg-[#F9FAFB] flex relative self-stretch w-full flex-[0_0_auto] overflow-x-hidden">
      <div className="flex-col max-w-[1510px] w-full justify-center gap-[120px] px-[50px] py-0 flex items-center relative">
        <RevealOnScroll variant="reveal-blur" className="items-start justify-between flex relative self-stretch w-full flex-[0_0_auto]">
          <div className="flex flex-1 grow flex-col items-start relative">
            <h2 className="relative self-stretch mt-[-1.00px] text-slate-900 font-manrope font-medium text-[70px] tracking-[-0.70px] leading-[84px]">
              Eco-friendly <br />
              solutions.
            </h2>
          </div>

          <div className="flex-col max-w-[520px] items-start gap-[60px] flex-1 grow flex relative">
            <div className="self-stretch w-full flex flex-col items-start relative flex-[0_0_auto]">
              <p className="relative self-stretch mt-[-1.00px] font-manrope font-normal text-slate-600 text-lg tracking-[-0.36px] leading-[27px]">
                Наша миссия — вести к устойчивому будущему через инновационные
                <br />
                решения для защиты планеты.
              </p>
            </div>

            <a
              className="inline-flex flex-col px-[30px] py-5 flex-[0_0_auto] bg-[#4caf50] rounded-[60px] items-center justify-center relative shadow-sm hover:bg-[#43a047] transition-colors"
              href="https://moinoviichistiimir-template.framer.website/services"
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
                <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                  <span className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-white text-[22px] tracking-[-0.22px] leading-[24.2px] whitespace-nowrap">
                    Our Services
                  </span>
                </div>
              </div>
            </a>
          </div>
        </RevealOnScroll>

        <div className="flex flex-wrap items-start justify-center gap-[0px_20px] relative self-stretch w-full flex-[0_0_auto]">
          {ECO_SERVICES.map((service, index) => (
            <RevealOnScroll
              key={service.id}
              variant="reveal-scale"
              delay={`${index * 0.08}s`}
              className="flex flex-col w-[337.5px] items-start relative"
            >
              <div className="flex flex-col w-[337.5px] items-start relative">
                <a
                  className="flex flex-col items-start p-5 relative self-stretch w-full flex-[0_0_auto] bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-sm hover:border-slate-300 hover:shadow-md transition-shadow"
                  href={service.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <div className="flex flex-col items-start gap-10 relative self-stretch w-full flex-[0_0_auto]">
                    <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                      <span className="flex items-center self-stretch font-manrope font-normal text-lg tracking-[-0.36px] leading-[27px] relative mt-[-1.00px] text-slate-500">
                        {service.number}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 relative self-stretch w-full flex-[0_0_auto]">
                      <div className="flex flex-col min-w-[238px] items-start relative flex-1 grow">
                        <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                          <span className="self-stretch font-manrope font-medium text-[26px] tracking-[-0.52px] leading-[31.2px] relative mt-[-1.00px] text-slate-900">
                            {service.title.split('\n').map((line, i) => (
                              <span key={i}>
                                {line}
                                {i < service.title.split('\n').length - 1 && <br />}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col w-[46px] items-start justify-center relative aspect-[1]">
                        <div className="flex px-0 py-[15.5px] self-stretch w-full flex-[0_0_auto] bg-[#4caf50]/15 rounded-[60px] overflow-hidden items-center justify-center relative">
                          <div className="flex flex-col w-[15px] items-start justify-center relative aspect-[1]">
                            <Component1 className="!relative !self-stretch !w-full !h-[15px] !object-cover text-[#2e7d32]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
