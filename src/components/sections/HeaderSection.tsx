import { Logo } from '@/components/ui/Logo';
import { NAV_LINKS } from '@/constants/links';

export function HeaderSection(): JSX.Element {
  return (
    <header className="flex flex-col w-full items-start fixed top-0 left-0 z-50">
      <div className="flex flex-col items-center justify-center px-0 py-[15px] relative self-stretch w-full flex-[0_0_auto] bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <nav
          className="justify-between px-[30px] py-0 self-stretch w-full flex-[0_0_auto] flex items-center relative"
          aria-label="Main navigation"
        >
          <div className="flex flex-col min-h-[37px] items-start justify-center relative">
            <Logo ariaLabel="Мой новый чистый мир — на главную" />
          </div>

          <ul className="inline-flex items-center gap-[50px] relative flex-[0_0_auto] list-none m-0 p-0">
            {NAV_LINKS.map((link, index) => (
              <li key={index} className="inline-flex flex-col items-start relative flex-[0_0_auto]">
                <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                  <div className="inline-flex items-start relative flex-[0_0_auto]">
                    {link.isActive ? (
                      <span
                        className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-xl tracking-[-0.20px] leading-6 whitespace-nowrap text-slate-900"
                        aria-current="page"
                      >
                        {link.label}
                      </span>
                    ) : (
                      <a
                        className="relative flex items-center w-fit mt-[-1.00px] font-manrope font-medium text-xl tracking-[-0.20px] leading-6 whitespace-nowrap text-slate-700 hover:text-[#2e7d32] transition-colors"
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
              className="inline-flex flex-col items-center justify-center px-[30px] py-5 relative flex-[0_0_auto] bg-[#4caf50] rounded-[60px] hover:bg-[#43a047] transition-colors shadow-sm"
              href="https://moinoviichistiimir-template.framer.website/contact-us"
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="inline-flex flex-col items-start relative flex-[0_0_auto]">
                <div className="flex flex-col items-start flex-[0_0_auto] relative self-stretch w-full">
                  <span className="flex items-center w-fit font-manrope font-medium text-[22px] tracking-[-0.22px] leading-[24.2px] whitespace-nowrap relative mt-[-1.00px] text-white">
                    Начать работу
                  </span>
                </div>
              </div>
              <div className="absolute w-full h-full top-0 left-0 rounded-[60px] border border-solid border-[#43a047]" />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
