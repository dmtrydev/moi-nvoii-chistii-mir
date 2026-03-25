import { useState, type FormEvent } from 'react';
import { Logo } from '@/components/ui/Logo';
import {
  Component1_3,
  Component1_4,
  Component1_5,
  Component1_6,
} from '@/components/icons';
import {
  COMPANY_LINKS,
  USEFUL_INFO_LINKS,
  SERVICES_LINKS,
} from '@/constants/links';
import type { SocialLink } from '@/types';

const SOCIAL_LINKS: SocialLink[] = [
  { icon: Component1_4, href: 'https://www.instagram.com/', label: 'Instagram' },
  { icon: Component1_5, href: 'https://www.youtube.com/', label: 'YouTube' },
  { icon: Component1_6, href: 'https://web.telegram.org/', label: 'Telegram' },
];

export function FooterSection(): JSX.Element {
  const [email, setEmail] = useState('');

  const handleEmailSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    console.log('Email submitted:', email);
  };

  return (
    <footer className="pt-[130px] pb-10 px-0 flex items-center justify-center relative self-stretch w-full flex-[0_0_auto] bg-[#F9FAFB] border-t border-slate-200">
      <div className="flex-col max-w-[1510px] w-full justify-center gap-[50px] px-[50px] py-0 flex items-center relative">
        <div className="items-start justify-between flex relative self-stretch w-full flex-[0_0_auto]">
          <div className="flex flex-col w-[225.59px] items-start gap-[30px] relative">
            <div className="flex flex-col w-[133px] h-[37px] items-start justify-center relative">
              <Logo ariaLabel="Мой новый чистый мир — на главную" />
            </div>
            <div className="flex self-stretch w-full flex-[0_0_auto] flex-col items-start relative">
              <p className="relative self-stretch mt-[-1.00px] font-manrope font-medium text-[#151e1b] text-[22px] tracking-[-0.22px] leading-[24.2px]">
                Eco and recycling <br />
                solutions for a better <br />
                world.
              </p>
            </div>
          </div>

          <nav
            className="inline-flex items-start gap-[50px] relative flex-[0_0_auto]"
            aria-label="Footer Navigation"
          >
            <div className="inline-flex flex-col items-start justify-center gap-7 relative flex-[0_0_auto]">
              <div className="inline-flex flex-[0_0_auto] flex-col items-start relative">
                <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                  <h3 className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-[#2e7d32] text-[22px] tracking-[-0.22px] leading-[24.2px] whitespace-nowrap">
                    Company
                  </h3>
                </div>
              </div>
              <div className="relative w-[83.33px] h-[105.61px] overflow-hidden">
                {COMPANY_LINKS.map((link, index) => (
                  <div
                    key={index}
                    className="inline-flex flex-col items-start absolute left-0"
                    style={{ top: `calc(50.00% - ${54 - index * 43}px)` }}
                  >
                    <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                      <div className="inline-flex items-start relative flex-[0_0_auto]">
                        {index === 0 ? (
                          <div className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-[#6b7b76] text-[length:var(--moinoviichistiimir-template-framer-website-inter-medium-font-size)] tracking-[var(--moinoviichistiimir-template-framer-website-inter-medium-letter-spacing)] leading-[var(--moinoviichistiimir-template-framer-website-inter-medium-line-height)] whitespace-nowrap">
                            {link.label}
                          </div>
                        ) : (
                          <a
                            className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-[#6b7b76] text-[length:var(--moinoviichistiimir-template-framer-website-inter-medium-font-size)] tracking-[var(--moinoviichistiimir-template-framer-website-inter-medium-letter-spacing)] leading-[var(--moinoviichistiimir-template-framer-website-inter-medium-line-height)] whitespace-nowrap"
                            href={link.href}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {link.label}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="inline-flex flex-col items-start justify-center gap-7 relative flex-[0_0_auto]">
              <div className="inline-flex flex-[0_0_auto] flex-col items-start relative">
                <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                  <h3 className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-[#2e7d32] text-[22px] tracking-[-0.22px] leading-[24.2px] whitespace-nowrap">
                    Useful Info
                  </h3>
                </div>
              </div>
              <div className="relative w-[83.45px] h-[105.61px] overflow-hidden">
                {USEFUL_INFO_LINKS.map((link, index) => (
                  <div
                    key={index}
                    className="inline-flex flex-col items-start absolute left-0"
                    style={{ top: `calc(50.00% - ${54 - index * 43}px)` }}
                  >
                    <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                      <div className="inline-flex items-start relative flex-[0_0_auto]">
                        <a
                          className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-[#6b7b76] text-[length:var(--moinoviichistiimir-template-framer-website-inter-medium-font-size)] tracking-[var(--moinoviichistiimir-template-framer-website-inter-medium-letter-spacing)] leading-[var(--moinoviichistiimir-template-framer-website-inter-medium-line-height)] whitespace-nowrap"
                          href={link.href}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {link.label}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="inline-flex flex-col min-w-[151.27px] items-start justify-center gap-[27px] relative flex-[0_0_auto]">
              <div className="inline-flex flex-[0_0_auto] flex-col items-start relative">
                <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
                  <h3 className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-[#2e7d32] text-[22px] tracking-[-0.22px] leading-[24.2px] whitespace-nowrap">
                    Services
                  </h3>
                </div>
              </div>
              <div className="flex flex-col items-start justify-center relative self-stretch w-full flex-[0_0_auto]">
                <div className="flex flex-col items-start justify-center gap-[23px] relative self-stretch w-full flex-[0_0_auto]">
                  {SERVICES_LINKS.map((link, index) => (
                    <div
                      key={index}
                      className="relative flex-[0_0_auto] inline-flex flex-col items-start"
                    >
                      <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                        <div className="inline-flex items-start relative flex-[0_0_auto]">
                          <a
                            className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-[#6b7b76] text-[length:var(--moinoviichistiimir-template-framer-website-inter-medium-font-size)] tracking-[var(--moinoviichistiimir-template-framer-website-inter-medium-letter-spacing)] leading-[var(--moinoviichistiimir-template-framer-website-inter-medium-line-height)] whitespace-nowrap"
                            href={link.href}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {link.label}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          <div className="flex flex-col w-[465.3px] items-start gap-5 relative">
            <div className="flex self-stretch w-full flex-[0_0_auto] flex-col items-start relative">
              <h3 className="relative flex items-center self-stretch mt-[-1.00px] font-manrope font-medium text-[#151e1b] text-[22px] tracking-[-0.22px] leading-[24.2px]">
                Subscribe to our newsletter.
              </h3>
            </div>
            <div className="self-stretch w-full flex flex-col items-start relative flex-[0_0_auto]">
              <p className="relative self-stretch mt-[-1.00px] font-manrope font-normal text-[#6b7b76] text-lg tracking-[-0.36px] leading-[27px]">
                Want to stay up to date with news and updates about our <br />
                services? Subscribe.
              </p>
            </div>
            <form
              onSubmit={handleEmailSubmit}
              className="flex items-start pt-2.5 pb-0 px-0 relative self-stretch w-full flex-[0_0_auto]"
            >
              <div className="flex flex-col items-start relative flex-1 grow rounded-[60px] overflow-hidden">
                <div className="flex items-start justify-center pt-[18px] pb-[19.8px] px-11 relative self-stretch w-full flex-[0_0_auto]">
                  <div className="flex flex-col items-start relative flex-1 grow">
                    <label htmlFor="newsletter-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="newsletter-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="relative flex items-center self-stretch mt-[-1.00px] font-manrope font-medium text-[#6b7b7633] text-[length:var(--moinoviichistiimir-template-framer-website-DM-sans-medium-font-size)] tracking-[var(--moinoviichistiimir-template-framer-website-DM-sans-medium-letter-spacing)] leading-[var(--moinoviichistiimir-template-framer-website-DM-sans-medium-line-height)] bg-transparent border-none outline-none w-full placeholder:text-[#6b7b76b2]"
                      required
                      aria-required="true"
                    />
                  </div>
                </div>
                <div className="rounded-[60px] border border-solid border-[#6b7b7633] absolute w-full h-full top-0 left-0 pointer-events-none" />
              </div>
              <button
                type="submit"
                className="inline-flex flex-col items-start absolute right-[26px] bottom-5 bg-transparent border-none cursor-pointer p-0"
                aria-label="Subscribe to newsletter"
              >
                <div className="flex w-6 h-6 items-center justify-center relative">
                  <div className="relative w-6 h-6 aspect-[1]">
                    <div className="flex flex-col w-full h-full items-start relative">
                      <div className="flex flex-col w-6 h-6 items-center justify-center relative">
                        <Component1_3 className="!relative !w-6 !h-6" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </form>
          </div>
        </div>

        <div
          className="relative self-stretch w-full h-px bg-[#0000001a]"
          role="separator"
        />

        <div className="flex items-center justify-between relative self-stretch w-full flex-[0_0_auto]">
          <div
            className="inline-flex items-center justify-center gap-2.5 relative flex-[0_0_auto]"
            role="list"
            aria-label="Social Media Links"
          >
            {SOCIAL_LINKS.map((social, index) => {
              const IconComponent = social.icon;
              return (
                <div
                  key={index}
                  className="flex flex-col w-[46px] h-[46px] items-start justify-center relative"
                  role="listitem"
                >
                  <a
                    className="flex flex-1 self-stretch w-full grow bg-white rounded-[60px] items-center justify-center relative"
                    href={social.href}
                    rel="noopener noreferrer"
                    target="_blank"
                    aria-label={social.label}
                  >
                    <div className="relative w-5 h-5 aspect-[1]">
                      <div className="flex flex-col w-full h-full items-start relative">
                        <div className="flex flex-col w-5 h-5 items-center justify-center relative">
                          <IconComponent className="!relative !w-5 !h-5" />
                        </div>
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>

          <div className="flex-col max-w-[250px] items-end justify-center gap-1 flex-1 grow flex relative">
            <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto]">
              <div className="flex flex-col items-end flex-[0_0_auto] relative self-stretch w-full">
                <p className="items-center justify-end w-fit mt-[-1.00px] font-manrope font-normal text-[#6b7b76] text-lg text-right tracking-[-0.36px] leading-[27px] whitespace-nowrap flex relative">
                  © Мой новый чистый мир. Все права защищены.
                </p>
              </div>
            </div>
            <div className="flex-col items-start self-stretch w-full flex-[0_0_auto] flex relative">
              <div className="flex items-start justify-end flex-[0_0_auto] relative self-stretch w-full">
                <div className="relative flex items-center justify-end w-fit mt-[-1.00px] font-manrope font-normal text-[#6b7b76] text-lg text-right tracking-[-0.36px] leading-[27px] whitespace-nowrap">
                  Designed by
                </div>
                <div className="inline-flex items-start justify-end relative flex-[0_0_auto]">
                  <a
                    className="relative flex items-center justify-end w-fit mt-[-1.00px] font-manrope font-normal text-[#6b7b76] text-lg text-right tracking-[-0.36px] leading-[27px] whitespace-nowrap"
                    href="https://fourtwelve.co/"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    fourtwelve
                  </a>
                </div>
                <div className="relative flex items-center justify-end w-fit mt-[-1.00px] font-manrope font-normal text-[#6b7b76] text-lg text-right tracking-[-0.36px] leading-[27px] whitespace-nowrap">
                  .
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
