import { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import type { Group, Mesh } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { StageId } from './types';
import { ARENA_HALF_WIDTH } from './types';
import { mapFor, decorUrl } from './models';

export const STAGES: { id: StageId; name: { tr: string; en: string } }[] = [
  { id: 'colosseum', name: { tr: 'Kolezyum', en: 'Colosseum' } },
  { id: 'lava', name: { tr: 'Lav Çukuru', en: 'Lava Pit' } },
  { id: 'voxel', name: { tr: 'Blok Dünyası', en: 'Block World' } },
  { id: 'ice', name: { tr: 'Buz Tundrası', en: 'Ice Tundra' } },
  { id: 'citadel', name: { tr: 'Stormgate Kalesi', en: 'Stormgate Citadel' } },
];

/**
 * Harita GLB'sini yükler: genişliği 11.6 m'ye ölçekler, tabanı y=0'a oturtur,
 * merkezler. Dövüşçüler bu zeminle çarpışmaz (hitbox mesafe tabanlı), ama
 * arena kenarlarındaki Bounds bariyerleri her zaman kalsın — kaçış yok.
 *
 * `tweak` ile sahne başına haritayı küçültüp geri itmek mümkün (örn. kaleler
 * devasa çıkarsa dövüşçüler görünmüyor).
 */
/** Harita GLB'si bir kez loglanır (her kare yeniden çizimde spam olmasın). */
const STAGE_LOGGED = new Set<string>();

function StageModel({ url, tweak }: { url: string; tweak?: { scale?: number; z?: number } }) {
  const { scene } = useGLTF(url, false, true);
  const fit = useMemo(() => {
    const instance = cloneSkeleton(scene);
    instance.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      // Large arena GLBs are background scenery; skip costly per-mesh shadows.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    const box = new Box3().setFromObject(instance);
    const size = new Vector3();
    box.getSize(size);
    const center = new Vector3();
    box.getCenter(center);
    const scale = (11.6 / Math.max(size.x, size.z, 0.001)) * (tweak?.scale ?? 1);
    if (import.meta.env.DEV && !STAGE_LOGGED.has(url)) {
      STAGE_LOGGED.add(url);
      console.info(
        `[kavgaci] harita: ${url.split('/').pop()} size(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}) minY=${box.min.y.toFixed(2)} -> olcek=${scale.toFixed(2)} z=${tweak?.z ?? 0}`,
      );
    }
    return {
      instance,
      scale,
      offset: new Vector3(-center.x, -box.min.y, -center.z),
    };
  }, [scene, tweak?.scale, tweak?.z]);

  return (
    <group scale={fit.scale} position={[0, 0, tweak?.z ?? 0]}>
      <group position={fit.offset}>
        <primitive object={fit.instance} />
      </group>
    </group>
  );
}

/** Baykuş ve benzeri sabit süsler — `src/assets/decor/*.glb`. */
function DecorGLB({
  url,
  position,
  rotationY = 0,
  target = 0.5,
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  target?: number;
}) {
  const { scene } = useGLTF(url, false, true);
  const fit = useMemo(() => {
    const instance = cloneSkeleton(scene);
    const box = new Box3().setFromObject(instance);
    const size = new Vector3();
    box.getSize(size);
    const center = new Vector3();
    box.getCenter(center);
    const s = target / Math.max(0.001, Math.max(size.x, size.y, size.z));
    return { instance, s, offset: new Vector3(-center.x, -box.min.y, -center.z) };
  }, [scene, target]);

  return (
    <group position={position} rotation-y={rotationY} scale={fit.s}>
      <group position={fit.offset}>
        <primitive object={fit.instance} />
      </group>
    </group>
  );
}

function OwlDecor({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  const url = decorUrl('owl');
  if (!url) return null;
  return (
    <Suspense fallback={null}>
      <DecorGLB url={url} position={position} rotationY={rotationY} target={0.42} />
    </Suspense>
  );
}

/** Arena kenarında alçak bariyer — dövüşçü haritanın dışına çıkmaz. */
function Bounds({ color }: { color: string }) {
  const x = ARENA_HALF_WIDTH + 0.3;
  return (
    <>
      {[-x, x].map((px) => (
        <mesh key={px} position={[px, 0.35, 0]} receiveShadow>
          <boxGeometry args={[0.5, 0.7, 9]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[ARENA_HALF_WIDTH - 0.15, ARENA_HALF_WIDTH, 64]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
    </>
  );
}

function Embers({ count = 30, color = '#ff7a1f' }: { count?: number; color?: string }) {
  const group = useRef<Group>(null);
  const seeds = useRef(
    Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 16,
      y: Math.random() * 4,
      z: -3 - Math.random() * 6,
      s: 0.4 + Math.random() * 0.8,
    })),
  );
  useFrame(() => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const seed = seeds.current[i];
      child.position.y = (seed.y + performance.now() * 0.0004 * seed.s) % 5;
    });
  });
  return (
    <group ref={group}>
      {seeds.current.map((seed, i) => (
        <mesh key={i} position={[seed.x, seed.y, seed.z]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Colosseum() {
  const url = mapFor('colosseum');
  const columns = Array.from({ length: 13 }, (_, i) => {
    const x = -10 + i * (20 / 12);
    const z = -6.5 - Math.cos((i / 12) * Math.PI) * 1.4;
    return [x, z] as const;
  });
  return (
    <>
      <color attach="background" args={['#d9a05b']} />
      <fog attach="fog" args={['#d9a05b', 18, 42]} />
      <hemisphereLight args={['#ffe6b0', '#4a3823', 0.95]} />
      <directionalLight
        castShadow={false}
        position={[6, 13, 7]}
        intensity={1.6}
        color="#ffd9a0"
        shadow-mapSize={[512, 512]}
      />

      {url && (
        <Suspense fallback={null}>
          {/* Kolezyum modeli arkada dekor olarak durur; dövüşçüler önünde kalır. */}
          <StageModel url={url} tweak={{ scale: 1.9, z: -10 }} />
        </Suspense>
      )}

      {/* dövüş zemini — GLB zemininin hemen altında (z-fight önleme) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, 0]} receiveShadow>
        <circleGeometry args={[11, 48]} />
        <meshStandardMaterial color="#c9ac7e" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
        <ringGeometry args={[4.4, 4.75, 64]} />
        <meshStandardMaterial color="#8c6f45" />
      </mesh>

      <Bounds color="#8c6f45" />

      {/* GLB yoksa: prosedürel kolonlar */}
      {!url &&
        columns.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh castShadow position={[0, 3, 0]}>
              <cylinderGeometry args={[0.42, 0.48, 6, 10]} />
              <meshStandardMaterial color="#e8dcc2" roughness={0.9} />
            </mesh>
            <mesh position={[0, 6.2, 0]}>
              <boxGeometry args={[1.25, 0.4, 1.25]} />
              <meshStandardMaterial color="#d8c9a8" />
            </mesh>
          </group>
        ))}

      {!url && (
        <>
          {/* tribün önünde baykuş süsleri */}
          <OwlDecor position={[-5.4, 0, -2.2]} rotationY={1.6} />
          <OwlDecor position={[5.4, 0, -2.2]} rotationY={-1.6} />

          {/* üst tribün */}
          <mesh position={[0, 7.1, -8.5]}>
            <boxGeometry args={[30, 2.2, 3]} />
            <meshStandardMaterial color="#b99b6a" />
          </mesh>
          <mesh position={[0, 8.6, -8.5]}>
            <boxGeometry args={[30, 1, 3]} />
            <meshStandardMaterial color="#a2854f" />
          </mesh>
          <mesh position={[0, 5, -13]}>
            <planeGeometry args={[46, 18]} />
            <meshStandardMaterial color="#b08a48" />
          </mesh>
        </>
      )}
    </>
  );
}

function LavaPit() {
  return (
    <>
      <color attach="background" args={['#1a0d08']} />
      <fog attach="fog" args={['#250f08', 12, 34]} />
      <ambientLight intensity={0.35} color="#ff9a5a" />
      <directionalLight castShadow position={[4, 10, 6]} intensity={0.5} color="#ffb070" />
      <pointLight position={[0, 1.2, -6]} intensity={90} color="#ff5a12" distance={24} />
      <pointLight position={[-5, 1, 0]} intensity={35} color="#ff7a1f" distance={14} />
      <pointLight position={[5, 1, 0]} intensity={35} color="#ff7a1f" distance={14} />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 22]} />
        <meshStandardMaterial color="#2a1a16" roughness={1} />
      </mesh>

      {/* lav çatlakları */}
      {[-3.4, -1.6, 1.2, 3.6].map((x, i) => (
        <mesh key={i} position={[x, 0.015, -1 + i * 0.6]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.22, 9]} />
          <meshBasicMaterial color="#ff5a12" toneMapped={false} />
        </mesh>
      ))}

      <Bounds color="#3a2118" />

      {/* arka lav gölü */}
      <mesh position={[0, 1.6, -7.5]}>
        <boxGeometry args={[26, 3.2, 4]} />
        <meshBasicMaterial color="#ff4d10" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.6, -5.6]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[22, 3]} />
        <meshBasicMaterial color="#ff7a1f" toneMapped={false} />
      </mesh>

      {/* kaya kütleleri */}
      {[
        [-8, -4, 2.4],
        [8.4, -3.5, 2],
        [-6.5, -6, 1.6],
        [7, -6.5, 1.9],
      ].map(([x, z, s], i) => (
        <mesh key={i} position={[x, s * 0.5, z]} castShadow>
          <coneGeometry args={[s, s * 2, 5]} />
          <meshStandardMaterial color="#20120e" roughness={1} />
        </mesh>
      ))}

      <Embers />
    </>
  );
}

