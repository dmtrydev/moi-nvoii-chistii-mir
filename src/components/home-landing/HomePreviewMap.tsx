import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import type { MapPointLicense } from '@/utils/mapPointsFromLicenses';
import { MapEnterprisePopupCard } from '@/components/map/MapEnterprisePopupCard';
import { buildMapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';

const DEFAULT_CENTER: [number, number] = [55.751244, 37.618423];
const DEFAULT_ZOOM = 5;

function MapFitBounds({ points }: { points: MapPointLicense[] }): null {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p.lat, p.lng)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, points]);
  return null;
}

function PreviewMarker({
  point,
}: {
  point: MapPointLicense;
}): JSX.Element {
  const popupModel = useMemo(
    () =>
      buildMapEnterprisePopupViewModel({
        pointAddress: point.address,
        pointInn: point.inn,
        source: point.source,
        pointLat: point.lat,
        pointLng: point.lng,
      }),
    [point],
  );

  return (
    <CircleMarker
      center={[point.lat, point.lng]}
      radius={8}
      pathOptions={{
        color: '#1f7a35',
        fillColor: '#16a34a',
        fillOpacity: 0.9,
        weight: 2,
      }}
    >
      <Popup className="moinoviichistiimir-popup">
        <MapEnterprisePopupCard model={popupModel} routeDisabled onBuildRoute={() => {}} />
      </Popup>
    </CircleMarker>
  );
}

interface HomePreviewMapProps {
  points: MapPointLicense[];
  /** Показать затемнение поверх карты во время загрузки */
  loading?: boolean;
  className?: string;
  mapClassName?: string;
}

export function HomePreviewMap({
  points,
  loading = false,
  className = '',
  mapClassName = '',
}: HomePreviewMapProps): JSX.Element {
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div className={`relative overflow-hidden rounded-[32.5px] border border-white bg-[#ffffff80] shadow-[inset_0px_0px_70.1px_#ffffffb2] ${className}`}>
      <div
        className={`relative h-[min(560px,70vh)] w-full min-h-[380px] sm:h-[min(640px,68vh)] sm:min-h-[440px] lg:h-[min(720px,65vh)] lg:min-h-[480px] ${mapClassName}`}
      >
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="absolute inset-0 z-0 h-full w-full" zoomControl>
          <TileLayer attribution={attribution} url={tileUrl} />
          {points.length > 0 ? <MapFitBounds points={points} /> : null}
          {points.map((point) => (
            <PreviewMarker key={point.key} point={point} />
          ))}
        </MapContainer>
        {loading ? (
          <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
            <span className="rounded-xl border border-white/80 bg-[#fffffff2] px-4 py-2 font-nunito text-sm font-semibold text-[#5e6567] shadow-sm">
              Обновляем карту…
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
