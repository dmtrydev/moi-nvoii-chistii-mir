import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars, useTexture } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { LicenseData } from '@/types';
import { MapEnterprisePopupCard } from '@/components/map/MapEnterprisePopupCard';
import {
  buildMapEnterprisePopupViewModel,
  type MapEnterprisePopupViewModel,
} from '@/components/map/mapEnterprisePopupModel';
import { getMapMarkerVariant, type MapMarkerVariant } from '@/utils/mapMarkerVariant';
import '@/styles/map-cluster.css';

export type GlobeMapPoint = {
  key: string;
  lat: number;
  lng: number;
  pointId: number | null;
  companyName: string;
  address: string;
  inn: string;
  siteLabel: string;
  source: LicenseData;
};

/** @deprecated используйте GlobeMapPoint */
export type MapGlobeViewPoint = GlobeMapPoint;

type PopupSiteCandidate = {
  pointId: number | null;
  lat: number;
  lng: number;
  label: string;
};

const GLOBE_RADIUS = 1;
/** Ячеечная кластеризация (без «цепочек», как у текущего BFS — они склеивали тысячи точек по всей стране). */
const CLUSTER_GRID_CELL_PX = 72;
const MARKER_SURFACE_RADIUS = GLOBE_RADIUS * 1.022;
const SPIDER_RADIUS_WORLD = 0.032;
const ZOOM_CLUSTER_DIST_FACTOR = 1.38;
/** Drei Html: scale ∝ distanceFactor / dist — большой factor даёт гигантские балуны у поверхности. */
const HTML_DISTANCE_MARKER = 0.95;
const HTML_DISTANCE_POPUP = 1.25;
const MIN_CAMERA_ORBIT_RADIUS = 1.0028;
const MAX_CAMERA_ORBIT_RADIUS = 10;
/** Ниже этого расстояния камеры от центра — переходим на плоскую карту (как zoom-in в Google Maps). */
const SWITCH_TO_FLAT_RADIUS = 1.0055;
const SWITCH_TO_FLAT_RESET_RADIUS = 1.035;

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

/** Обратное к latLngToVector3 — точка на сфере единичного радиуса → [lat, lng]. */
function vectorOnGlobeToLatLng(dir: THREE.Vector3): [number, number] {
  const n = dir.clone().normalize();
  const yClamped = THREE.MathUtils.clamp(n.y, -1, 1);
  const phi = Math.acos(yClamped);
  const lat = 90 - (phi * 180) / Math.PI;
  const theta = Math.atan2(n.z, -n.x);
  let lng = (theta * 180) / Math.PI - 180;
  lng = ((lng + 540) % 360) - 180;
  return [lat, lng];
}

function centroidOnGlobe(members: GlobeMapPoint[]): THREE.Vector3 {
  const v = new THREE.Vector3();
  for (const p of members) {
    v.add(latLngToVector3(p.lat, p.lng, 1));
  }
  if (v.lengthSq() < 1e-12) return latLngToVector3(members[0]!.lat, members[0]!.lng, MARKER_SURFACE_RADIUS);
  return v.normalize().multiplyScalar(MARKER_SURFACE_RADIUS);
}

function stableClusterId(members: GlobeMapPoint[]): string {
  return [...members.map((m) => m.key)].sort().join('|');
}

function spiderTangentOffsets(n: number, radiusWorld: number, surfaceNormal: THREE.Vector3): THREE.Vector3[] {
  let t1 = new THREE.Vector3(0, 1, 0).cross(surfaceNormal);
  if (t1.lengthSq() < 1e-8) t1 = new THREE.Vector3(1, 0, 0).cross(surfaceNormal);
  t1.normalize();
  const t2 = surfaceNormal.clone().cross(t1).normalize();
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    out.push(t1.clone().multiplyScalar(Math.cos(a) * radiusWorld).add(t2.clone().multiplyScalar(Math.sin(a) * radiusWorld)));
  }
  return out;
}

