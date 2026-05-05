import { Link } from 'react-router-dom';
import heroBackground from '@/assets/home-landing/hero-background.png';
import { VidMenuCheckboxChecked } from '@/components/home-landing/VidMenuCheckbox';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';

type FeatureRow = {
  label: string;
  starter: CellValue;
  professional: CellValue;
  enterprise: CellValue;
};

type CellValue =
  | { kind: 'check' }
  | { kind: 'price'; value: string }
  | { kind: 'text'; value: string };

type PlanKey = 'starter' | 'professional' | 'enterprise';

type PlanDefinition = {
  key: PlanKey;
  title: string;
};

const includedCell: CellValue = { kind: 'check' };

const plans: PlanDefinition[] = [
  { key: 'starter', title: 'starter:' },
  { key: 'professional', title: 'professional:' },
  { key: 'enterprise', title: 'enterprise:' },
];

const rows: FeatureRow[] = [
  {
    label: 'ежемесячная оплата:',
    starter: { kind: 'price', value: '60 000 ₽' },
    professional: { kind: 'price', value: '180 000 ₽' },
    enterprise: { kind: 'price', value: 'от 550 000 ₽' },
  },
  {
    label: 'при оплате за год (15%):',
    starter: { kind: 'price', value: '510 000 ₽' },
    professional: { kind: 'price', value: '1 530 000 ₽' },
    enterprise: { kind: 'text', value: 'Индивидуально' },
  },
  {
    label: 'база прайс-листов и контактов',
    starter: includedCell,
    professional: includedCell,
    enterprise: includedCell,
  },
  {
    label: 'карта ж/д-тупиков (просмотр)',
    starter: includedCell,
    professional: includedCell,
    enterprise: includedCell,
  },
  {
    label: 'лимиты на запросы/экспорт',
    starter: { kind: 'text', value: 'до 50/мес' },
    professional: { kind: 'text', value: 'Безлимитно (регион)' },
    enterprise: { kind: 'text', value: 'Полный безлимит' },
  },
  {
    label: 'технология утилизации с ГЭЭ',
    starter: includedCell,
    professional: includedCell,
    enterprise: includedCell,
  },
  {
    label: 'оптимизация ж/д-логистики',
    starter: includedCell,
    professional: includedCell,
    enterprise: includedCell,
  },
  {
    label: 'консультация экспертов',
    starter: { kind: 'text', value: 'E-mail поддержка' },
    professional: { kind: 'text', value: '5 часов/vtc' },
    enterprise: { kind: 'text', value: 'Выделенный менеджер' },
  },
  {
    label: 'api и кастомные интеграции',
    starter: includedCell,
    professional: includedCell,
    enterprise: includedCell,
  },
  {
    label: 'внесение в лицензию (1 кейс)',
    starter: includedCell,
    professional: includedCell,
    enterprise: includedCell,
  },
  {
    label: 'sla и инд. отчетность',
    starter: includedCell,
    professional: includedCell,
    enterprise: includedCell,
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

const pricingGridClass = 'grid grid-cols-[437px_repeat(3,minmax(0,1fr))] gap-4';
const glassPanelClass =
  'rounded-[32.5px] bg-[#ffffff4c] px-5 pb-6 pt-2 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]';
const tariffValueTextClass =
  'font-nunito font-semibold text-[#5e6567] text-[clamp(0.9375rem,1.8vw,1.125rem)] leading-normal tracking-[0]';

function renderCell(value: CellValue): JSX.Element {
  if (value.kind === 'check') {
    return <VidMenuCheckboxChecked />;
  }

  return (
    <span className={tariffValueTextClass} data-cell-kind={value.kind}>
      {value.value}
    </span>
  );
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
                <div className={pricingGridClass}>
                  <div className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]">
                    <h2 className={filterSectionTitleClass}>возможности и модули:</h2>
                  </div>
                  {plans.map((plan) => (
                    <div
                      key={plan.key}
                      className="rounded-[25px] bg-[#ffffff4c] px-3 py-3 backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]"
                    >
                      <h2 className={`${filterSectionTitleClass} text-center`}>{plan.title}</h2>
                    </div>
                  ))}
                </div>

                <div className={`mt-3 ${pricingGridClass}`}>
                  <div className={glassPanelClass}>
                    {rows.map((row) => (
                      <div
                        key={row.label}
                        data-row-label={row.label}
                        className="flex min-h-[92px] items-center border-b border-[#d9ddd8] py-4 last:border-b-0"
                      >
                        <div className={filterSectionFeatureRowClass}>{row.label}</div>
                      </div>
                    ))}
                  </div>
                  {plans.map((plan) => (
                    <div key={plan.key} className={`${glassPanelClass} flex flex-col`} data-plan-column={plan.key}>
                      {rows.map((row) => (
                        <div
                          key={`${plan.key}-${row.label}`}
                          data-row-label={row.label}
                          className="flex min-h-[92px] items-center justify-center border-b border-[#d9ddd8] py-4 text-center last:border-b-0"
                        >
                          <div className="flex w-full items-center justify-center px-2">
                            {renderCell(row[plan.key])}
                          </div>
                        </div>
                      ))}
                      <Link to="/upload" className={`${choosePlanButtonClass} mt-6`}>
                        <span className="relative z-[2] font-nunito text-xl font-semibold text-[#2b3335]">Выбрать</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SitePublicPageShell>
  );
}
