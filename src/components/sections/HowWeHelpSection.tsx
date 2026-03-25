import { Component1, Component1_1, IconComponentNode } from '@/components/icons';
import { RevealOnScroll } from '@/components/ui/RevealOnScroll';
import { HELP_CARDS } from '@/constants/team';

export function HowWeHelpSection(): JSX.Element {
  return (
    <section className="items-center justify-center px-0 py-[130px] bg-[#F9FAFB] flex relative self-stretch w-full flex-[0_0_auto]">
      <div className="flex-col max-w-[1510px] w-full justify-center pl-[1470px] pr-0 py-0 flex items-center relative">
        <RevealOnScroll variant="reveal-scale" className="inline-flex flex-col items-start justify-center gap-[50px] relative flex-[0_0_auto] ml-[-1420.00px] mr-[-1420.00px]">
          <header className="w-[1410px] items-end justify-between flex-[0_0_auto] flex relative">
            <div className="flex flex-1 grow flex-col items-start relative">
              <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                <h2 className="relative flex items-center self-stretch mt-[-1.00px] font-manrope font-medium text-[#151e1b] text-[70px] tracking-[-0.70px] leading-[84px]">
                  How we help
                </h2>
              </div>
            </div>

            <nav
              className="inline-flex items-center justify-center gap-3 relative flex-[0_0_auto]"
              aria-label="Carousel navigation"
            >
              <button
                className="flex flex-col w-12 items-start justify-center relative rotate-180 aspect-[1]"
                aria-label="Previous slide"
                type="button"
              >
                <div className="flex items-center justify-center px-0 py-[15px] relative self-stretch w-full flex-[0_0_auto] bg-[#4caf50] rounded-[60px] overflow-hidden aspect-[1] opacity-30">
                  <div className="flex flex-col w-[18px] items-start justify-center relative aspect-[1]">
                    <IconComponentNode className="!relative !self-stretch !w-full !h-[18px] !-rotate-180 !object-cover" />
                  </div>
                </div>
              </button>

              <button
                className="flex flex-col w-12 items-start justify-center relative aspect-[1]"
                aria-label="Next slide"
                type="button"
              >
                <div className="flex items-center justify-center px-0 py-3 relative self-stretch w-full flex-[0_0_auto] bg-[#4caf50] rounded-[60px] overflow-hidden aspect-[1]">
                  <div className="flex flex-col w-6 items-start justify-center relative aspect-[1]">
                    <Component1 className="!relative !self-stretch !w-full !h-6 !object-cover" />
                  </div>
                </div>
              </button>
            </nav>
          </header>

          <div className="flex items-start gap-[90px] relative self-stretch w-full flex-[0_0_auto]">
            {HELP_CARDS.map((card) => (
              <article
                key={card.id}
                className="flex flex-col w-[900px] items-end gap-5 relative"
              >
                <div className="flex items-end justify-center gap-[50px] relative self-stretch w-full flex-[0_0_auto]">
                  <div
                    className="relative flex-1 grow h-[350px] rounded-[20px] bg-cover bg-[50%_50%]"
                    style={{ backgroundImage: `url(${card.image})` }}
                    role="img"
                    aria-label={card.title}
                  />

                  <div className="inline-flex items-start justify-center relative self-stretch flex-[0_0_auto]">
                    <div className="flex-col max-w-[265px] w-[265px] items-start justify-end gap-[8.8px] pt-0 pb-2.5 px-0 self-stretch flex relative">
                      <div
                        className="relative w-10 h-10 aspect-[1]"
                        aria-hidden="true"
                      >
                        <div className="flex flex-col w-full h-full items-start relative">
                          <div className="flex flex-col w-10 h-10 items-center justify-center relative">
                            <Component1_1 className="!relative !w-10 !h-10" />
                          </div>
                        </div>
                      </div>

                      <div className="flex self-stretch w-full flex-[0_0_auto] flex-col items-start relative">
                        <div className="flex flex-col items-start pt-0 pb-[0.6px] px-0 relative self-stretch w-full flex-[0_0_auto]">
                          <h3 className="relative self-stretch mt-[-1.00px] font-manrope font-medium text-[#151e1b] text-[34px] tracking-[-1.02px] leading-[40.8px]">
                            {card.title.split(' ').map((word, index, array) => {
                              if (card.id === 1) {
                                if (index === 3 || index === 6) {
                                  return (
                                    <span key={index}>
                                      {word}
                                      <br />
                                    </span>
                                  );
                                }
                              } else if (card.id === 2) {
                                if (index === 1) {
                                  return (
                                    <span key={index}>
                                      {word}
                                      <br />
                                    </span>
                                  );
                                }
                              }
                              return index === array.length - 1
                                ? word
                                : word + ' ';
                            })}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start relative self-stretch w-full flex-[0_0_auto]">
                  <div className="flex flex-col w-[560px] items-start relative">
                    <p className="relative w-fit mt-[-1.00px] mr-[-1.00px] font-manrope font-normal text-[#6b7b76] text-lg tracking-[-0.36px] leading-[27px]">
                      {card.description
                        .split('. ')
                        .map((sentence, index, array) => {
                          const words = sentence.split(' ');
                          const formattedSentence = words.map(
                            (word, wordIndex, wordArray) => {
                              if (card.id === 1) {
                                if (
                                  wordIndex === 10 ||
                                  wordIndex === 18 ||
                                  wordIndex === 28
                                ) {
                                  return (
                                    <span key={wordIndex}>
                                      {word}
                                      <br />
                                    </span>
                                  );
                                }
                              } else if (card.id === 2) {
                                if (wordIndex === 10 || wordIndex === 17) {
                                  return (
                                    <span key={wordIndex}>
                                      {word}
                                      <br />
                                    </span>
                                  );
                                }
                              }
                              return wordIndex === wordArray.length - 1
                                ? word
                                : word + ' ';
                            }
                          );
                          return (
                            <span key={index}>
                              {formattedSentence}
                              {index < array.length - 1 ? '. ' : ''}
                            </span>
                          );
                        })}
                    </p>
                  </div>
                </div>
              </article>
            ))}

            <img
              className="relative w-[900px]"
              alt="Desktop help card"
              src="/desktop-help-card.svg"
            />
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
