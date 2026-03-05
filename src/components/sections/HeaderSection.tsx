import { useState, useEffect } from 'react';
import { Logo } from '@/components/ui/Logo';
import { NAV_LINKS } from '@/constants/links';

const HERO_SCROLL_THRESHOLD = 120;

export function HeaderSection(): JSX.Element {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setIsScrolled(window.scrollY > HERO_SCROLL_THRESHOLD);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isTransparent = !isScrolled;

  return (
    <header className="flex flex-col w-full items-start fixed top-0 left-0 z-50">
      <div
        className={`flex flex-col items-center justify-center px-0 py-[15px] relative self-stretch w-full flex-[0_0_auto] transition-colors duration-300 ${
          isTransparent ? 'bg-transparent' : 'bg-white'
        }`}
      >
        <nav
          className="justify-between px-[30px] py-0 self-stretch w-full flex-[0_0_auto] flex items-center relative"
          aria-label="Main navigation"
        >
          <div className="flex flex-col min-h-[37px] items-start justify-center relative">
            <Logo
              ariaLabel="Мой новый чистый мир — на главную"
              light={isTransparent}
            />
          </div>

          <ul className="inline-flex items-center gap-[50px] relative flex-[0_0_auto] list-none m-0 p-0">
            {NAV_LINKS.map((link, index) => (
              <li
                key={index}
                className="inline-flex flex-col items-start relative flex-[0_0_auto]"
              >
                <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                  <div className="inline-flex items-start relative flex-[0_0_auto]">
                    {link.isActive ? (
                      <span
                        className={`relative flex items-center w-fit mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-xl tracking-[-0.20px] leading-6 whitespace-nowrap transition-colors ${
                          isTransparent ? 'text-white' : 'text-[#222222]'
                        }`}
                        aria-current="page"
                      >
                        {link.label}
                      </span>
                    ) : (
                      <a
                        className={`relative flex items-center w-fit mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-xl tracking-[-0.20px] leading-6 whitespace-nowrap transition-colors ${
                          isTransparent
                            ? 'text-white hover:text-white/90'
                            : 'text-[#222222] hover:text-[#4f7363]'
                        }`}
                        href={link.href}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {link.label}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
            <a
              className="inline-flex flex-col items-center justify-center px-[30px] py-5 relative flex-[0_0_auto] bg-[#4f7363] rounded-[60px] hover:bg-[#3f5d51] transition-colors"
              href="https://greenx-template.framer.website/contact-us"
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
                <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                  <span className="flex items-center w-fit [font-family:'Inter-Medium',Helvetica] font-medium text-[22px] tracking-[-0.22px] leading-[24.2px] whitespace-nowrap relative mt-[-1.00px] text-white">
                    Начать работу
                  </span>
                </div>
              </div>
              <div className="absolute w-full h-full top-0 left-0 rounded-[60px] border border-solid border-[#4f7363]" />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
