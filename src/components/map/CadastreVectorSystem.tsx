import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  fillOpacity: 0.07,
};

const MIN_ZOOM_IDENTIFY = 12;
/** Auto-grid loads parcel boundaries starting at this zoom. */
const MIN_ZOOM_GRID = 13;
const GRID_DEBOUNCE_MS = 900;

type Props = {
  enabled: boolean;
  apiBase: (path: string) => string;
};

export function CadastreVectorSystem({ enabled, apiBase }: Props): JSX.Element | null {
  const map = useMap();

  /** Popup for identify results. */
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

  /** Click-to-identify: fetches full parcel data + GeoJSON. */
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
        // Merge the clicked-parcel GeoJSON into accumulated collection
        const geo =
          data?.geojson?.type === 'FeatureCollection' && Array.isArray(data?.geojson?.features)
            ? (data.geojson as ParcelFeatureCollection)
            : null;
        if (geo) {
          setAccumulated((prev) => mergeFeatures(prev, geo.features));
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

  /**
   * Accumulated parcel features (keyed by _cn to deduplicate).
   * Parcels from different viewport loads are merged here.
   */
  const [accumulated, setAccumulated] = useState<Map<string, GeoJSON.Feature[]>>(new Map());
  const [gridLoading, setGridLoading] = useState(false);
  const gridAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Merge new features into the accumulated Map (deduplicate by _cn). */
  function mergeFeatures(
    prev: Map<string, GeoJSON.Feature[]>,
    newFeatures: GeoJSON.Feature[],
  ): Map<string, GeoJSON.Feature[]> {
    if (newFeatures.length === 0) return prev;
    const next = new Map(prev);
    for (const f of newFeatures) {
      const cn = String((f.properties as Record<string, unknown> | null)?._cn ?? '');
      if (cn && !next.has(cn)) {
        next.set(cn, [f]);
      } else if (!cn) {
        // No cn key — use stringified geometry as fallback key to avoid duplicates
        const geoKey = JSON.stringify(f.geometry).slice(0, 80);
        if (!next.has(geoKey)) next.set(geoKey, [f]);
      }
    }
    return next;
  }

  /** Load parcel grid for the current viewport. */
  const loadGrid = useCallback(async () => {
    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM_GRID) return;

    // Abort previous in-flight request
    gridAbortRef.current?.abort();
    const controller = new AbortController();
    gridAbortRef.current = controller;

    const bounds = map.getBounds();
    const gridSize = zoom >= 16 ? 5 : 4;
    const url = apiBase(
      `/api/cadastre/grid?south=${bounds.getSouth()}&west=${bounds.getWest()}&north=${bounds.getNorth()}&east=${bounds.getEast()}&grid=${gridSize}`,
    );

    setGridLoading(true);
    try {
      const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) return;
      const data = (await r.json()) as { type: string; features: GeoJSON.Feature[] };
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) return;
      setAccumulated((prev) => mergeFeatures(prev, data.features));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    } finally {
      setGridLoading(false);
    }
  }, [apiBase, map]);

  /** Debounced grid loader — fires after map stops moving. */
  const scheduleGridLoad = useCallback(() => {
    if (debounceTimerRef.current != null) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void loadGrid();
    }, GRID_DEBOUNCE_MS);
  }, [loadGrid]);

  /** Trigger initial load + clear state when enabled/disabled. */
  useEffect(() => {
    if (!enabled) {
      setAccumulated(new Map());
      setGridLoading(false);
      gridAbortRef.current?.abort();
      map.closePopup();
      return;
    }
    // Load immediately when overlay is first enabled
    void loadGrid();
  }, [enabled, loadGrid, map]);

  useMapEvents({
    moveend() {
      if (enabled) scheduleGridLoad();
    },
    zoomend() {
      if (enabled) {
        // Clear accumulation on zoom-out (parcels change scale)
        if (map.getZoom() < MIN_ZOOM_GRID) {
          setAccumulated(new Map());
          return;
        }
        scheduleGridLoad();
      }
    },
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
        void runIdentify((ev as L.LeafletMouseEvent).latlng);
      });
    },
    [runIdentify],
  );

  const mergedCollection = useMemo((): ParcelFeatureCollection => {
    const features: GeoJSON.Feature[] = [];
    accumulated.forEach((fts) => features.push(...fts));
    return { type: 'FeatureCollection', features };
  }, [accumulated]);

  if (!enabled) return null;

  return (
    <>
      {mergedCollection.features.length > 0 && (
        <GeoJSON
          key={mergedCollection.features.length}
          data={mergedCollection}
          style={() => PARCEL_STYLE}
          onEachFeature={onEachFeature}
        />
      )}
      {gridLoading && (
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5000,
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 12,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            color: '#b91c1c',
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(43,51,53,0.13)',
          }}
        >
          Загрузка участков…
        </div>
      )}
    </>
  );
}
