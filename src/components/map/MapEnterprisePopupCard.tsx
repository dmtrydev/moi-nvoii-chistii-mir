import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  POPUP_CONTACTS_SUBSCRIPTION_PLACEHOLDER,
  type MapEnterprisePopupViewModel,
} from '@/components/map/mapEnterprisePopupModel';
import type { PpsState } from '@/types';
import sborActiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-sbor-active.svg';
import transportActiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-transport-active.svg';
import neutralizationInactiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-neutralization-inactive.svg';
import processingInactiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-processing-inactive.svg';
import placementActiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-placement-active.svg';
import utilizationInactiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-utilization-inactive.svg';
import routeBuildIconPlaceholder from '@/assets/map/route-build-icon-placeholder.svg';

const routeCtaDurationClass = 'duration-[600ms]';
const routeCtaLabelShiftClass = [
  'transition-transform',
  routeCtaDurationClass,
  'ease-[cubic-bezier(0.22,1,0.36,1)]',
  'motion-reduce:transition-none',
  'motion-reduce:group-hover:translate-x-0',
  'group-hover:translate-x-[calc((16px+0.5rem)/2)]',
].join(' ');

/** Блок «подписка на контакты» — та же стеклянная оболочка и кнопка, что у баннера cookie. */
function PopupContactsSubscriptionTeaser(): JSX.Element {
  return (
    <div
      className="relative w-full min-w-0 overflow-hidden rounded-[22px] border-[none] bg-[#ffffff4c] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-[10px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(10px)_brightness(100%)] before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[22px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] sm:p-[18px]"
      aria-label="Контакты организации доступны по подписке"
    >
      <div className="relative z-[2] flex flex-col">
        <p className="font-nunito text-[17px] font-semibold leading-tight text-[#2b3335] sm:text-[18px]">
          Доступ по подписке
        </p>
        <p className="mt-2 font-nunito text-sm leading-5 text-[#5e6567]">
          Телефон, e-mail и документы откроются после оформления подписки.
        </p>

        <div className="relative mt-3 min-h-[5.25rem] overflow-hidden rounded-[18px] border border-white/80 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
          <div
            className="pointer-events-none flex select-none flex-col gap-2 px-3.5 py-3.5 blur-[6px] motion-reduce:blur-[3px] motion-reduce:opacity-90 sm:px-4 sm:py-4"
            aria-hidden
          >
            <span className="font-nunito text-[13px] font-semibold tracking-wide text-[#2b3335] sm:text-sm">
              +7&nbsp;(9••)&nbsp;•••-••-••
            </span>
            <span className="font-nunito text-[13px] font-semibold tracking-wide text-[#2b3335] sm:text-sm">
              director•••@••••••.ru
            </span>
          </div>
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/10 via-white/25 to-white/45"
            aria-hidden
          >
            <div
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-white/95 bg-[#ffffff]/85 text-[#5e6567] shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-[6px] [-webkit-backdrop-filter:blur(6px)_brightness(100%)] sm:h-[52px] sm:w-[52px]"
              title="Доступно по подписке"
            >
              <svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                className="shrink-0"
                aria-hidden
              >
                <path
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <Link
          to="/price"
          className="group relative z-[2] mt-4 flex h-[52px] w-full min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-[20px] border-[none] home-find-button before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[20px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2b3335]/25 focus-visible:ring-offset-2 sm:h-[56px]"
        >
          <span className="relative z-[2] font-nunito text-lg font-semibold text-[#2b3335] sm:text-xl">
            Купить подписку
          </span>
        </Link>
      </div>
    </div>
  );
}

type Props = {
  model: MapEnterprisePopupViewModel;
  onBuildRoute?: () => void;
  onSwitchSite?: (site: { pointId: number | null; lat: number; lng: number }) => void;
  routeDisabled?: boolean;
};

/** Подпись в балуне: полная расшифровка ППС (как на странице лицензии). */
const RPN_META_PPS_LABEL = 'Периодическое подтверждение соответствия (ППС)';

/** Точка-сигнал по состоянию ППС (остальное — типографика как у карточки попапа). */
const RPN_STATE_DOT_CLASS: Record<PpsState, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
  gray: 'bg-[#9ca3a8]',
};

