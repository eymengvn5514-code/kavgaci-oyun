import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide } from 'three';
import type { Group, Mesh, Points, PointsMaterial } from 'three';
import type { DismemberKind, FighterSide } from './types';
import { FATALITY_SECONDS } from './types';
import { audio } from '../audio/audio';

/**
 * Finisher sahnesi (Mortal Kombat tarzı).
 *
 * `dismember` hangi uzvun koptuğunu söyler — gövdeden ayrılan uzuv GERÇEK
 * iskelette kopar (GLBModel ilgili kemiği sıfıra çöktürür), burada o uzvun
 * uçan gövdesi + kan fışkırması + yerde büyüyen kan gölü oynar.
 * Labality'de uzuv gitmez; eklemler kırılır → kemik parçaları + çatlaklar.
 */
export function FatalityFx({
  victimX,
  victim,
  kind,
  dismember,
  color,
  blood,
}: {
  victimX: number;
  victim: FighterSide;
  kind: 'fatality' | 'labality';
  dismember: DismemberKind;
  /** Karakterin vurgu rengi (uzuv eti). */
  color: string;
  /** Elemente göre kan rengi. */
  blood: string;
}) {
  const spray = useRef<Points>(null);
  const headLimb = useRef<Group>(null);
  const armLimb = useRef<Group>(null);
  const shards = useRef<Group>(null);
  const crackA = useRef<Mesh>(null);
  const crackB = useRef<Mesh>(null);
  const elapsed = useRef(0);

  const away: 1 | -1 = victim === 'player' ? 1 : -1;
  const hasHead = dismember === 'head' || dismember === 'headArm';
  const hasArm = dismember === 'arm' || dismember === 'headArm';
  const broken = kind === 'labality';

  const COUNT = 240;

  const { geo, vel } = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const v = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3;
      pos[j] = 0;
      pos[j + 1] = 1.5;
      pos[j + 2] = 0;
      v[j] = 0;
      v[j + 1] = 0;
      v[j + 2] = 0;
    }
    g.setAttribute('position', new BufferAttribute(pos, 3));
    return { geo: g, vel: v };
  }, []);

  // kemik parçaları: kopma/kırılma noktalarından saçılır
  const shardData = useMemo(() => {
    const anchors: [number, number, number][] = [];
    if (hasHead) anchors.push([0, 1.5, 0]);
    if (hasArm) anchors.push([0.34 * away, 1.32, 0]);
    if (broken) anchors.push([0.2, 0.58, 0], [-0.2, 0.58, 0], [0.34, 1.32, 0], [-0.34, 1.32, 0]);
    if (anchors.length === 0) anchors.push([0, 1.2, 0]);
    const n = 20;
    const pos: [number, number, number][] = [];
    const vel: [number, number, number][] = [];
    const rot: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = anchors[i % anchors.length];
      pos.push([a[0], a[1], a[2]]);
      vel.push([(Math.random() - 0.5) * 3.2, 0.8 + Math.random() * 3.4, (Math.random() - 0.5) * 2.6]);
      rot.push([Math.random() * 6, Math.random() * 6, Math.random() * 6]);
    }
    return { pos, vel, rot, n };
  }, [hasHead, hasArm, broken, away]);

  // kemik kırılma sesleri — laboratuvar değil, dövüş.
  useEffect(() => {
    audio.bone(1);
    const t1 = setTimeout(() => audio.bone(broken ? 0.55 : 0.35), 120);
    const t2 = broken ? setTimeout(() => audio.bone(0.3), 420) : null;
    const t3 = broken ? setTimeout(() => audio.bone(0.22), 760) : null;
    const th = setTimeout(() => audio.hit(0.5), 40);
    return () => {
      clearTimeout(t1);
      clearTimeout(th);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
    };
  }, [broken]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    elapsed.current += dt;
    const t = elapsed.current;
    const life = FATALITY_SECONDS;

    // --- kan: ilk patlama + sonra boyundan sızan damlalar ---
    const pts = spray.current;
    if (pts) {
      const attr = geo.attributes.position as BufferAttribute;
      const arr = attr.array as Float32Array;
      const early = t < 0.55;
      for (let i = 0; i < COUNT; i++) {
        const j = i * 3;
        arr[j] += vel[j] * dt;
        arr[j + 1] += vel[j + 1] * dt;
        arr[j + 2] += vel[j + 2] * dt;
        vel[j + 1] -= 8.5 * dt;
        if (arr[j + 1] <= 0.02 || arr[j] < -3.6 || arr[j] > 3.6) {
          // boyun kütüğünden yeniden doğ: patlama anında geniş saçılma, sonra damlama
          arr[j] = (Math.random() - 0.5) * 0.26;
          arr[j + 1] = dismember === 'legs' ? 0.62 : hasHead || hasArm ? 1.46 : 1.2;
          arr[j + 2] = (Math.random() - 0.5) * 0.26;
          vel[j] = (Math.random() - 0.5) * (early ? 4.4 : 1.2) + away * (early ? 1.6 : 0.35);
          vel[j + 1] = early ? 1.6 + Math.random() * 3.8 : 0.1 + Math.random() * 0.6;
          vel[j + 2] = (Math.random() - 0.5) * (early ? 3.6 : 1);
        }
      }
      attr.needsUpdate = true;
      (pts.material as PointsMaterial).opacity = Math.max(0.15, 1 - t / (life + 0.4));
    }

    // --- kopan kafa: yukarı, öne, dönerek ---
    const h = headLimb.current;
    if (h) {
      const p = Math.min(1, t / 1.4);
      h.position.set(away * p * 2.7, 1.62 + p * 2.3 - p * p * 3.6, 0.12);
      h.rotation.set(p * 6.5, away * p * 4.5, -away * p * 11);
      h.visible = t < 2.3;
      h.scale.setScalar(1 - Math.max(0, (t - 1.9) / 0.4) * 0.6);
    }

    // --- kopan kol: yana, havada takla ---
    const a = armLimb.current;
    if (a) {
      const p = Math.min(1, t / 1.6);
      a.position.set(away * (0.3 + p * 2.4), 1.34 + p * 2.0 - p * p * 3.4, 0.18 + p * 0.4);
      a.rotation.set(p * 5, away * p * 6, away * p * 13);
      a.visible = t < 2.2;
    }

    // --- kemik parçaları ---
    const sg = shards.current;
    if (sg) {
      const ch = sg.children;
      for (let i = 0; i < ch.length && i < shardData.n; i++) {
        const c = ch[i];
        const v = shardData.vel[i];
        const px = shardData.pos[i][0] + v[0] * t;
        const py = Math.max(0.03, shardData.pos[i][1] + v[1] * t - 4.2 * t * t);
        const pz = shardData.pos[i][2] + v[2] * t;
        c.position.set(px, py, pz);
        const r = shardData.rot[i];
        c.rotation.set(r[0] + t * 7, r[1] + t * 5, r[2] + t * 9);
        c.scale.setScalar(Math.max(0, 1 - Math.max(0, (t - 1.7) / 0.6)));
      }
    }

    // --- çatlak halkaları (labality) ---
    for (const ref of [crackA, crackB]) {
      const m = ref.current;
      if (!m) continue;
      const delay = ref === crackB ? 0.22 : 0;
      const p = Math.min(1, Math.max(0, (t - delay) / 0.9));
      m.scale.setScalar(0.4 + p * 2.6);
      m.visible = p > 0 && p < 1;
    }
  });

  return (
    <group position={[victimX, 0, 0]}>
      {/* kopan kafa — boyun kütüğü + kafatası + çene */}
      {hasHead && (
        <group ref={headLimb} position={[0, 1.62, 0]}>
          <mesh castShadow scale={[1, 1.16, 1.04]}>
            <sphereGeometry args={[0.23, 22, 22]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.17, 0.05]}>
            <boxGeometry args={[0.24, 0.13, 0.22]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, 0.03, 0.19]}>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color="#1a0d10" roughness={0.2} />
            </mesh>
          ))}
          <mesh position={[0, -0.26, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.1, 0.12, 0.16, 12]} />
            <meshStandardMaterial color={blood} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.35, 0]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#f0e6d2" roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* kopan kol — omuz kütüğü + pazı + ön kol + yumruk */}
      {hasArm && (
        <group ref={armLimb} position={[0.34 * away, 1.34, 0.1]}>
          <mesh>
            <sphereGeometry args={[0.115, 14, 14]} />
            <meshStandardMaterial color={blood} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.085, 0.075, 0.42, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          <mesh position={[0.02, -0.6, 0.03]}>
            <cylinderGeometry args={[0.075, 0.065, 0.4, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          <mesh position={[0.03, -0.88, 0.05]}>
            <boxGeometry args={[0.16, 0.18, 0.16]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial color="#f0e6d2" roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* kemik parçaları — kırılan eklemlerden saçılır */}
      {(hasHead || hasArm || broken) && (
        <group ref={shards}>
          {Array.from({ length: shardData.n }).map((_, i) => (
            <mesh key={i}>
              <boxGeometry args={[0.07, 0.05, 0.11]} />
              <meshStandardMaterial color="#e8dcc0" roughness={0.55} />
            </mesh>
          ))}
        </group>
      )}

      {/* kan fışkırması + sürekli damlama */}
      <points ref={spray} geometry={geo} frustumCulled={false}>
        <pointsMaterial
          color={blood}
          size={0.14}
          transparent
          opacity={1}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      {/* yerde büyüyen kan gölü (kalıcı göl bu sahne biterken devralır) */}
      <BloodPool x={0} color={blood} grow />

      {/* labality: eklem çatlakları */}
      {broken && (
        <>
          <mesh ref={crackA} rotation-x={-Math.PI / 2} position={[0, 0.045, 0]}>
            <ringGeometry args={[0.55, 0.78, 40]} />
            <meshBasicMaterial color="#ffe9c9" transparent opacity={0.75} side={DoubleSide} toneMapped={false} />
          </mesh>
          <mesh ref={crackB} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
            <ringGeometry args={[0.3, 0.46, 36]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} side={DoubleSide} toneMapped={false} />
          </mesh>
        </>
      )}

      <pointLight color={broken ? '#ffd9a0' : '#ff3040'} intensity={16} distance={8} position={[0, 1.4, 0]} />
    </group>
  );
}

/**
 * Yerdeki kan gölü. Finisher sahnesinde büyür, maç boyunca kalır
 * (`grow` false iken sabit boyutta bekler).
 */
export function BloodPool({
  x,
  color,
  delay = 0,
  size = 1,
  grow = false,
}: {
  x: number;
  color: string;
  delay?: number;
  size?: number;
  /** true ise zamanla büyür (sahne içi), false ise doğrudan dolu gelir. */
  grow?: boolean;
}) {
  const g = useRef<Group>(null);
  const t = useRef(0);

  useFrame((_, raw) => {
    t.current += Math.min(raw, 0.05);
    const grp = g.current;
    if (!grp) return;
    const target = grow ? Math.min(1, Math.max(0, (t.current - delay) / 1.2)) : 1;
    const s = (0.3 + target * 0.9) * size;
    grp.scale.set(s, 1, s);
  });

  return (
    <group ref={g} position={[x, 0.012, 0]} scale={[0.3, 1, 0.3]}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1, 30]} />
        <meshBasicMaterial color={color} transparent opacity={0.88} side={DoubleSide} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = i * 2.24;
        return (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[Math.cos(a) * 0.8, 0.002, Math.sin(a) * 0.8]}>
            <circleGeometry args={[0.5 + (i % 3) * 0.14, 18]} />
            <meshBasicMaterial color={color} transparent opacity={0.78} side={DoubleSide} depthWrite={false} />
          </mesh>
        );
      })}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={`s${i}`} rotation={[-Math.PI / 2, 0, i * 1.047]} position-y={0.004}>
          <planeGeometry args={[0.14, 2.3]} />
          <meshBasicMaterial color={color} transparent opacity={0.62} side={DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
