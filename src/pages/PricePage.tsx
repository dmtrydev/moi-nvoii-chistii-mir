import { Link } from 'react-router-dom';
import heroBackground from '@/assets/home-landing/hero-background.png';
import { VidMenuCheckboxChecked } from '@/components/home-landing/VidMenuCheckbox';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';

type FeatureRow = {
  label: string;
  starter: string | null;
  professional: string | null;
  enterprise: string | null;
};

const rows: FeatureRow[] = [
  {
    label: 'ежемесячная оплата:',
    starter: '60 000 ₽',
    professional: '180 000 ₽',
    enterprise: 'от 550 000 ₽',
  },
  {
    label: 'при оплате за год (15%):',
    starter: '510 000 ₽',
    professional: '1 530 000 ₽',
    enterprise: 'Индивидуально',
  },
  {
    label: 'база прайс-листов и контактов',
    starter: null,
    professional: null,
    enterprise: null,
  },
  {
    label: 'карта ж/д-тупиков (просмотр)',
    starter: null,
    professional: null,
    enterprise: null,
  },
  {
    label: 'лимиты на запросы/экспорт',
    starter: 'до 50/мес',
    professional: 'Безлимитно (регион)',
    enterprise: 'Полный безлимит',
  },
  {
    label: 'технология утилизации с ГЭЭ',
    starter: null,
    professional: null,
    enterprise: null,
  },
  {
    label: 'оптимизация ж/д-логистики',
    starter: null,
    professional: null,
    enterprise: null,
  },
  {
    label: 'консультация экспертов',
    starter: 'E-mail поддержка',
    professional: '5 часов/vtc',
    enterprise: 'Выделенный менеджер',
  },
  {
    label: 'api и кастомные интеграции',
    starter: null,
    professional: null,
    enterprise: null,
  },
  {
    label: 'внесение в лицензию (1 кейс)',
    starter: null,
    professional: null,
    enterprise: null,
  },
  {
    label: 'sla и инд. отчетность',
    starter: null,
    professional: null,
    enterprise: null,
  },
];

/** Как заголовок на главной (`HeroCopySection`: «Планируйте экологическую…»). */
const heroHeadingClass =
  'typo-h1 relative mt-[-1px] bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent]';

/**
 * Как заголовок блока фильтра (`FilterPanelSection`: «Экологический фильтр объектов»).
 * Для строк таблицы — без nowrap, чтобы длинные подписи переносились.
 */
const filterSectionTitleClass =
  'typo-h4 relative mt-[-1px] min-w-0 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-left text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent] tracking-[0] leading-tight sm:whitespace-nowrap';

const filterSectionFeatureRowClass =
  'typo-h4 relative mt-[-1px] min-w-0 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-left text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [text-fill-color:transparent] tracking-[0] leading-tight';

function renderCell(value: string | null): JSX.Element {
  if (value == null) {
    return <VidMenuCheckboxChecked />;
  }
  return <span>{value}</span>;
}

/** Как кнопка «Найти» (`home-find-button`), без иконки и без hover-сдвига текста. */
const choosePlanButtonClass =
  'relative flex h-[60px] w-full min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-[20px] border-[none] home-find-button before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[\'\'] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b3335]/25 focus-visible:ring-offset-2';

export default function PricePage(): JSX.Element {
  return (
    <SitePublicPageShell>
      <div className="relative flex min-h-screen flex-1 flex-col">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[#f9fbfe]"
          style={{
            backgroundImage: `url(${heroBackground})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'cover',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[1] bg-white/30 backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)]"
        />

        <SiteFrameWithTopNav frameLayout="header" stacking="landing" />

        {/* Горизонтальные отступы как у `TopNavigationSection`: max-w-[1920px] px-4 */}
        <section className="relative z-10 mx-auto w-full max-w-[1920px] px-4 pb-10 pt-6">
          <div className="relative overflow-hidden rounded-[32.5px] border-[none] bg-[#ffffff4c] p-4 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:p-6 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude]">
            <div className="relative z-[2] overflow-x-auto pb-2">
              <h1 className={`${heroHeadingClass} max-w-[min(1184px,100%)]`}>
                сравнение тарифных планов экосистемы
              </h1>

              <div className="mt-4 min-w-[1820px]">
                <div className="grid grid-cols-[437px_433px_430px_433px] gap-4">
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={filterSectionTitleClass}>возможности и модули:</h2>
                  </div>
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={filterSectionTitleClass}>starter:</h2>
                  </div>
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={filterSectionTitleClass}>professional:</h2>
                  </div>
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={filterSectionTitleClass}>enterprise:</h2>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[437px_433px_430px_433px] gap-4">
                  <div className="rounded-[32.5px] bg-[#ffffff4c] px-4 pb-6 pt-2 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    {rows.map((row) => (
                      <div key={row.label} className="min-h-[74px] border-b border-[#d9ddd8] py-3 last:border-b-0">
                        <div className={filterSectionFeatureRowClass}>{row.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[32.5px] bg-[#ffffff4c] px-4 pb-6 pt-2 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    {rows.map((row) => (
                      <div key={row.label} className="flex min-h-[74px] items-center border-b border-[#d9ddd8] py-3 last:border-b-0">
                        <div className="font-nunito text-[30px] font-semibold leading-[1.1] text-[#5e6567]">
                          {renderCell(row.starter)}
                        </div>
                      </div>
                    ))}
                    <Link to="/upload" className={`${choosePlanButtonClass} mt-6`}>
                      <span className="relative z-[2] font-nunito text-xl font-semibold text-[#2b3335]">Выбрать</span>
                    </Link>
                  </div>
                  <div className="rounded-[32.5px] bg-[#ffffff4c] px-4 pb-6 pt-2 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    {rows.map((row) => (
                      <div key={row.label} className="flex min-h-[74px] items-center border-b border-[#d9ddd8] py-3 last:border-b-0">
                        <div className="font-nunito text-[30px] font-semibold leading-[1.1] text-[#5e6567]">
                          {renderCell(row.professional)}
                        </div>
                      </div>
                    ))}
                    <Link to="/upload" className={`${choosePlanButtonClass} mt-6`}>
                      <span className="relative z-[2] font-nunito text-xl font-semibold text-[#2b3335]">Выбрать</span>
                    </Link>
                  </div>
                  <div className="rounded-[32.5px] bg-[#ffffff4c] px-4 pb-6 pt-2 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    {rows.map((row) => (
                      <div key={row.label} className="flex min-h-[74px] items-center border-b border-[#d9ddd8] py-3 last:border-b-0">
                        <div className="font-nunito text-[30px] font-semibold leading-[1.1] text-[#5e6567]">
                          {renderCell(row.enterprise)}
                        </div>
                      </div>
                    ))}
                    <Link to="/upload" className={`${choosePlanButtonClass} mt-6`}>
                      <span className="relative z-[2] font-nunito text-xl font-semibold text-[#2b3335]">Выбрать</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SitePublicPageShell>
  );
}
