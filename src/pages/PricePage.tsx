import { Link } from 'react-router-dom';
import heroBackground from '@/assets/home-landing/hero-background.png';
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

const headingGradientClass =
  'bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]';

function renderCell(value: string | null): JSX.Element {
  if (value == null) {
    return (
      <span className="inline-flex h-[20px] w-[20px] items-center justify-center rounded-[6px] bg-[#bcdc57] text-[13px] font-bold text-[#2b3335]">
        ✓
      </span>
    );
  }
  return <span>{value}</span>;
}

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

        <section className="relative z-10 mx-auto w-full max-w-[1920px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[32.5px] border-[none] bg-[#ffffff4c] p-4 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:p-6 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude]">
            <div className="relative z-[2] overflow-x-auto pb-2">
              <h1 className={`${headingGradientClass} typo-h3 text-[48px] leading-[1.1] whitespace-nowrap`}>
                сравнение тарифных планов экосистемы
              </h1>

              <div className="mt-4 min-w-[1820px]">
                <div className="grid grid-cols-[437px_433px_430px_433px] gap-4">
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={`${headingGradientClass} text-[40px] font-bold leading-[1.05]`}>возможности и модули:</h2>
                  </div>
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={`${headingGradientClass} text-[40px] font-bold leading-[1.05]`}>starter:</h2>
                  </div>
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={`${headingGradientClass} text-[40px] font-bold leading-[1.05]`}>professional:</h2>
                  </div>
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={`${headingGradientClass} text-[40px] font-bold leading-[1.05]`}>enterprise:</h2>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[437px_433px_430px_433px] gap-4">
                  <div className="rounded-[32.5px] bg-[#ffffff4c] px-4 pb-6 pt-2 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    {rows.map((row) => (
                      <div key={row.label} className="min-h-[74px] border-b border-[#d9ddd8] py-3 last:border-b-0">
                        <div className={`${headingGradientClass} text-[38px] font-bold leading-[1.05]`}>{row.label}</div>
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
                    <Link
                      to="/upload"
                      className="mt-6 inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)] font-nunito text-[32px] font-bold text-[#2b3335] shadow-[inset_0px_0px_20px_#ffffffbd,0px_13px_31.5px_#c1df6466]"
                    >
                      Выбрать
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
                    <Link
                      to="/upload"
                      className="mt-6 inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)] font-nunito text-[32px] font-bold text-[#2b3335] shadow-[inset_0px_0px_20px_#ffffffbd,0px_13px_31.5px_#c1df6466]"
                    >
                      Выбрать
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
                    <Link
                      to="/upload"
                      className="mt-6 inline-flex h-[60px] w-full items-center justify-center rounded-[20px] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)] font-nunito text-[32px] font-bold text-[#2b3335] shadow-[inset_0px_0px_20px_#ffffffbd,0px_13px_31.5px_#c1df6466]"
                    >
                      Выбрать
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