function VoxelWorld() {
  const trees = [
    [-7.5, -5],
    [7.8, -5.5],
    [-9.5, -7.5],
    [9.2, -7],
    [0, -9.5],
  ] as const;
  const clouds = [
    [-6, 7.5, -6],
    [5, 8.5, -8],
    [-1, 9.5, -11],
    [9, 7, -4],
  ] as const;
  return (
    <>
      <color attach="background" args={['#8fd0ff']} />
      <fog attach="fog" args={['#8fd0ff', 22, 48]} />
      <hemisphereLight args={['#dff0ff', '#4a6b3a', 1]} />
      <directionalLight castShadow position={[8, 14, 8]} intensity={1.5} shadow-mapSize={[1024, 1024]} />

      {/* çim zemin */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 22]} />
        <meshStandardMaterial color="#5d9c3f" roughness={1} />
      </mesh>
      {/* toprak kenar */}
      <mesh position={[0, -1.2, 0]}>
        <boxGeometry args={[40, 2.4, 22]} />
        <meshStandardMaterial color="#7a5330" roughness={1} />
      </mesh>

      <Bounds color="#8b6b3f" />

      {trees.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 1.2, 0]}>
            <boxGeometry args={[0.7, 2.4, 0.7]} />
            <meshStandardMaterial color="#6b4a28" />
          </mesh>
          <mesh castShadow position={[0, 3.1, 0]}>
            <boxGeometry args={[2.4, 1.8, 2.4]} />
            <meshStandardMaterial color="#3f8a2e" />
          </mesh>
        </group>
      ))}

      {clouds.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[3.2, 0.8, 2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
    </>
  );
}

