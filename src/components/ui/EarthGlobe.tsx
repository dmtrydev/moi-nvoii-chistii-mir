import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh } from 'three';

// Начальный поворот: Россия в кадре (центр ~90° в.д. — Урал/Сибирь)
const INITIAL_ROTATION_Y = -Math.PI / 2; // -90°
const ROTATE_SENSITIVITY = 0.005;

// CDN с CORS (jsdelivr), запас — процедурная текстура
const EARTH_TEXTURE_URL =
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';

/** Процедурная текстура Земли: океан + континенты */
function createEarthProceduralTexture(): THREE.Texture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Океан — градиент по глубине
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, '#1e5f74');
  oceanGrad.addColorStop(0.5, '#0d3d52');
  oceanGrad.addColorStop(1, '#0a2d3d');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  // Упрощённые «континенты» — эллипсы и дуги (вид сверху как на карте)
  ctx.fillStyle = '#2d5a3d';

  const drawLand = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rot = 0
  ) => {
    ctx.save();
    ctx.translate((cx * w) / 360 + w / 2, h / 2 - (cy * h) / 180);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale((rx * w) / 360, (ry * h) / 180);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Евразия / Азия
  drawLand(80, 20, 75, 35);
  drawLand(100, -10, 40, 25);
  // Европа
  drawLand(15, 45, 25, 18);
  // Африка
  drawLand(20, 0, 22, 45);
  // Северная Америка
  drawLand(-100, 35, 45, 35);
  drawLand(-95, 15, 35, 25);
  // Южная Америка
  drawLand(-55, -15, 25, 45);
  // Австралия
  drawLand(135, -25, 28, 22);
  // Гренландия
  drawLand(-40, 72, 18, 12);

  // Лёгкие блики на воде
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(w * 0.25, h * 0.35, w * 0.15, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function GlobeMesh(): JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const [map, setMap] = useState<THREE.Texture | null>(null);
  const [rotationY, setRotationY] = useState(INITIAL_ROTATION_Y);
  const [rotationX, setRotationX] = useState(0);
  const [cursor, setCursor] = useState<'grab' | 'grabbing'>('grab');
  const isDragging = useRef(false);
  const prevX = useRef(0);
  const prevY = useRef(0);

  // Ограничение вертикального наклона, чтобы не переворачивать глобус
  const MAX_TILT = Math.PI / 2 - 0.1;

  const proceduralTex = useMemo(
    () =>
      typeof document !== 'undefined' ? createEarthProceduralTexture() : null,
    []
  );

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      EARTH_TEXTURE_URL,
      (t) => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        t.needsUpdate = true;
        setMap(t);
      },
      undefined,
      () => setMap(proceduralTex)
    );
  }, [proceduralTex]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x = rotationX;
      meshRef.current.rotation.y = rotationY;
    }
  });

  const onPointerDown = (e: THREE.Event) => {
    e.stopPropagation();
    isDragging.current = true;
    setCursor('grabbing');
    const pe = e as unknown as React.PointerEvent;
    prevX.current = pe.clientX;
    prevY.current = pe.clientY;
  };

  const onPointerMove = (e: THREE.Event) => {
    if (!isDragging.current) return;
    const pe = e as unknown as React.PointerEvent;
    const deltaX = (pe.clientX - prevX.current) * ROTATE_SENSITIVITY;
    const deltaY = (pe.clientY - prevY.current) * ROTATE_SENSITIVITY;
    prevX.current = pe.clientX;
    prevY.current = pe.clientY;
    setRotationY((y) => y + deltaX);
    setRotationX((x) =>
      Math.max(-MAX_TILT, Math.min(MAX_TILT, x + deltaY))
    );
  };

  const stopDragging = () => {
    isDragging.current = false;
    setCursor('grab');
  };

  const texture = map ?? proceduralTex;

  return (
    <group>
      <mesh
        ref={meshRef}
        scale={1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
        style={{ cursor }}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          roughness={0.7}
          metalness={0.05}
          emissive="#051014"
          envMapIntensity={0.2}
        />
      </mesh>
      {/* Тонкая атмосфера (обводка) */}
      <mesh scale={1.015}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#1a3d4d"
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function GlobeScene(): JSX.Element {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 4, 4]} intensity={1.4} />
      <directionalLight position={[-2, -1, 2]} intensity={0.25} />
      <pointLight position={[6, 4, 5]} intensity={0.4} color="#7eb8da" />
      <GlobeMesh />
    </>
  );
}

export function EarthGlobe(): JSX.Element {
  return (
    <div className="relative w-full h-full min-w-[200px] min-h-[200px] rounded-full overflow-hidden bg-[#0a1628]">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 2.2], fov: 45 }}
        className="block w-full h-full rounded-full"
      >
        <GlobeScene />
      </Canvas>
    </div>
  );
}
