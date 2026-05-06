import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { LicenseData } from '@/types';
import { getMapMarkerVariant, type MapMarkerVariant } from '@/utils/mapMarkerVariant';

export type MapGlobeViewPoint = {
  key: string;
  lat: number;
  lng: number;
  pointId: number | null;
  source: LicenseData;
};

const GLOBE_RADIUS = 1;

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function markerColor(variant: MapMarkerVariant): string {
  if (variant === 'storage') return '#eab308';
  if (variant === 'tech') return '#3b82f6';
  return '#bcdc57';
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

function VariantMarkerInstanced({
  points,
  variant,
  color,
  selectedId,
  onSelect,
}: {
  points: MapGlobeViewPoint[];
  variant: MapMarkerVariant;
  color: string;
  selectedId: number | null;
  onSelect: (p: MapGlobeViewPoint) => void;
}): JSX.Element | null {
  const subset = useMemo(
    () => points.filter((p) => getMapMarkerVariant(p.source.activityTypes) === variant),
    [points, variant],
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const obj = useMemo(() => new THREE.Object3D(), []);
  const markerR = 0.028 * GLOBE_RADIUS;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || subset.length === 0) return;
    subset.forEach((p, i) => {
      const v = latLngToVector3(p.lat, p.lng, GLOBE_RADIUS * 1.018);
      obj.position.copy(v);
      const sel = p.pointId != null && selectedId === p.pointId;
      obj.scale.setScalar(sel ? 1.45 : 1);
      obj.updateMatrix();
      mesh.setMatrixAt(i, obj.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [subset, selectedId, obj]);

  if (subset.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, subset.length]}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        const i = e.instanceId;
        if (i == null || i >= subset.length) return;
        onSelect(subset[i]!);
      }}
    >
      <sphereGeometry args={[markerR, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.22}
        roughness={0.45}
        metalness={0.15}
      />
    </instancedMesh>
  );
}

function GlobeScene({
  points,
  selectedId,
  onSelectPoint,
}: {
  points: MapGlobeViewPoint[];
  selectedId: number | null;
  onSelectPoint: (p: MapGlobeViewPoint) => void;
}): JSX.Element {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 3, 5]} intensity={1.35} />
      <directionalLight position={[-4, -2, -6]} intensity={0.35} color="#a5c8ff" />
      <Stars radius={420} depth={80} count={3600} factor={3.5} saturation={0} fade speed={0.6} />
      <Suspense fallback={null}>
        <EarthGlobe />
      </Suspense>
      <VariantMarkerInstanced
        points={points}
        variant="eco"
        color={markerColor('eco')}
        selectedId={selectedId}
        onSelect={onSelectPoint}
      />
      <VariantMarkerInstanced
        points={points}
        variant="storage"
        color={markerColor('storage')}
        selectedId={selectedId}
        onSelect={onSelectPoint}
      />
      <VariantMarkerInstanced
        points={points}
        variant="tech"
        color={markerColor('tech')}
        selectedId={selectedId}
        onSelect={onSelectPoint}
      />
      <OrbitControls
        enablePan={false}
        minDistance={1.55}
        maxDistance={4.2}
        rotateSpeed={0.55}
        zoomSpeed={0.65}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

type Props = {
  points: MapGlobeViewPoint[];
  selectedId: number | null;
  onSelectPoint: (p: MapGlobeViewPoint) => void;
  className?: string;
};

/**
 * 3D глобус с теми же точками и цветовой логикой маркеров, что и на Leaflet-карте.
 */
export function MapGlobeView({ points, selectedId, onSelectPoint, className = '' }: Props): JSX.Element {
  return (
    <div className={`absolute inset-0 z-0 min-h-0 w-full bg-[#050814] ${className}`.trim()}>
      <Canvas
        className="h-full w-full touch-none"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.35, 2.45], fov: 45, near: 0.05, far: 1000 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#050814', 1);
        }}
      >
        <GlobeScene points={points} selectedId={selectedId} onSelectPoint={onSelectPoint} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 text-center font-nunito text-[11px] font-semibold text-white/45 sm:left-auto sm:right-4 sm:text-left">
        Вращайте и масштабируйте · те же метки, что на карте · клик по точке — выбор объекта
      </p>
    </div>
  );
}
