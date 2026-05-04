import { useCallback, useEffect, useState } from 'react';
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
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

const MIN_ZOOM_IDENTIFY = 12;

type Props = {
  enabled: boolean;
  apiBase: (path: string) => string;
};

export function CadastreVectorSystem({ enabled, apiBase }: Props): JSX.Element | null {
  const map = useMap();
  const [collection, setCollection] = useState<ParcelFeatureCollection | null>(null);

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
        const geo =
          data?.geojson?.type === 'FeatureCollection' && Array.isArray(data?.geojson?.features)
            ? (data.geojson as ParcelFeatureCollection)
            : null;
        setCollection(geo);
        if (html) {
          openPopup(latlng, html);
          return;
        }
        openPopup(
          latlng,
          `<div class="moinoviichistiimir-cadastre-card"><p style="font-size:12px;color:#64748b;margin:0">Объект не найден в кадастровом слое.</p></div>`,
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

  useEffect(() => {
    if (!enabled) {
      setCollection(null);
      map.closePopup();
    }
  }, [enabled, map]);

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
