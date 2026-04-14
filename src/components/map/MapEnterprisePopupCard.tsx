import { memo } from 'react';
import type { MapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';

type Props = {
  model: MapEnterprisePopupViewModel;
};

export const MapEnterprisePopupCard = memo(function MapEnterprisePopupCard({ model }: Props): JSX.Element {
  return (
    <article className="moinoviichistiimir-popup-enterprise">
      <header className="moinoviichistiimir-popup-enterprise__head">
        <h4 className="moinoviichistiimir-popup-enterprise__title">{model.title}</h4>
        <p className="moinoviichistiimir-popup-enterprise__address">{model.subtitleAddress}</p>
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
