import { memo } from 'react';
import type { MapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';
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

type Props = {
  model: MapEnterprisePopupViewModel;
  onBuildRoute?: () => void;
  onSwitchSite?: (site: { pointId: number | null; lat: number; lng: number }) => void;
  routeDisabled?: boolean;
};

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

  return (
    <article className="moinoviichistiimir-popup-enterprise">
      <header className="moinoviichistiimir-popup-enterprise__head">
        <h3 className="typo-h3 moinoviichistiimir-popup-enterprise__title bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]">
          {model.title}
        </h3>
        <p className="moinoviichistiimir-popup-enterprise__address">{model.subtitleAddress}</p>
        {model.siteSwitches.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {model.siteSwitches.map((site) => (
              <button
                key={site.key}
                type="button"
                disabled={!onSwitchSite}
                onClick={() => onSwitchSite?.({ pointId: site.pointId, lat: site.lat, lng: site.lng })}
                className={`rounded-full border px-3 py-1 font-nunito text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-70 ${
                  site.isActive
                    ? 'border-[#bcdc57] bg-[linear-gradient(128deg,rgba(219,236,168,1)_0%,rgba(188,220,87,1)_100%)] text-[#2b3335]'
                    : 'border-white/80 bg-white/70 text-[#5e6567] hover:bg-white/90'
                }`}
              >
                {site.label}
              </button>
            ))}
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
              <div className="moinoviichistiimir-popup-enterprise__value">{item.value}</div>
            </div>
            {index < model.infoRows.length - 1 && <div className="moinoviichistiimir-popup-enterprise__divider" aria-hidden />}
          </div>
        ))}
      </div>
      <div className="mt-4">
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