function worldToScreenXY(
  world: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
): { x: number; y: number; ndcZ: number } | null {
  const v = world.clone().project(camera);
  if (v.z < -1 || v.z > 1) return null;
  const x = (v.x * 0.5 + 0.5) * width;
  const y = (-v.y * 0.5 + 0.5) * height;
  return { x, y, ndcZ: v.z };
}

function isOnFrontHemisphere(world: THREE.Vector3, camera: THREE.Camera): boolean {
  const wn = world.clone().normalize();
  const c = camera.position.clone().normalize();
  return wn.dot(c) > 0.06;
}

type ProjectedPoint = {
  point: GlobeMapPoint;
  world: THREE.Vector3;
  x: number;
  y: number;
};

function projectVisiblePoints(
  points: GlobeMapPoint[],
  camera: THREE.Camera,
  width: number,
  height: number,
): ProjectedPoint[] {
  const out: ProjectedPoint[] = [];
  for (const point of points) {
    const world = latLngToVector3(point.lat, point.lng, MARKER_SURFACE_RADIUS);
    if (!isOnFrontHemisphere(world, camera)) continue;
    const scr = worldToScreenXY(world, camera, width, height);
    if (!scr) continue;
    out.push({ point, world, x: scr.x, y: scr.y });
  }
  return out;
}

type ScreenUnion =
  | { kind: 'single'; point: GlobeMapPoint; world: THREE.Vector3 }
  | { kind: 'cluster'; id: string; members: GlobeMapPoint[]; world: THREE.Vector3; count: number };

function clusterScreenPointsGrid(projected: ProjectedPoint[], cellPx: number): ScreenUnion[] {
  const buckets = new Map<string, ProjectedPoint[]>();
  for (const p of projected) {
    const cx = Math.floor(p.x / cellPx);
    const cy = Math.floor(p.y / cellPx);
    const key = `${cx},${cy}`;
    const arr = buckets.get(key);
    if (arr) arr.push(p);
    else buckets.set(key, [p]);
  }
  const unions: ScreenUnion[] = [];
  for (const group of buckets.values()) {
    const members = group.map((g) => g.point);
    const world = centroidOnGlobe(members);
    if (members.length === 1) {
      unions.push({ kind: 'single', point: members[0]!, world: group[0]!.world });
    } else {
      unions.push({
        kind: 'cluster',
        id: stableClusterId(members),
        members,
        world,
        count: members.length,
      });
    }
  }
  return unions;
}

function expandSpiderfied(unions: ScreenUnion[], spiderfiedId: string | null): ScreenUnion[] {
  if (!spiderfiedId) return unions;
  const next: ScreenUnion[] = [];
  for (const u of unions) {
    if (u.kind === 'cluster' && u.id === spiderfiedId && u.members.length > 1) {
      const base = u.world.clone();
      const n = base.clone().normalize();
      const offs = spiderTangentOffsets(u.members.length, SPIDER_RADIUS_WORLD, n);
      u.members.forEach((pt, idx) => {
        const o = offs[idx] ?? new THREE.Vector3();
        const pos = base.clone().add(o).normalize().multiplyScalar(MARKER_SURFACE_RADIUS);
        next.push({ kind: 'single', point: pt, world: pos });
      });
    } else {
      next.push(u);
    }
  }
  return next;
}

function markerDotClassList(variant: MapMarkerVariant, selected: boolean): string {
  const parts = ['map-marker-dot'];
  if (variant === 'storage') parts.push('map-marker-dot--variant-storage');
  if (variant === 'tech') parts.push('map-marker-dot--variant-tech');
  if (selected) parts.push('map-marker-dot--emphasis');
  return parts.join(' ');
}

function clusterIconClass(count: number): string {
  const tier = count < 10 ? 'sm' : count < 100 ? 'md' : 'lg';
  return `map-cluster-icon map-cluster-icon--${tier}`;
}

