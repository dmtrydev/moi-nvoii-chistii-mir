import { useCallback, useEffect, useMemo, useState } from 'react';
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
  opacity: 0.9,
  fillColor: '#D20404',
  fillOpacity: 0.18,
};

const MIN_ZOOM_IDENTIFY = 12;

type Props = {
  enabled: boolean;
  apiBase: (path: string) => string;
};

/**
 * Cadastre layer companion: handles click-to-identify on top of the
 * raster cadastre tile overlay (NSPD WMS via /api/cadastre/tiles).
 *
 * The raster tiles render every parcel boundary; this component only
 * adds an info popup and a red highlight for the clicked parcel
 * (drawn from the bbox we get from coordinates2.php — geo2.php has
 * been returning empty bodies for every cn, so we fall back to the
 * extent rectangle the same way /api/cadastre/identify does).
 */
export function CadastreVectorSystem({ enabled, apiBase }: Props): JSX.Element | null {
  const map = useMap();

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

  /** Highlights for parcels the user has clicked, keyed by _cn. */
  const [highlights, setHighlights] = useState<Map<string, GeoJSON.Feature[]>>(new Map());

  /** Click-to-identify: fetches full parcel data + highlight geometry. */
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
        const html = buildCadastrePopupHtmlFromIdentify(data);
        const geo =
          data?.geojson?.type === 'FeatureCollection' && Array.isArray(data?.geojson?.features)
            ? (data.geojson as ParcelFeatureCollection)
            : null;
        if (geo) {
          const cn = String(
            (data?.features?.[0]?.attrs?.cn ?? data?.features?.[0]?.attrs?.cad_num ?? '') as string,
          );
          setHighlights((prev) => {
            const next = new Map(prev);
            const key = cn || JSON.stringify(geo.features[0]?.geometry).slice(0, 80);
            next.set(key, geo.features);
            return next;
          });
        }
        if (html) {
          openPopup(latlng, html);
        } else {
          openPopup(
            latlng,
            `<div class="moinoviichistiimir-cadastre-card"><p style="font-size:12px;color:#64748b;margin:0">Объект не найден в кадастровом слое.</p></div>`,
          );
        }
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
      setHighlights(new Map());
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

  const highlightCollection = useMemo((): ParcelFeatureCollection => {
    const features: GeoJSON.Feature[] = [];
    highlights.forEach((fts) => features.push(...fts));
    return { type: 'FeatureCollection', features };
  }, [highlights]);

  if (!enabled) return null;

  return highlightCollection.features.length > 0 ? (
    <GeoJSON
      key={highlightCollection.features.length}
      data={highlightCollection}
      style={() => PARCEL_STYLE}
    />
  ) : null;
}