function IceTundra() {
  return (
    <>
      <color attach="background" args={['#173048']} />
      <fog attach="fog" args={['#173048', 10, 30]} />
      <hemisphereLight args={['#dff2ff', '#1b3550', 0.9]} />
      <directionalLight castShadow position={[-5, 11, 6]} intensity={1.1} color="#cfeaff" shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 2, -7]} intensity={40} color="#4fb8ff" distance={22} />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 22]} />
        <meshStandardMaterial color="#cfe6f5" roughness={0.2} metalness={0.35} />
      </mesh>

      {/* Fırtına çizgileri ve buzlu yarıklar zemine derinlik verir. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
        <planeGeometry args={[40, 22]} />
        <meshBasicMaterial color="#dff6ff" transparent opacity={0.12} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const x = -8 + i * 2;
        return (
          <group key={`ice-ridge-${i}`} position={[x, 0, -8.5 - (i % 3) * 0.8]}>
            <mesh castShadow position={[0, 2.1 + (i % 4) * 0.35, 0]} rotation-z={(i % 2 ? 1 : -1) * 0.12}>
              <coneGeometry args={[0.65 + (i % 3) * 0.12, 4.2 + (i % 4) * 0.7, 5]} />
              <meshStandardMaterial color={i % 2 ? '#7eb9d8' : '#b8e9ff'} roughness={0.22} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.025, 0]} rotation-x={-Math.PI / 2} rotation-z={(i % 2 ? 1 : -1) * 0.2}>
              <planeGeometry args={[0.12, 4.8]} />
              <meshBasicMaterial color="#f0fcff" transparent opacity={0.72} />
            </mesh>
          </group>
        );
      })}

      <Bounds color="#9fd0ea" />

      {/* buz sütunları */}
      {[
        [-8, -5, 3.2],
        [8.2, -5.6, 2.8],
        [-5.5, -8, 2.2],
        [5.8, -8.5, 2.6],
      ].map(([x, z, h], i) => (
        <mesh key={i} position={[x, h * 0.5, z]} castShadow>
          <coneGeometry args={[h * 0.35, h, 6]} />
          <meshStandardMaterial color="#a9d8f0" transparent opacity={0.85} roughness={0.1} metalness={0.4} />
        </mesh>
      ))}

      {/* sarkan buzlar */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = -9 + i * 1.7;
        const h = 0.8 + (i % 4) * 0.5;
        return (
          <mesh key={i} position={[x, 7 - h * 0.5, -7]} rotation-z={Math.PI}>
            <coneGeometry args={[0.22, h, 5]} />
            <meshStandardMaterial color="#dff2ff" transparent opacity={0.9} />
          </mesh>
        );
      })}

      {/* arka buz duvarı */}
      <mesh position={[0, 5, -11]}>
        <planeGeometry args={[46, 16]} />
        <meshStandardMaterial color="#2b4a68" roughness={0.6} />
      </mesh>
      <mesh position={[0, 5.2, -10.85]}>
        <planeGeometry args={[46, 15.5]} />
        <meshBasicMaterial color="#72cfff" transparent opacity={0.16} />
      </mesh>
    </>
  );
}

