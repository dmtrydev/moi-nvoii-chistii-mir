import { TEAM_MEMBERS } from '@/constants/team';
import { RevealOnScroll } from '@/components/ui/RevealOnScroll';

export function TeamMembersSection(): JSX.Element {
  return (
    <section className="flex items-center justify-center pt-0 pb-[130px] px-0 relative self-stretch w-full flex-[0_0_auto] bg-[#f2f8f5]">
      <div className="flex flex-col max-w-[1510px] w-full items-center justify-center gap-[60px] px-[50px] py-0 relative">
        <RevealOnScroll variant="reveal" className="flex max-w-[940px] w-full flex-[0_0_auto] flex-col items-start relative">
        <header className="flex max-w-[940px] w-full flex-[0_0_auto] flex-col items-start relative">
          <div className="h-[252px] relative self-stretch w-full">
            <h2 className="absolute top-0 left-[calc(50.00%_-_466px)] w-[950px] h-[168px] [font-family:'Inter-Medium',Helvetica] font-medium text-[#151e1b] text-[70px] text-center tracking-[-0.70px] leading-[84px]">
              Our team is the driving force <br />
              behind our mission to create
            </h2>

            <div className="absolute top-[168px] left-[calc(50.00%_-_421px)] w-[842px] h-[84px] flex items-center justify-center [font-family:'Inter-Medium',Helvetica] font-medium text-[#151e1b] text-[70px] text-center tracking-[-0.70px] leading-[84px] whitespace-nowrap">
              a more sustainable world.
            </div>
          </div>
        </header>
        </RevealOnScroll>

        <div className="flex flex-wrap items-center justify-center gap-[0px_10px] relative self-stretch w-full flex-[0_0_auto]">
          {TEAM_MEMBERS.map((member, index) => (
            <RevealOnScroll key={index} variant="reveal-scale" delay={`${index * 0.06}s`} className="flex flex-col w-[345px] items-start relative">
            <article className="flex flex-col w-[345px] items-start relative">
              <div className="flex self-stretch w-full flex-[0_0_auto] rounded-[20px] overflow-hidden items-center justify-center relative">
                <div
                  className="relative flex-1 grow min-h-[360px] max-h-[430px] aspect-[0.8] bg-cover bg-[50%_50%]"
                  style={{ backgroundImage: `url(${member.image})` }}
                  role="img"
                  aria-label={`${member.name} profile photo`}
                />

                <div
                  className={`inline-flex items-center justify-center px-5 py-2.5 absolute ${index === 3 ? 'right-[9px]' : 'right-2.5'} bottom-2.5 bg-white rounded-[0px_20px_20px_20px]`}
                >
                  <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
                    <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                      <h3 className="relative flex items-center w-fit mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-[#151e1b] text-xl tracking-[-0.20px] leading-6 whitespace-nowrap">
                        {member.name}
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </article>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
