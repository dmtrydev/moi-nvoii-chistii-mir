import { memo } from 'react';
import { Leaf, Snowflake, Sun, Trash2, Truck, Warehouse } from 'lucide-react';
import type { MapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';

type Props = {
  model: MapEnterprisePopupViewModel;
};

export const MapEnterprisePopupCard = memo(function MapEnterprisePopupCard({ model }: Props): JSX.Element {
  const statusIcons = [
    { id: 'snowflake', Icon: Snowflake, active: true, label: 'Статус 1' },
    { id: 'truck', Icon: Truck, active: true, label: 'Статус 2' },
    { id: 'sun', Icon: Sun, active: false, label: 'Статус 3' },
    { id: 'trash', Icon: Trash2, active: false, label: 'Статус 4' },
    { id: 'warehouse', Icon: Warehouse, active: true, label: 'Статус 5' },
    { id: 'leaf', Icon: Leaf, active: false, label: 'Статус 6' },
  ] as const;

  return (
    <article className="moinoviichistiimir-popup-enterprise">
      <header className="moinoviichistiimir-popup-enterprise__head">
        <h4 className="moinoviichistiimir-popup-enterprise__title typo-h3 bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]">
          {model.title}
        </h4>
        <p className="moinoviichistiimir-popup-enterprise__address">{model.subtitleAddress}</p>
        <div className="moinoviichistiimir-popup-enterprise__headDivider" aria-hidden />
        <div className="moinoviichistiimir-popup-enterprise__icons" aria-label="Статусы предприятия">
          {statusIcons.map(({ id, Icon, active, label }) => (
            <span
              key={id}
              title={label}
              aria-hidden
              className={`moinoviichistiimir-popup-enterprise__iconBubble ${
                active ? 'moinoviichistiimir-popup-enterprise__iconBubble--active' : ''
              }`}
            >
              <Icon className="moinoviichistiimir-popup-enterprise__icon" strokeWidth={1.8} />
            </span>
          ))}
        </div>
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
    </article>
  );
});