const navBtnBase = [
  'relative flex items-center gap-1 overflow-hidden rounded-[999px] border-[none] px-3 py-1.5',
  'font-nunito text-xs font-semibold',
  'bg-[#ffffff73] text-[#5e6567] backdrop-blur-[10px] [-webkit-backdrop-filter:blur(10px)_brightness(100%)]',
  'transition-[background-color,box-shadow,color] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
  "before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[999px] before:p-px before:content-['']",
  'before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude]',
  'before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)]',
  'hover:enabled:bg-[#ffffffa6]',
  'disabled:cursor-default disabled:opacity-40',
].join(' ');

export const MapEnterprisePopupCard = memo(function MapEnterprisePopupCard({
  model,
  onBuildRoute,
  onSwitchSite,
  routeDisabled = false,
}: Props): JSX.Element {
  const statusIcons = [
    { id: 'sbor', iconSrc: sborActiveIcon, active: true, label: 'Сбор' },
    { id: 'transport', iconSrc: transportActiveIcon, active: true, label: 'Транспортирование' },
    { id: 'neutralization', iconSrc: neutralizationInactiveIcon, active: false, label: 'Обезвреживание' },
    { id: 'processing', iconSrc: processingInactiveIcon, active: false, label: 'Обработка' },
    { id: 'placement', iconSrc: placementActiveIcon, active: true, label: 'Размещение' },
    { id: 'utilization', iconSrc: utilizationInactiveIcon, active: false, label: 'Утилизация' },
  ] as const;

  const { siteSwitches } = model;
  const total = siteSwitches.length;

  // Local index — tracks which site is currently shown inside THIS popup.
  // Initialised from the model's active site; resets whenever the popup
  // reopens for a different enterprise (model reference changes).
  const initialIdx = siteSwitches.findIndex((s) => s.isActive);
  const [localIdx, setLocalIdx] = useState(() => (initialIdx >= 0 ? initialIdx : 0));

  // Sync when the enterprise changes (different popup opened)
  useEffect(() => {
    const idx = siteSwitches.findIndex((s) => s.isActive);
    setLocalIdx(idx >= 0 ? idx : 0);
  }, [siteSwitches]);

  const effectiveIdx = Math.min(localIdx, Math.max(0, total - 1));

  function navTo(idx: number) {
    if (idx < 0 || idx >= total) return;
    setLocalIdx(idx);
    const site = siteSwitches[idx];
    if (site) onSwitchSite?.({ pointId: site.pointId, lat: site.lat, lng: site.lng });
  }

  return (
    <article className="moinoviichistiimir-popup-enterprise">
      <div
        className="moinoviichistiimir-popup-enterprise__dragHandle"
        data-map-drag-handle="true"
        aria-hidden
        title="Перетащите, чтобы двигать карту"
      />
      <header className="moinoviichistiimir-popup-enterprise__head">
        <h3 className="typo-h3 moinoviichistiimir-popup-enterprise__title bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]">
          {model.title}
        </h3>
        <p className="moinoviichistiimir-popup-enterprise__address">{model.subtitleAddress}</p>
        {model.rpnStrip ? (
          <div className="moinoviichistiimir-popup-enterprise__rpnMeta" aria-label="Реестр РПН и ППС">
            <p className="moinoviichistiimir-popup-enterprise__rpnMetaLine">
              <span className="moinoviichistiimir-popup-enterprise__rpnMetaKey">Реестр РПН</span>
              <span className="moinoviichistiimir-popup-enterprise__rpnMetaSep" aria-hidden>
                ·
              </span>
              <span
                aria-hidden
                className={`moinoviichistiimir-popup-enterprise__rpnMetaDot ${RPN_STATE_DOT_CLASS[model.rpnStrip.state]}`}
              />
              {model.enterpriseDetailsHref ? (
                <Link
                  to={model.enterpriseDetailsHref}
                  className="moinoviichistiimir-popup-enterprise__rpnMetaVal moinoviichistiimir-popup-enterprise__rpnMetaLink"
                  title="Подробная карточка организации"
                >
                  {model.rpnStrip.registryStatusText}
                </Link>
              ) : (
                <span className="moinoviichistiimir-popup-enterprise__rpnMetaVal">
                  {model.rpnStrip.registryStatusText}
                </span>
              )}
            </p>
            <p className="moinoviichistiimir-popup-enterprise__rpnMetaLine">
              <span className="moinoviichistiimir-popup-enterprise__rpnMetaKey">{RPN_META_PPS_LABEL}</span>
              <span className="moinoviichistiimir-popup-enterprise__rpnMetaSep" aria-hidden>
                ·
              </span>
              <span className="moinoviichistiimir-popup-enterprise__rpnMetaVal">{model.rpnStrip.ppsCheckText}</span>
            </p>
          </div>
        ) : null}
        {total > 1 ? (
          <div className="mb-3 mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className={navBtnBase}
              disabled={effectiveIdx === 0 || !onSwitchSite}
              onClick={() => navTo(effectiveIdx - 1)}
              aria-label="Предыдущая площадка"
            >
              <span className="relative z-[2]">Предыдущая</span>
            </button>
            <span className="shrink-0 font-nunito text-xs font-semibold text-[#5e6567]">
              Площадка {effectiveIdx + 1} из {total}
            </span>
            <button
              type="button"
              className={navBtnBase}
              disabled={effectiveIdx === total - 1 || !onSwitchSite}
              onClick={() => navTo(effectiveIdx + 1)}
              aria-label="Следующая площадка"
            >
              <span className="relative z-[2]">Следующая</span>
            </button>
          </div>
        ) : null}
        <div className="moinoviichistiimir-popup-enterprise__headDivider" aria-hidden />
        <div className="moinoviichistiimir-popup-enterprise__icons" aria-label="Статусы предприятия">
          {statusIcons.map(({ id, iconSrc, active, label }) => (
            <span key={id} className="enterprise-activity-tooltip-target" data-tooltip={label}>
              <img
                title={label}
                aria-hidden
                className={`moinoviichistiimir-popup-enterprise__iconBubble ${
                  active ? 'moinoviichistiimir-popup-enterprise__iconBubble--active' : ''
                }`}
                src={iconSrc}
                alt=""
              />
            </span>
          ))}
        </div>
        <div className="moinoviichistiimir-popup-enterprise__iconsDivider" aria-hidden />
      </header>

      <div className="moinoviichistiimir-popup-enterprise__rows">
        {model.infoRows.map((item, index) => (
          <div key={item.key} className="moinoviichistiimir-popup-enterprise__rowWrap">
            <div className="moinoviichistiimir-popup-enterprise__row">
              <div className="moinoviichistiimir-popup-enterprise__label">{item.label}</div>
              {item.key === 'contacts' && item.value === POPUP_CONTACTS_SUBSCRIPTION_PLACEHOLDER ? (
                <PopupContactsSubscriptionTeaser />
              ) : (
                <div className="moinoviichistiimir-popup-enterprise__value">{item.value}</div>
              )}
            </div>
            {index < model.infoRows.length - 1 && <div className="moinoviichistiimir-popup-enterprise__divider" aria-hidden />}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <button
          type="button"
          disabled={routeDisabled}
          onClick={onBuildRoute}
          className="group relative home-find-button flex h-[44px] w-full min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border-[none] px-4 before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded-[16px] before:p-px before:content-[''] before:[-webkit-mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[-webkit-mask-composite:xor] before:[mask-composite:exclude] before:[background:linear-gradient(132deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.3)_100%)] disabled:opacity-60"
        >
          <span className="relative z-[2] inline-flex items-center gap-2">
            <span className={`whitespace-nowrap font-nunito text-base font-bold text-[#2b3335] ${routeCtaLabelShiftClass}`}>
              Построить маршрут
            </span>
            <span
              className={`relative flex h-[16px] w-[16px] shrink-0 items-center justify-center transition-[transform,opacity] ${routeCtaDurationClass} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:pointer-events-none group-hover:translate-x-6 group-hover:opacity-0`}
            >
              <img className="h-[16px] w-[16px] object-contain pointer-events-none" alt="" src={routeBuildIconPlaceholder} />
            </span>
          </span>
        </button>
      </div>
    </article>
  );
});