function Citadel() {
  const url = mapFor('citadel');
  return (
    <>
      <color attach="background" args={['#241d33']} />
      <fog attach="fog" args={['#241d33', 16, 40]} />
      <hemisphereLight args={['#efe6ff', '#241b3a', 0.9]} />
      <directionalLight
        castShadow
        position={[6, 13, 7]}
        intensity={1.5}
        color="#ffd9a0"
        shadow-mapSize={[1024, 1024]}
      />

      {/* dövüş zemini — kale modelinin zemini yoksa altta bu durur */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[11, 48]} />
        <meshStandardMaterial color="#5a5266" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <ringGeometry args={[4.4, 4.75, 64]} />
        <meshStandardMaterial color="#3c3550" />
      </mesh>

      <Bounds color="#3c3550" />

      {url && (
        <Suspense fallback={null}>
          <StageModel url={url} tweak={{ scale: 0.62, z: -3.4 }} />
        </Suspense>
      )}

      {/* kale kapısının önünde baykuş süsleri */}
      <OwlDecor position={[-4.6, 0, 0.4]} rotationY={1.2} />
      <OwlDecor position={[4.6, 0, 0.4]} rotationY={-1.2} />
    </>
  );
}

export function Stage({ id }: { id: StageId }) {
  if (id === 'lava') return <LavaPit />;
  if (id === 'voxel') return <VoxelWorld />;
  if (id === 'ice') return <IceTundra />;
  if (id === 'citadel') return <Citadel />;
  return <Colosseum />;
}
