import { useCallback, useEffect, useRef, useState } from 'react';
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  buildCadastrePopupHtmlFromFeature,
  buildCadastrePopupHtmlFromIdentify,
} from '@/components/map/cadastrePopup';

type ParcelFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJSON.Feature[];
};

const PARCEL_STYLE: L.PathOptions = {
  color: '#D20404',
  weight: 2,
  opacity: 0.95,
  fillColor: '#D20404',
  fillOpacity: 0.06,
};

const MIN_ZOOM_PARCELS = 14;
const MIN_ZOOM_IDENTIFY = 12;

type Props = {
  enabled: boolean;
  apiBase: (path: string) => string;
};

export function CadastreVectorSystem({ enabled, apiBase }: Props): JSX.Element | null {
  const map = useMap();
  const [collection, setCollection] = useState<ParcelFeatureCollection | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPopup = useCallback(
    (latlng: L.LatLng, html: string) => {
      L.popup({
        maxWidth: 380,
        className: 'moinoviichistiimir-popup moinoviichistiimir-cadastre-popup',
        closeButton: true,
      })
        .setLatLng(latlng)
        .setContent(html)
        .openOn(map);
    },
    [map],
  );

  const runIdentify = useCallback(
    async (latlng: L.LatLng) => {
      const z = map.getZoom();
      if (z < MIN_ZOOM_IDENTIFY) {
        openPopup(
          latlng,
          `<div class="moinoviichistiimir-cadastre-card"><p style="font-size:12px;color:#64748b;margin:0">Приблизьте карту (зум ≥ ${MIN_ZOOM_IDENTIFY}), чтобы запросить сведения ПКК.</p></div>`,
        );
        return;
      }
      const { lat, lng } = latlng;
      try {
        const r = await fetch(
          apiBase(
            `/api/cadastre/identify?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&tolerance=48&typeId=1&limit=5`,
          ),
        );
        const data = await r.json();
        if (!r.ok) {
          openPopup(
            latlng,
            `<div class="moinoviichistiimir-cadastre-card"><p style="font-size:12px;color:#b45309;margin:0">${String(
              (data as { message?: string }).message ?? 'Ошибка сервера',
            )}</p></div>`,
          );
          return;
        }
        let html = buildCadastrePopupHtmlFromIdentify(data);
        if (html) {
          const f = data?.features?.[0];
          const attrs = f?.attrs ?? {};
          const cadForDetail =
            (typeof attrs.cad_num === 'string' && /^\d+:\d+:\d+:\d+/.test(attrs.cad_num) && attrs.cad_num) ||
            (typeof attrs.cn === 'string' && /^\d+:\d+:\d+:\d+/.test(attrs.cn) ? attrs.cn : null);
          if (cadForDetail) {
            try {
              const r2 = await fetch(
                apiBase(`/api/cadastre/feature/1/${encodeURIComponent(cadForDetail)}`),
              );
              const detail = await r2.json();
              const full = buildCadastrePopupHtmlFromFeature(detail);
              if (full) html = full;
            } catch {
              /* оставляем краткий ответ identify */
            }
          }
          openPopup(latlng, html);
          return;
        }
        openPopup(
          latlng,
          `<div class="moinoviichistiimir-cadastre-card"><p style="font-size:12px;color:#64748b;margin:0">Объект не найден или сервис ПКК недоступен (проверьте CADASTRE_PKK_API_BASE на сервере).</p></div>`,
        );
      } catch {
        openPopup(
          latlng,
          '<div class="moinoviichistiimir-cadastre-card"><p style="font-size:12px;color:#dc2626;margin:0">Ошибка запроса к серверу</p></div>',
        );
      }
    },
    [apiBase, map, openPopup],
  );

  const loadParcels = useCallback(() => {
    if (!enabled) {
      setCollection(null);
      return;
    }
    const z = map.getZoom();
    if (z < MIN_ZOOM_PARCELS) {
      setCollection(null);
      return;
    }
    // Leaflet иногда возвращает невалидные bounds, если карта ещё не успела
    // отрендериться/получить размеры (часто проявляется на проде/Render).
    const size = map.getSize?.();
    if (!size || size.x <= 0 || size.y <= 0) return;

    const b = map.getBounds();
    const minLon = b.getWest();
    const minLat = b.getSouth();
    const maxLon = b.getEast();
    const maxLat = b.getNorth();
    if (![minLon, minLat, maxLon, maxLat].every((n) => Number.isFinite(n))) {
      setCollection(null);
      return;
    }
    const params = new URLSearchParams({
      minLon: String(minLon),
      minLat: String(minLat),
      maxLon: String(maxLon),
      maxLat: String(maxLat),
      zoom: String(z),
    });
    fetch(apiBase(`/api/cadastre/parcels?${params.toString()}`))
      .then((r) => r.json())
      .then((data: ParcelFeatureCollection) => {
        if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) {
          setCollection(data);
        } else {
          setCollection(null);
        }
      })
      .catch(() => setCollection(null));
  }, [enabled, map, apiBase]);

  useEffect(() => {
    if (!enabled) {
      setCollection(null);
      return;
    }
    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(loadParcels, 420);
    };
    map.on('moveend', schedule);
    loadParcels();
    return () => {
      map.off('moveend', schedule);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, map, loadParcels]);

  useMapEvents({
    click(e) {
      if (!enabled) return;
      const t = e.originalEvent.target as HTMLElement | null;
      if (t?.closest?.('.leaflet-marker-icon')) return;
      if (t?.closest?.('.marker-cluster')) return;
      void runIdentify(e.latlng);
    },
  });

  const onEachFeature = useCallback(
    (_feature: GeoJSON.Feature, layer: L.Layer) => {
      layer.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        void runIdentify(ev.latlng);
      });
    },
    [runIdentify],
  );

  if (!enabled) return null;

  return (
    <>
      {collection && collection.features.length > 0 && (
        <GeoJSON
          key={collection.features.length}
          data={collection}
          style={() => PARCEL_STYLE}
          onEachFeature={onEachFeature}
        />
      )}
    </>
  );
}
