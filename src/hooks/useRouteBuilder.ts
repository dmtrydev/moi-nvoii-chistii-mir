import { useCallback, useState } from 'react';

export type RouteEndpoint = {
  id: string;
  label: string;
  coords: [number, number];
};

export type RouteBuildResult = {
  path: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};

export function formatRouteDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const roundedMinutes = Math.max(1, Math.round(totalSeconds / 60));
  if (roundedMinutes < 60) return `${roundedMinutes} мин`;
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

export function formatRouteDistance(totalMeters: number): string {
  if (!Number.isFinite(totalMeters) || totalMeters <= 0) return '—';
  if (totalMeters < 1000) return `${Math.round(totalMeters)} м`;
  return `${(totalMeters / 1000).toFixed(1)} км`;
}

function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Геолокация недоступна в этом браузере.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

type OsrmRoute = {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: [number, number][] };
};

export function useRouteBuilder() {
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [routeResult, setRouteResult] = useState<RouteBuildResult | null>(null);
  const [routeStartPoint, setRouteStartPoint] = useState<RouteEndpoint | null>(null);
  const [routeTargetPoint, setRouteTargetPoint] = useState<RouteEndpoint | null>(null);

  const buildRoute = useCallback(
    async (targetLat: number, targetLng: number, targetLabel: string): Promise<void> => {
      if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) {
        setRouteError('Для выбранного объекта отсутствуют координаты.');
        return;
      }
      if (!window.isSecureContext) {
        setRouteError('Геолокация работает только в безопасном контексте (HTTPS или localhost).');
        return;
      }
      setRouteBusy(true);
      setRouteError('');
      try {
        if (navigator.permissions?.query) {
          const permissionState = await navigator.permissions.query({ name: 'geolocation' });
          if (permissionState.state === 'denied') {
            throw new Error('Доступ к геолокации заблокирован в браузере. Разрешите его в настройках сайта.');
          }
        }
        const position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        const pointA: RouteEndpoint = {
          id: 'geo:client',
          label: 'Моё местоположение',
          coords: [position.coords.latitude, position.coords.longitude],
        };
        const pointB: RouteEndpoint = {
          id: `target:${targetLat.toFixed(6)}:${targetLng.toFixed(6)}`,
          label: targetLabel,
          coords: [targetLat, targetLng],
        };
        setRouteStartPoint(pointA);
        setRouteTargetPoint(pointB);
        const [aLat, aLng] = pointA.coords;
        const [bLat, bLng] = pointB.coords;
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${encodeURIComponent(String(aLng))},${encodeURIComponent(String(aLat))};` +
          `${encodeURIComponent(String(bLng))},${encodeURIComponent(String(bLat))}` +
          `?overview=full&alternatives=false&steps=false&geometries=geojson`;
        const response = await fetch(url);
        const payload = (await response.json()) as { routes?: OsrmRoute[] };
        if (!response.ok || !Array.isArray(payload?.routes) || payload.routes.length === 0) {
          throw new Error('Маршрут не найден для выбранных точек.');
        }
        const best = payload.routes[0] as OsrmRoute;
        const coordinates = Array.isArray(best?.geometry?.coordinates) ? best.geometry!.coordinates! : [];
        const path = coordinates
          .filter((pair) => Array.isArray(pair) && pair.length >= 2)
          .map((pair) => [pair[1], pair[0]] as [number, number]);
        if (path.length < 2) throw new Error('Не удалось построить линию маршрута.');
        setRouteResult({
          path,
          distanceMeters: Number(best?.distance ?? 0),
          durationSeconds: Number(best?.duration ?? 0),
        });
      } catch (error) {
        setRouteResult(null);
        setRouteError(error instanceof Error ? error.message : 'Ошибка построения маршрута.');
      } finally {
        setRouteBusy(false);
      }
    },
    [],
  );

  const resetRoute = useCallback(() => {
    setRouteStartPoint(null);
    setRouteTargetPoint(null);
    setRouteResult(null);
    setRouteError('');
  }, []);

  return {
    routeBusy,
    routeError,
    routeResult,
    routeStartPoint,
    routeTargetPoint,
    buildRoute,
    resetRoute,
  };
}
