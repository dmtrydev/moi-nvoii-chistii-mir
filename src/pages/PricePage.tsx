import { Link } from 'react-router-dom';
import heroBackground from '@/assets/home-landing/hero-background.png';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';

type PlanKey = 'starter' | 'professional' | 'enterprise';

type FeatureRow = {
  label: string;
  starter: string;
  professional: string;
  enterprise: string;
};

const plans: { key: PlanKey; title: string }[] = [
  { key: 'starter', title: 'starter' },
  { key: 'professional', title: 'professional' },
  { key: 'enterprise', title: 'enterprise' },
];

const rows: FeatureRow[] = [
  {
    label: 'Ежемесячная оплата',
    starter: '60 000 ₽',
    professional: '180 000 ₽',
    enterprise: 'от 550 000 ₽',
  },
  {
    label: 'При оплате за год (15%)',
    starter: '510 000 ₽',
    professional: '1 530 000 ₽',
    enterprise: 'Индивидуально',
  },
  {
    label: 'База прайс-листов и контактов',
    starter: 'Да',
    professional: 'Да',
    enterprise: 'Да',
  },
  {
    label: 'Карта ж/д тупиков (просмотр)',
    starter: 'Да',
    professional: 'Да',
    enterprise: 'Да',
  },
  {
    label: 'Лимиты на запросы / экспорт',
    starter: 'до 50 / мес',
    professional: 'Безлимитно (регион)',
    enterprise: 'Полный безлимит',
  },
  {
    label: 'Технология утилизации с ГЭЭ',
    starter: 'Нет',
    professional: 'Да',
    enterprise: 'Да',
  },
  {
    label: 'Оптимизация ж/д-логистики',
    starter: 'Нет',
    professional: 'Да',
    enterprise: 'Да',
  },
  {
    label: 'Консультация экспертов',
    starter: 'E-mail поддержка',
    professional: '5 часов / мес',
    enterprise: 'Выделенный менеджер',
  },
  {
    label: 'API и кастомные интеграции',
    starter: 'Нет',
    professional: 'Опция',
    enterprise: 'Да',
  },
  {
    label: 'Внесение в лицензию (1 кейс)',
    starter: 'Нет',
    professional: 'Опция',
    enterprise: 'Да',
  },
  {
    label: 'SLA и индивидуальная отчетность',
    starter: 'Нет',
    professional: 'Опция',
    enterprise: 'Да',
  },
];

const headingGradientClass =
  'bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]';

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
          <div className="relative overflow-hidden rounded-[32.5px] border-[none] bg-[#ffffff4c] p-4 backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] sm:p-6 lg:p-8 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[32.5px] before:p-px before:content-[''] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude]">
            <div className="relative z-[2]">
              <h1
                className={`${headingGradientClass} typo-h3 text-[clamp(1.8rem,3vw,3rem)] leading-tight`}
              >
                Сравнение тарифных планов экосистемы
              </h1>

              <div className="mt-6 overflow-x-auto rounded-[24px] border border-white/80 bg-[#ffffff80]">
                <table className="min-w-[980px] w-full border-collapse">
                  <thead>
                    <tr className="border-b border-black/10">
                      <th className="px-4 py-4 text-left font-nunito text-lg font-bold text-[#2b3335]">
                        Возможности и модули
                      </th>
                      {plans.map((plan) => (
                        <th
                          key={plan.key}
                          className={`px-4 py-4 text-left text-2xl font-bold uppercase ${headingGradientClass}`}
                        >
                          {plan.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label} className="border-b border-black/10 last:border-b-0">
                        <td className="px-4 py-4 font-nunito text-base font-semibold text-[#2b3335]">
                          {row.label}
                        </td>
                        <td className="px-4 py-4 font-nunito text-base font-semibold text-[#5e6567]">{row.starter}</td>
                        <td className="px-4 py-4 font-nunito text-base font-semibold text-[#5e6567]">
                          {row.professional}
                        </td>
                        <td className="px-4 py-4 font-nunito text-base font-semibold text-[#5e6567]">{row.enterprise}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {plans.map((plan) => (
                  <Link
                    key={plan.key}
                    to="/upload"
                    className="group relative flex h-[56px] items-center justify-center overflow-hidden rounded-[20px] border-[none] px-4 shadow-[inset_0px_0px_20px_#ffffffbd,0px_13px_31.5px_#c1df6466] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] hover:opacity-95"
                  >
                    <span className="relative z-[2] font-nunito text-lg font-bold text-[#2b3335]">
                      Выбрать {plan.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </SitePublicPageShell>
  );
}