function EarthGlobe(): JSX.Element {
  const texture = useTexture('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

type GlobeOverlayProps = {
  points: GlobeMapPoint[];
  siteCandidatesForPoint: (point: GlobeMapPoint) => PopupSiteCandidate[];
  selectedId: number | null;
  focusCenter: [number, number] | null;
  onSelectPoint: (point: GlobeMapPoint) => void;
  onBuildRoute: (point: GlobeMapPoint) => void;
  onSwitchSite: (site: { pointId: number | null; lat: number; lng: number }, point: GlobeMapPoint) => void;
  routeBusy: boolean;
  onClosePopup: () => void;
  /** Сильный zoom-in → переключить на плоскую карту в центре текущего обзора. */
  onApproachFlat?: (lat: number, lng: number) => void;
};

function GlobeHtmlOverlay({
  points,
  siteCandidatesForPoint,
  selectedId,
  focusCenter,
  onSelectPoint,
  onBuildRoute,
  onSwitchSite,
  routeBusy,
  onClosePopup,
  onApproachFlat,
}: GlobeOverlayProps): JSX.Element {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [unions, setUnions] = useState<ScreenUnion[]>([]);
  const [spiderfiedId, setSpiderfiedId] = useState<string | null>(null);
  const camPosPrev = useRef(new THREE.Vector3().setScalar(Number.NaN));
  const camQuatPrev = useRef(new THREE.Quaternion().set(0, 0, 0, 0));
  const lastClusterComputeRef = useRef(0);
  const zoomRafRef = useRef(0);
  const lastFocusKeyRef = useRef<string | null>(null);
  const spiderfiedIdRef = useRef(spiderfiedId);
  spiderfiedIdRef.current = spiderfiedId;
  const approachFlatFiredRef = useRef(false);
  const onApproachFlatRef = useRef(onApproachFlat);
  onApproachFlatRef.current = onApproachFlat;

  const recomputeUnions = useCallback(() => {
    const projected = projectVisiblePoints(points, camera, size.width, size.height);
    const base = clusterScreenPointsGrid(projected, CLUSTER_GRID_CELL_PX);
    setUnions(expandSpiderfied(base, spiderfiedIdRef.current));
  }, [points, camera, size.width, size.height]);

  useEffect(() => {
    return () => cancelAnimationFrame(zoomRafRef.current);
  }, []);

  useEffect(() => {
    lastClusterComputeRef.current = 0;
    recomputeUnions();
  }, [recomputeUnions, spiderfiedId]);

  useEffect(() => {
    if (!focusCenter) return;
    const key = `${focusCenter[0].toFixed(5)},${focusCenter[1].toFixed(5)}`;
    if (lastFocusKeyRef.current === key) return;
    lastFocusKeyRef.current = key;
    requestAnimationFrame(() => {
      const ctrl = controlsRef.current;
      if (!ctrl) return;
      const [lat, lng] = focusCenter;
      const dir = latLngToVector3(lat, lng, 1).normalize();
      const dist = Math.max(ctrl.minDistance, camera.position.length());
      camera.position.copy(dir.multiplyScalar(dist));
      ctrl.target.set(0, 0, 0);
      ctrl.update();
      recomputeUnions();
    });
  }, [focusCenter, camera, recomputeUnions]);

  const runClusterZoom = useCallback(
    (members: GlobeMapPoint[]) => {
      cancelAnimationFrame(zoomRafRef.current);
      const clusterDir = centroidOnGlobe(members).normalize();
      let step = 0;
      const tick = (): void => {
        const ctrl = controlsRef.current;
        if (!ctrl || step++ > 56) {
          recomputeUnions();
          return;
        }
        const minD = ctrl.minDistance;
        const len = camera.position.length();
        if (len <= minD * 1.02) {
          recomputeUnions();
          return;
        }
        const nextDist = Math.max(minD, len * 0.9);
        const curDir = camera.position.clone().normalize();
        const newDir = curDir.lerp(clusterDir, 0.16).normalize();
        camera.position.copy(newDir.multiplyScalar(nextDist));
        ctrl.target.set(0, 0, 0);
        ctrl.update();
        zoomRafRef.current = requestAnimationFrame(tick);
      };
      zoomRafRef.current = requestAnimationFrame(tick);
    },
    [camera, recomputeUnions],
  );

  useFrame(() => {
    const rCam = camera.position.length();
    const flatCb = onApproachFlatRef.current;
    if (flatCb) {
      if (rCam < SWITCH_TO_FLAT_RADIUS) {
        if (!approachFlatFiredRef.current) {
          approachFlatFiredRef.current = true;
          const surfaceDir = camera.position.clone().normalize();
          const [lat, lng] = vectorOnGlobeToLatLng(surfaceDir);
          flatCb(lat, lng);
        }
      } else if (rCam > SWITCH_TO_FLAT_RESET_RADIUS) {
        approachFlatFiredRef.current = false;
      }
    }

    const moved =
      Number.isNaN(camPosPrev.current.x) ||
      camPosPrev.current.distanceToSquared(camera.position) > 1e-7 ||
      Math.abs(camQuatPrev.current.angleTo(camera.quaternion)) > 2e-4;

    if (!moved) return;
    camPosPrev.current.copy(camera.position);
    camQuatPrev.current.copy(camera.quaternion);

    const now = performance.now();
    if (now - lastClusterComputeRef.current < 72) return;
    lastClusterComputeRef.current = now;
    recomputeUnions();
  });

  const onClusterClick = useCallback(
    (clusterId: string, members: GlobeMapPoint[]) => {
      if (spiderfiedId === clusterId) {
        setSpiderfiedId(null);
        return;
      }
      const ctrl = controlsRef.current;
      const minD = ctrl?.minDistance ?? 1.55;
      const dist = camera.position.length();

      if (dist > minD * ZOOM_CLUSTER_DIST_FACTOR) {
        setSpiderfiedId(null);
        runClusterZoom(members);
        return;
      }
      setSpiderfiedId(clusterId);
    },
    [camera, spiderfiedId, runClusterZoom],
  );

  const selectedPoint = useMemo(
    () => (selectedId == null ? null : points.find((p) => p.pointId === selectedId) ?? null),
    [points, selectedId],
  );

  const popupModel: MapEnterprisePopupViewModel | null = useMemo(() => {
    if (!selectedPoint) return null;
    return buildMapEnterprisePopupViewModel({
      pointAddress: selectedPoint.address,
      pointInn: selectedPoint.inn,
      source: selectedPoint.source,
      pointId: selectedPoint.pointId,
      pointLat: selectedPoint.lat,
      pointLng: selectedPoint.lng,
      siteCandidates: siteCandidatesForPoint(selectedPoint),
    });
  }, [selectedPoint, siteCandidatesForPoint]);

  const selectedWorld =
    selectedPoint != null ? latLngToVector3(selectedPoint.lat, selectedPoint.lng, MARKER_SURFACE_RADIUS) : null;

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={MIN_CAMERA_ORBIT_RADIUS}
        maxDistance={MAX_CAMERA_ORBIT_RADIUS}
        rotateSpeed={0.55}
        zoomSpeed={1.05}
        enableDamping
        dampingFactor={0.08}
      />

      {unions.map((u) => {
        if (u.kind === 'single') {
          const p = u.point;
          const variant = getMapMarkerVariant(p.source.activityTypes);
          const selected = selectedId != null && p.pointId != null && selectedId === p.pointId;
          return (
            <Html
              key={p.key}
              position={u.world}
              center
              distanceFactor={HTML_DISTANCE_MARKER}
              style={{ pointerEvents: 'auto' }}
              zIndexRange={[100, 0]}
            >
              <button
                type="button"
                className={markerDotClassList(variant, selected)}
                aria-label="Открыть карточку"
                onClick={(e) => {
                  e.stopPropagation();
                  setSpiderfiedId(null);
                  onSelectPoint(p);
                }}
              />
            </Html>
          );
        }
        return (
          <Html
            key={u.id}
            position={u.world}
            center
            distanceFactor={HTML_DISTANCE_MARKER}
            style={{ pointerEvents: 'auto' }}
            zIndexRange={[100, 0]}
          >
            <button
              type="button"
              className={clusterIconClass(u.count)}
              aria-label={`Кластер, объектов: ${u.count}`}
              onClick={(e) => {
                e.stopPropagation();
                onClusterClick(u.id, u.members);
              }}
            >
              {u.count}
            </button>
          </Html>
        );
      })}

      {selectedWorld && popupModel && selectedPoint && isOnFrontHemisphere(selectedWorld, camera) && (
        <Html
          position={selectedWorld.clone().add(selectedWorld.clone().normalize().multiplyScalar(0.06))}
          center
          distanceFactor={HTML_DISTANCE_POPUP}
          style={{ pointerEvents: 'auto', width: 'min(420px, calc(100vw - 48px))', maxWidth: 'min(420px, calc(100vw - 48px))' }}
          zIndexRange={[200, 100]}
        >
          <div className="relative rounded-[14px] border border-black/[0.06] bg-white shadow-[0_12px_40px_rgba(43,51,53,0.18)]">
            <button
              type="button"
              className="absolute right-3 top-3 z-[2] flex h-[30px] w-[30px] items-center justify-center rounded-full border border-white/95 bg-white/75 text-[#3a4346] transition-colors hover:bg-white/95"
              aria-label="Закрыть"
              onClick={(e) => {
                e.stopPropagation();
                onClosePopup();
              }}
            >
              <span className="relative inline-block h-3 w-3">
                <span className="absolute left-1/2 top-1/2 block h-px w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current" />
                <span className="absolute left-1/2 top-1/2 block h-px w-3 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
              </span>
            </button>
            <MapEnterprisePopupCard
              model={popupModel}
              routeDisabled={routeBusy}
              onBuildRoute={() => onBuildRoute(selectedPoint)}
              onSwitchSite={(site) => onSwitchSite(site, selectedPoint)}
            />
          </div>
        </Html>
      )}
    </>
  );
}

function GlobeScene(props: GlobeOverlayProps): JSX.Element {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 3, 5]} intensity={1.35} />
      <directionalLight position={[-4, -2, -6]} intensity={0.35} color="#a5c8ff" />
      <Stars radius={420} depth={80} count={3600} factor={3.5} saturation={0} fade speed={0.6} />
      <Suspense fallback={null}>
        <EarthGlobe />
      </Suspense>
      <GlobeHtmlOverlay {...props} />
    </>
  );
}

