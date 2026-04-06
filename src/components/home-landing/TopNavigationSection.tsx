import { Link } from 'react-router-dom';
import navLogo from '@/assets/home-landing/nav-logo.svg';
import navUploadIcon from '@/assets/home-landing/nav-upload.svg';
import navDirectoryIcon from '@/assets/home-landing/nav-directory.svg';
import navAccountIcon from '@/assets/home-landing/nav-account.svg';
import { useAuth } from '@/contexts/useAuth';

const labelFont =
  'h-[25px] font-nunito font-semibold text-lg text-center tracking-[0] leading-[normal]';

/** Как у кнопок фильтра на главной — 600ms, та же кривая */
const scrollEase =
  'transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';

/** Две одинаковые строки (иконка одна); при hover сдвиг вверх — меняется оттенок текста. */
function NavScrollLink({
  to,
  containerClassName,
  trackClassName,
  labelWidth,
  label,
  iconSrc,
}: {
  to: string;
  containerClassName: string;
  trackClassName: string;
  labelWidth: string;
  label: string;
  iconSrc: string;
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

export function TopNavigationSection(): JSX.Element {
  const { user, isReady } = useAuth();
  const isLoggedIn = isReady && !!user;
  const accountTo = isLoggedIn ? '/dashboard/profile' : '/login';

  return (
    <header className="relative z-[2] w-full px-4 pt-4 sm:px-6 md:px-8 lg:px-[min(50px,3.5vw)]">
      <div className="relative flex min-h-[65px] flex-col gap-4 rounded-[25px] border-[none] bg-[#ffffff4c] p-3 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4 md:min-h-[65px] md:px-5 md:py-3 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[25px] before:border before:border-transparent before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]">
        <Link
          to="/"
          className="relative z-[2] mx-auto block h-10 w-auto max-w-[min(180px,55vw)] shrink-0 -translate-y-0 sm:mx-0 sm:h-11 sm:max-w-[180px]"
          aria-label="Мой новый чистый мир — на главную"
        >
          <img src={navLogo} alt="" className="h-full w-full object-contain object-left" />
        </Link>

        <nav
          className="relative z-[2] flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center md:justify-end md:gap-6 lg:gap-8 xl:gap-10"
          aria-label="Основное меню"
        >
          <NavScrollLink
            to="/upload"
            containerClassName="mx-auto w-full max-w-[220px] sm:mx-0 sm:w-[197px]"
            trackClassName="w-full sm:w-[199px]"
            labelWidth="w-[163px] max-w-[calc(100%-2rem)] shrink-0 truncate sm:max-w-none sm:truncate-none"
            label="Разместить объект"
            iconSrc={navUploadIcon}
          />
          <NavScrollLink
            to="/directory"
            containerClassName="mx-auto w-full max-w-[220px] sm:mx-0 sm:w-[215px]"
            trackClassName="w-full sm:w-[217px]"
            labelWidth="w-[181px] max-w-[calc(100%-2rem)] shrink-0 truncate sm:max-w-none sm:truncate-none"
            label="Открыть справочник"
            iconSrc={navDirectoryIcon}
          />
          <NavScrollLink
            to={accountTo}
            containerClassName="mx-auto w-full max-w-[200px] sm:mx-0 sm:w-[178px]"
            trackClassName="w-full sm:w-[180px]"
            labelWidth="w-36 max-w-[calc(100%-2rem)] shrink-0 truncate sm:max-w-none sm:truncate-none"
            label="Личный кабинет"
            iconSrc={navAccountIcon}
          />
        </nav>
      </div>
    </header>
  );
}
