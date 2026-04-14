import { memo } from 'react';
import type { MapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';
import sborActiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-sbor-active.svg';
import transportActiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-transport-active.svg';
import neutralizationInactiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-neutralization-inactive.svg';
import processingInactiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-processing-inactive.svg';
import placementActiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-placement-active.svg';
import utilizationInactiveIcon from '@/assets/home-landing/activity-strip/enterprise-activity-utilization-inactive.svg';

type Props = {
  model: MapEnterprisePopupViewModel;
};

export const MapEnterprisePopupCard = memo(function MapEnterprisePopupCard({ model }: Props): JSX.Element {
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
        <p className="typo-h6 moinoviichistiimir-popup-enterprise__address">{model.subtitleAddress}</p>
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
              <div className="typo-h5 moinoviichistiimir-popup-enterprise__label">{item.label}</div>
              <div className="typo-h6 moinoviichistiimir-popup-enterprise__value">{item.value}</div>
            </div>
            {index < model.infoRows.length - 1 && <div className="moinoviichistiimir-popup-enterprise__divider" aria-hidden />}
          </div>
        ))}
      </div>
    </article>
  );
});
