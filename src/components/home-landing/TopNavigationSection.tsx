import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import navLogo from '@/assets/home-landing/nav-logo.svg';
import navUploadIcon from '@/assets/home-landing/nav-upload.svg';
import navDirectoryIcon from '@/assets/home-landing/nav-directory.svg';
import navAccountIcon from '@/assets/home-landing/nav-account.svg';
import { useAuth } from '@/contexts/useAuth';

const labelFont =
  'h-[25px] font-nunito font-semibold text-lg text-center tracking-[0] leading-[normal]';

const scrollEase =
  'transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';

function NavScrollLink({
  to,
  containerClassName,
  trackClassName,
  labelWidth,
  label,
  iconSrc,
  onClick,
}: {
  to: string;
  containerClassName: string;
  trackClassName: string;
  labelWidth: string;
  label: string;
  iconSrc: string;
  onClick?: () => void;
}): JSX.Element {
  const iconSlot = (wrapOverflow: boolean): JSX.Element => (
    <span
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center ${wrapOverflow ? 'overflow-hidden' : ''}`}
    >
      <img src={iconSrc} alt="" className="h-6 w-6 object-contain" />
    </span>
  );

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group relative block h-[25px] max-w-full overflow-hidden no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b3335]/30 ${containerClassName}`}
    >
      <div
        className={`flex flex-col ${scrollEase} motion-reduce:group-hover:translate-y-0 motion-reduce:group-focus-visible:translate-y-0 group-hover:-translate-y-[25px] group-focus-visible:-translate-y-[25px] ${trackClassName}`}
      >
        <div className="flex h-[25px] w-full shrink-0 items-center gap-2.5">
          <span className={`${labelWidth} ${labelFont} text-[#1f2526]`}>{label}</span>
          {iconSlot(false)}
        </div>
        <div className="flex h-[25px] w-full shrink-0 items-center gap-2.5">
          <span className={`${labelWidth} ${labelFont} text-[#2b3335]`}>{label}</span>
          {iconSlot(true)}
        </div>
      </div>
    </Link>
  );
}

function BurgerIcon({ open }: { open: boolean }): JSX.Element {
  const bar = 'block absolute left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-[#2b3335] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';
  return (
    <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden>
      <span className={`${bar} ${open ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-[3px]'}`} />
      <span className={`${bar} top-1/2 -translate-y-1/2 ${open ? 'opacity-0 scale-x-0' : 'opacity-100'}`} />
      <span className={`${bar} ${open ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'bottom-[3px] top-auto'}`} />
    </span>
  );
}

export function TopNavigationSection(): JSX.Element {
  const { user, isReady } = useAuth();
  const isLoggedIn = isReady && !!user;
  const accountTo = isLoggedIn ? '/dashboard/profile' : '/login';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      <NavScrollLink
        to="/upload"
        containerClassName="mx-auto w-full max-w-[220px] sm:mx-0 sm:w-[197px]"
        trackClassName="w-full sm:w-[199px]"
        labelWidth="w-[163px] max-w-[calc(100%-2rem)] shrink-0 truncate sm:max-w-none sm:truncate-none"
        label="Разместить объект"
        iconSrc={navUploadIcon}
        onClick={closeMenu}
      />
      <NavScrollLink
        to="/directory"
        containerClassName="mx-auto w-full max-w-[220px] sm:mx-0 sm:w-[215px]"
        trackClassName="w-full sm:w-[217px]"
        labelWidth="w-[181px] max-w-[calc(100%-2rem)] shrink-0 truncate sm:max-w-none sm:truncate-none"
        label="Открыть справочник"
        iconSrc={navDirectoryIcon}
        onClick={closeMenu}
      />
      <NavScrollLink
        to={accountTo}
        containerClassName="mx-auto w-full max-w-[200px] sm:mx-0 sm:w-[178px]"
        trackClassName="w-full sm:w-[180px]"
        labelWidth="w-36 max-w-[calc(100%-2rem)] shrink-0 truncate sm:max-w-none sm:truncate-none"
        label="Личный кабинет"
        iconSrc={navAccountIcon}
        onClick={closeMenu}
      />
    </>
  );

  return (
    <header className="relative z-[2] w-full" ref={menuRef}>
      <div className="mx-auto w-full max-w-[1920px] px-4 pt-4">
        {/* Main bar */}
        <div className="relative flex min-h-[65px] items-center justify-between rounded-[25px] border-[none] bg-[#ffffff4c] p-3 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:gap-4 sm:p-4 md:px-5 md:py-3 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[25px] before:border before:border-transparent before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
          <Link
            to="/"
            className="relative z-[2] block h-10 w-auto max-w-[min(180px,55vw)] shrink-0 sm:h-11 sm:max-w-[180px]"
            aria-label="Мой новый чистый мир — на главную"
          >
            <img src={navLogo} alt="" className="h-full w-full object-contain object-left" />
          </Link>

          {/* Burger — до десктопа (включая планшеты) */}
          <button
            type="button"
            className="relative z-[2] flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
          >
            <BurgerIcon open={menuOpen} />
          </button>

          {/* Горизонтальное меню — только большие экраны */}
          <nav
            className="relative z-[2] hidden lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:justify-end lg:gap-8 xl:gap-10"
            aria-label="Основное меню"
          >
            {navLinks}
          </nav>
        </div>

        {/* Выпадающее меню под шапкой — до lg */}
        <div
          className={`lg:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            menuOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav
            className="mt-2 flex flex-col items-center gap-4 rounded-[20px] bg-[#ffffff4c] p-4 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] relative"
            aria-label="Основное меню"
          >
            {navLinks}
          </nav>
        </div>
      </div>
    </header>
  );
}