type Props = {
  points: GlobeMapPoint[];
  siteCandidatesForPoint: (point: GlobeMapPoint) => PopupSiteCandidate[];
  selectedId: number | null;
  focusCenter: [number, number] | null;
  onSelectPoint: (point: GlobeMapPoint) => void;
  onBuildRoute: (point: GlobeMapPoint) => void;
  onSwitchSite: (site: { pointId: number | null; lat: number; lng: number }, point: GlobeMapPoint) => void;
  routeBusy: boolean;
  onClosePopup: () => void;
  /** При сильном приближении к поверхности переключиться на плоскую подложку (как в Google Maps). */
  onApproachFlat?: (lat: number, lng: number) => void;
  className?: string;
};

/**
 * 3D глобус: те же CSS-маркеры и кластеры, что на Leaflet, карточка предприятия и переключение площадок.
 */
export function MapGlobeView({
  points,
  siteCandidatesForPoint,
  selectedId,
  focusCenter,
  onSelectPoint,
  onBuildRoute,
  onSwitchSite,
  routeBusy,
  onClosePopup,
  onApproachFlat,
  className = '',
}: Props): JSX.Element {
  return (
    <div className={`absolute inset-0 z-0 min-h-0 w-full bg-[#050814] ${className}`.trim()}>
      <Canvas
        className="h-full w-full touch-none"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.35, 2.45], fov: 42, near: 0.0004, far: 2000 }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#050814', 1);
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.near = 0.0004;
            camera.updateProjectionMatrix();
          }
        }}
      >
        <GlobeScene
          points={points}
          siteCandidatesForPoint={siteCandidatesForPoint}
          selectedId={selectedId}
          focusCenter={focusCenter}
          onSelectPoint={onSelectPoint}
          onBuildRoute={onBuildRoute}
          onSwitchSite={onSwitchSite}
          routeBusy={routeBusy}
          onClosePopup={onClosePopup}
          onApproachFlat={onApproachFlat}
        />
      </Canvas>
    </div>
  );
}
