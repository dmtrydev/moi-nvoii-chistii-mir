import L from 'leaflet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { MapPointLicense } from '@/utils/mapPointsFromLicenses';
import { MapEnterprisePopupCard } from '@/components/map/MapEnterprisePopupCard';
import { buildMapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';
import { MapDragThroughPopup } from '@/components/map/MapDragThroughPopup';
import {
  formatRouteDistance,
  formatRouteDuration,
  useRouteBuilder,
} from '@/hooks/useRouteBuilder';

const DEFAULT_CENTER: [number, number] = [55.751244, 37.618423];
const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 14;

type SiteCandidate = {
  pointId: number | null;
  lat: number;
  lng: number;
  label: string;
};

function buildEnterpriseKey(point: MapPointLicense): string {
  const inn = String(point.inn || '').trim();
  if (inn && inn !== 'не указан') return `inn:${inn}`;
  const name = String(point.companyName || '').trim().toLowerCase();
  return `name:${name}`;
}

function MapFitBounds({ points }: { points: MapPointLicense[] }): null {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p.lat, p.lng)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, points]);
  return null;
}

function MapFocusController({
  center,
  zoom,
}: {
  center: [number, number] | null;
  zoom?: number;
}): null {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.7 });
  }, [center, zoom, map]);
  return null;
}

function PreviewMarker({
  point,
  siteCandidates,
  onBuildRoute,
  onSwitchSite,
  routeBusy,
}: {
  point: MapPointLicense;
  siteCandidates: SiteCandidate[];
  onBuildRoute: (lat: number, lng: number, label: string) => void;
  onSwitchSite: (site: { pointId: number | null; lat: number; lng: number }) => void;
  routeBusy: boolean;
}): JSX.Element {
  const popupModel = useMemo(
    () =>
      buildMapEnterprisePopupViewModel({
        pointAddress: point.address,
        pointInn: point.inn,
        source: point.source,
        pointId: point.pointId,
        pointLat: point.lat,
        pointLng: point.lng,
        siteCandidates,
      }),
    [point, siteCandidates],
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
      <Popup
        className="moinoviichistiimir-popup"
        closeOnClick={false}
        autoClose={false}
      >
        <MapEnterprisePopupCard
          model={popupModel}
          routeDisabled={routeBusy}
          onBuildRoute={() => onBuildRoute(point.lat, point.lng, point.address)}
          onSwitchSite={onSwitchSite}
        />
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
  const [focusCenter, setFocusCenter] = useState<[number, number] | null>(null);

  const {
    routeBusy,
    routeError,
    routeResult,
    routeStartPoint,
    routeTargetPoint,
    buildRoute,
    resetRoute,
  } = useRouteBuilder();

  const handleBuildRoute = useCallback(
    (lat: number, lng: number, label: string) => {
      void buildRoute(lat, lng, label);
    },
    [buildRoute],
  );

  const handleSwitchSite = useCallback(
    (site: { pointId: number | null; lat: number; lng: number }) => {
      setFocusCenter([site.lat, site.lng]);
    },
    [],
  );

  const siteCandidatesByEnterprise = useMemo(() => {
    const byEnterprise = new Map<string, SiteCandidate[]>();
    const seenByEnterprise = new Map<string, Set<string>>();

    points.forEach((point) => {
      const key = buildEnterpriseKey(point);
      const seen = seenByEnterprise.get(key) ?? new Set<string>();
      const list = byEnterprise.get(key) ?? [];
      const dedupeKey =
        point.pointId != null
          ? `id:${point.pointId}`
          : `coord:${point.lat.toFixed(6)}:${point.lng.toFixed(6)}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        seenByEnterprise.set(key, seen);
        const fallbackLabel = list.length === 0 ? 'Основная площадка' : `Площадка ${list.length + 1}`;
        list.push({
          pointId: point.pointId,
          lat: point.lat,
          lng: point.lng,
          label: point.siteLabel || fallbackLabel,
        });
        byEnterprise.set(key, list);
      }
    });

    return byEnterprise;
  }, [points]);

  return (
    <div
      className={`relative overflow-hidden rounded-[32.5px] border border-white bg-[#ffffff80] shadow-[inset_0px_0px_70.1px_#ffffffb2] ${className}`}
    >
      <div
        className={`relative h-[min(560px,70vh)] w-full min-h-[380px] sm:h-[min(640px,68vh)] sm:min-h-[440px] lg:h-[min(720px,65vh)] lg:min-h-[480px] ${mapClassName}`}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="absolute inset-0 z-0 h-full w-full"
          zoomControl
          attributionControl={false}
          closePopupOnClick={false}
        >
          <TileLayer url={tileUrl} />
          <MapDragThroughPopup />
          {points.length > 0 ? <MapFitBounds points={points} /> : null}
          <MapFocusController center={focusCenter} zoom={FOCUSED_ZOOM} />
          {routeResult && (
            <Polyline
              positions={routeResult.path}
              pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.85 }}
            />
          )}
          {routeStartPoint && (
            <CircleMarker
              center={routeStartPoint.coords}
              radius={7}
              pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
            />
          )}
          {routeTargetPoint && (
            <CircleMarker
              center={routeTargetPoint.coords}
              radius={7}
              pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}
            />
          )}
          {points.map((point) => {
            const enterpriseKey = buildEnterpriseKey(point);
            const siteCandidates = siteCandidatesByEnterprise.get(enterpriseKey) ?? [];
            return (
              <PreviewMarker
                key={point.key}
                point={point}
                siteCandidates={siteCandidates}
                onBuildRoute={handleBuildRoute}
                onSwitchSite={handleSwitchSite}
                routeBusy={routeBusy}
              />
            );
          })}
        </MapContainer>

        {(routeError || routeResult) && (
          <div className="pointer-events-auto absolute left-4 right-4 top-4 z-[400] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-[340px]">
            {routeError ? (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm">
                {routeError}
              </div>
            ) : null}
            {routeResult ? (
              <div className="rounded-xl border border-white bg-[#ffffffe6] px-3 py-2 text-sm font-semibold text-[#2b3335] shadow-[0_8px_24px_rgba(43,51,53,0.15)]">
                В пути: {formatRouteDuration(routeResult.durationSeconds)} | Расстояние:{' '}
                {formatRouteDistance(routeResult.distanceMeters)}
              </div>
            ) : null}
            {routeResult ? (
              <button
                type="button"
                onClick={resetRoute}
                className="h-9 rounded-xl border border-black/[0.08] bg-white/90 px-3 text-xs font-semibold text-[#2b3335] hover:bg-white"
              >
                Сбросить маршрут
              </button>
            ) : null}
          </div>
        )}

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
