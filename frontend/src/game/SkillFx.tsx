import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import type { Group } from 'three';
import type { SkillId } from '../data/skills';

/**
 * Karakter başına yetenek görselleri.
 *
 * Her yeteneğin kendi arketipi var: Volt'un yıldırımı gerçekten gökten iner,
 * Crimson'ın kan emmesi rakibe yapışıp geri koparır, Gaia'nın ultisi yerden
 * yaprak fırtınası çıkarır... Yirmi karakter × dört yetenek = seksen farklı
 * kombinasyon; arketipler renk ve karakter tarifiyle ayrışır.
 *
 * Konumlandırma `Effects` tarafında yapılır (yetenek türüne göre: kendine /
 * hedefe / yere). Bu bileşen yalnızca kendi içinde oynar.
 */
export type SkillFxKind =
  | 'skyBolt'
  | 'skyStorm'
  | 'spikes'
  | 'shardSwirl'
  | 'flameSweep'
  | 'lash'
  | 'drain'
  | 'hands'
  | 'rocks'
  | 'vortex'
  | 'blades'
  | 'cloud'
  | 'pillars'
  | 'echo'
  | 'spears'
  | 'swarm'
  | 'grid'
  | 'sonic'
  | 'claw'
  | 'gravity'
  | 'columns'
  | 'afterimage'
  | 'plates'
  | 'leaves'
  | 'comet'
  | 'dashTrail'
  | 'shockRing'
  | 'quake'
  | 'explosion';

/** Yetenek görselinin doğduğu yer — hangi tarafın üstünde oynayacağı. */
export type SkillSpawn = 'self' | 'target' | 'ground';

export interface SkillFxDef {
  kind: SkillFxKind;
  /** Görselin çapası. Verilmezse yetenek türünden türetilir. */
  spawn?: SkillSpawn;
  /** Arketipin boy çarpanı (ultiler daha büyük olsun). */
  scale?: number;
}

/** Zemine yatık halka/plaka için ortak dönüş (R3F dashed prop). */
const ring = { 'rotation-x': -Math.PI / 2 } as const;

/** Deterministik sözde-rastgele (her render'da aynı düzen). */
function rnd(i: number, salt = 0): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

const SPIKE_X = [-1.3, -0.85, -0.4, 0.05, 0.5, 0.95, 1.35];
const HAND_SLOTS = [
  [-1.15, 0.2],
  [-0.7, -0.35],
  [-0.2, 0.4],
  [0.25, -0.3],
  [0.7, 0.3],
  [1.15, -0.2],
] as const;
const FLAME_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];
const CLOUD_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const LEAF_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const SWARM_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const SPEAR_SLOTS = [0, 1, 2, 3, 4, 5, 6];
const PLATE_SLOTS = [0, 1, 2, 3, 4, 5];
const ROCK_SLOTS = [0, 1, 2, 3, 4];
const CRACK_SLOTS = [0, 1, 2, 3, 4, 5];
const RING_SLOTS = [0, 1, 2, 3];
const COLUMN_SLOTS = [0, 1, 2, 3];

interface SkillFxProps {
  kind: SkillFxKind;
  color: string;
  duration: number;
  /** Rakiple aradaki mesafe (bağlantılı efektler için). */
  dist: number;
}

/**
 * Tek yetenek görseli. Üstteki `Effect` grubunun çocuğu olarak çalışır;
 * grubun kendi hareketi (mermi uçuşu, aoe büyümesi) bu bileşeni taşır.
 *
 * NOT: grubun yerel +x ekseni HER ZAMAN rakibe bakar (Effects grubu yön
 * çevirir), bu yüzden burada `facing` kullanılmaz — "arkada" demek -x.
 */
export function SkillFx({ kind, color, duration, dist }: SkillFxProps) {
  const root = useRef<Group>(null);
  const kids = useRef<Group>(null);
  const mA = useRef<Group>(null);
  const mB = useRef<Group>(null);
  const elapsed = useRef(0);

  const reach = Math.max(1.7, dist);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    elapsed.current += dt;
    const e = elapsed.current;
    const life = Math.max(0.18, duration);
    const p = Math.min(1, e / life);
    const kb = kids.current?.children;

    switch (kind) {
      case 'skyBolt':
      case 'skyStorm': {
        const bolts = kind === 'skyStorm' ? 1.06 : 1;
        const strike = 0.13 * bolts;
        const flash = e > strike && e < strike + 0.42;
        if (mB.current) mB.current.visible = flash;
        if (mA.current) {
          mA.current.visible = e > strike && e < strike + 0.5;
          mA.current.scale.set(bolts, Math.min(1, e / strike), bolts);
        }
        if (root.current) root.current.visible = e > strike * 0.6;
        if (kb) {
          const segs = kind === 'skyStorm' ? 6 : 3;
          for (let i = 0; i < kb.length; i++) {
            const c = kb[i];
            c.visible = flash;
            const s = i % segs;
            const lane = Math.floor(i / segs);
            c.position.x = Math.sin(e * 61 + i * 2.1 + lane * 3) * 0.16 + (lane - 1) * 1.25;
            c.position.y = 8 - (s + 0.5) * (8 / segs);
          }
        }
        if (kids.current && kind === 'skyStorm') kids.current.rotation.y = Math.sin(e * 3) * 0.2;
        break;
      }
      case 'spikes':
      case 'spears': {
        if (!kb) break;
        const rise = kind === 'spikes' ? 1 : 0.85;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const s = Math.max(0, Math.min(1, (e - i * 0.045) / 0.16));
          c.scale.set(1, s * rise, 1);
          c.position.y = s * rise * 0.8;
          c.rotation.z = (i % 2 ? 1 : -1) * (1 - s) * 0.25;
        }
        break;
      }
      case 'shardSwirl': {
        if (kids.current) {
          kids.current.rotation.y += dt * 9;
          kids.current.rotation.z = Math.sin(e * 6) * 0.3;
        }
        if (root.current) root.current.scale.setScalar(0.85 + Math.sin(e * 14) * 0.12);
        break;
      }
      case 'flameSweep': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const h = 0.45 + Math.abs(Math.sin(e * 15 - i * 0.55)) * 0.9;
          c.scale.set(1, h, 1);
          c.position.y = h * 0.55;
          c.position.x = -1.5 + i * 0.44 + Math.min(1.1, e * 1.6);
        }
        break;
      }
      case 'lash':
      case 'drain': {
        if (!kb) break;
        const pull = kind === 'drain' ? Math.min(1, Math.max(0, (p - 0.5) / 0.5)) : 0;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const u = (i / kb.length + e * 1.7) % 1;
          const wave = Math.sin(e * 15 + i * 1.3) * 0.11;
          c.position.set(-reach * (1 - u) * (1 - pull * 0.35), 1.05 + Math.sin(u * Math.PI) * 0.45 + wave, wave * 2);
          const s = 0.5 + Math.sin(u * Math.PI) * 0.7;
          c.scale.set(s, s, s);
        }
        if (mA.current) {
          // hedefe yapışan kütle; sonunda kopup kaynağa döner
          mA.current.position.set(-reach * pull * 0.9, 1.12, 0);
          const s = 0.75 + Math.sin(e * 18) * 0.15 + pull * 0.3;
          mA.current.scale.setScalar(s);
        }
        if (mB.current) {
          const burst = Math.min(1, Math.max(0, (p - 0.55) / 0.2));
          mB.current.visible = burst > 0 && burst < 1;
          mB.current.scale.setScalar(0.3 + burst * 1.8);
        }
        break;
      }
      case 'hands': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const s = Math.max(0, Math.min(1, (e - i * 0.06) / 0.22));
          c.scale.set(1, s, 1);
          c.position.y = s * 0.25;
          c.rotation.z = Math.sin(e * 3 + i) * 0.12;
        }
        break;
      }
      case 'rocks': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const s = Math.max(0, Math.min(1, (e - i * 0.07) / 0.2));
          c.scale.setScalar(s);
          c.position.y = -0.4 + s * 0.55;
          c.rotation.y = rnd(i, 3) * 6 + e * 0.6;
        }
        break;
      }
      case 'quake': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const s = Math.max(0, Math.min(1.6, (e - i * 0.05) / 0.3));
          c.scale.set(s, 1, s);
        }
        if (root.current) root.current.position.y = Math.sin(e * 40) * 0.03 * (1 - p);
        break;
      }
      case 'vortex': {
        if (kids.current) {
          kids.current.rotation.y += dt * 7;
          const ch = kids.current.children;
          for (let i = 0; i < ch.length; i++) {
            const s = 1 + Math.sin(e * 8 + i * 1.1) * 0.12;
            ch[i].scale.set(s, 1, s);
            ch[i].rotation.z = Math.cos(e * 4 + i) * 0.25;
          }
        }
        break;
      }
      case 'blades': {
        if (kids.current) {
          kids.current.rotation.y += dt * 13;
          kids.current.rotation.z = Math.sin(e * 5) * 0.35;
        }
        if (root.current) root.current.scale.setScalar(0.9 + Math.sin(e * 16) * 0.1);
        break;
      }
      case 'cloud': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          c.position.y += dt * 0.42;
          c.rotation.y += dt * (1 + (i % 3) * 0.4);
          const s = 1 + Math.sin(e * 5 + i) * 0.3;
          c.scale.setScalar(s);
        }
        break;
      }
      case 'pillars': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const s = Math.max(0, Math.min(1, (e - i * 0.08) / 0.18));
          c.scale.set(1, s * (1 + Math.sin(e * 9 + i) * 0.1), 1);
        }
        break;
      }
      case 'echo': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const u = (e * 1.1 + i * 0.25) % 1;
          const s = 1.9 - u * 1.7;
          c.scale.setScalar(Math.max(0.05, s));
          c.position.y = 0.06 + u * 0.9;
        }
        break;
      }
      case 'swarm': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const ang = i * 2.4 + e * 4.5;
          const rad = 1.7 * (1 - Math.min(1, e / life));
          c.position.set(Math.cos(ang) * rad, 1 + Math.sin(i * 1.7 + e * 6) * 0.35, Math.sin(ang) * rad);
          c.rotation.set(e * 6 + i, e * 5, i);
        }
        break;
      }
      case 'leaves': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const ang = i * 1.9 + e * 2.2;
          const rad = 0.3 + (i / kb.length) * 2.1;
          c.position.set(
            Math.cos(ang) * rad,
            0.2 + (i % 5) * 0.42 + Math.sin(e * 4 + i) * 0.15,
            Math.sin(ang) * rad,
          );
          c.rotation.set(e * 3 + i, e * 4 + i, e * 2 + i);
        }
        break;
      }
      case 'grid': {
        if (kids.current) {
          const s = 0.3 + Math.min(1, e / 0.35) * 0.95;
          kids.current.scale.set(s, 1, s);
          kids.current.rotation.y += dt * 1.2;
        }
        if (mA.current) {
          mA.current.rotation.y += dt * 2.4;
          mA.current.rotation.x += dt * 1.1;
          mA.current.scale.setScalar(Math.min(1, e / 0.3));
        }
        break;
      }
      case 'sonic': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const u = (e * 1.25 + i * 0.25) % 1;
          c.position.x = u * 3.1;
          const s = 0.35 + u * 2.3;
          c.scale.setScalar(s);
          c.visible = u < 0.96;
        }
        break;
      }
      case 'claw': {
        if (kids.current) {
          kids.current.rotation.z = -1.5 + Math.min(1, e / 0.22) * 2.6;
          kids.current.rotation.x = Math.sin(e * 12) * 0.1;
          const ch = kids.current.children;
          for (let i = 0; i < ch.length; i++) {
            ch[i].scale.y = 0.6 + Math.abs(Math.sin(e * 14 + i * 0.4)) * 0.8;
          }
        }
        break;
      }
      case 'gravity': {
        if (mA.current) {
          mA.current.rotation.y += dt * 3;
          mA.current.rotation.x += dt * 1.4;
          mA.current.scale.setScalar(Math.max(0.04, 1 - Math.min(1, e / life) * 0.95));
        }
        if (kb) {
          for (let i = 0; i < kb.length; i++) {
            const c = kb[i];
            const u = Math.max(0.05, 1 - Math.min(1, (e - i * 0.08) / (life * 0.7)) * 0.95);
            c.scale.setScalar(u * 2.2);
            c.position.y = 0.4 + i * 0.5 - Math.min(1, e / life) * i * 0.12;
            c.rotation.z += dt * (1 + i * 0.3);
          }
        }
        break;
      }
      case 'columns': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          c.rotation.y += dt * (1.4 + i * 0.6);
          const s = 1 + Math.sin(e * 5 + i * 1.4) * 0.18;
          c.scale.set(s, 1, s);
          c.position.y = Math.sin(e * 3 + i) * 0.06;
        }
        break;
      }
      case 'afterimage': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          c.position.x = -(i * 0.45 + e * 0.9);
          const s = Math.max(0.15, 1 - i * 0.19 - p * 0.6);
          c.scale.set(1, s, 1);
          c.visible = s > 0.18;
        }
        break;
      }
      case 'plates': {
        if (!kb) break;
        const gather = Math.min(1, e / 0.35);
        const rad = 1.35 - gather * 0.95;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          const ang = (i / kb.length) * Math.PI * 2 + e * 1.6;
          c.position.set(Math.cos(ang) * rad, 0.45 + (i % 3) * 0.55 + Math.sin(e * 5 + i) * 0.07, Math.sin(ang) * rad);
          c.rotation.y = -ang;
        }
        break;
      }
      case 'comet': {
        if (kids.current) {
          const ch = kids.current.children;
          for (let i = 0; i < ch.length; i++) {
            const c = ch[i];
            c.position.set(-(i + 1) * 0.3, Math.sin(e * 20 + i) * 0.05, Math.cos(e * 17 + i) * 0.05);
            c.scale.setScalar(1 - i * 0.13 + Math.sin(e * 18 + i) * 0.08);
          }
        }
        break;
      }
      case 'dashTrail': {
        if (!kb) break;
        for (let i = 0; i < kb.length; i++) {
          const c = kb[i];
          c.position.x = -i * 0.5;
          const s = Math.max(0.1, 1 - i * 0.2 - p * 0.7);
          c.scale.set(1, s, 1);
          c.visible = s > 0.15;
        }
        break;
      }
      case 'shockRing': {
        if (mA.current) mA.current.scale.setScalar(0.5 + p * 3.2);
        if (mB.current) mB.current.scale.setScalar(0.3 + p * 2.1);
        if (kids.current) {
          kids.current.rotation.y += dt * 5;
          const ch = kids.current.children;
          for (let i = 0; i < ch.length; i++) {
            const s = 0.6 + p * 2.4;
            ch[i].scale.setScalar(s);
            ch[i].rotation.z = e * 4 + i;
          }
        }
        break;
      }
      case 'explosion':
      default: {
        if (mA.current) mA.current.scale.setScalar(Math.max(0.2, 0.2 + p * 2.5));
        if (kb) {
          for (let i = 0; i < kb.length; i++) {
            const c = kb[i];
            const ang = (i / kb.length) * Math.PI * 2;
            c.position.set(Math.cos(ang) * p * 1.6, 0.6 + p * 0.5, Math.sin(ang) * p * 1.6);
            c.rotation.z = -ang;
          }
        }
        break;
      }
    }
  });

  const basic = (c: string, extra?: Record<string, unknown>) => (
    <meshBasicMaterial color={c} toneMapped={false} transparent side={DoubleSide} {...extra} />
  );

  switch (kind) {
    case 'skyBolt':
    case 'skyStorm':
      return (
        <group ref={root}>
          <group ref={kids}>
            {Array.from({ length: kind === 'skyStorm' ? 18 : 9 }).map((_, i) => (
              <mesh key={i}>
                <boxGeometry args={[0.15, 2.4, 0.15]} />
                {basic(i % 3 === 0 ? '#ffffff' : color)}
              </mesh>
            ))}
          </group>
          <group ref={mA}>
            <mesh position-y={4}>
              <cylinderGeometry args={[0.42, 0.62, 9, 14, 1, true]} />
              {basic(color, { opacity: 0.55 })}
            </mesh>
          </group>
          <group ref={mB}>
            <mesh {...ring} position-y={0.06}>
              <ringGeometry args={[0.5, 2.1, 44]} />
              {basic(color)}
            </mesh>
            <mesh {...ring} position-y={0.08}>
              <ringGeometry args={[2.3, 2.7, 44]} />
              {basic('#ffffff', { opacity: 0.8 })}
            </mesh>
          </group>
          <pointLight color={color} intensity={20} distance={11} position={[0, 1.7, 0]} />
        </group>
      );

    case 'spikes':
      return (
        <group ref={root}>
          <group ref={kids}>
            {SPIKE_X.map((x, i) => (
              <group key={i} position={[x, 0, (i % 2 ? 1 : -1) * 0.22]}>
                <mesh>
                  <coneGeometry args={[0.26, 1.7, 6]} />
                  {basic(color)}
                </mesh>
                <mesh position-y={0.9}>
                  <coneGeometry args={[0.09, 0.5, 5]} />
                  {basic('#ffffff', { opacity: 0.7 })}
                </mesh>
              </group>
            ))}
          </group>
          <mesh {...ring} position-y={0.05}>
            <ringGeometry args={[0.6, 1.9, 44]} />
            {basic(color, { opacity: 0.5 })}
          </mesh>
        </group>
      );

    case 'shardSwirl':
      return (
        <group ref={root}>
          <mesh>
            <octahedronGeometry args={[0.24, 0]} />
            {basic(color)}
          </mesh>
          <group ref={kids}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.cos(a) * 0.46, 0, Math.sin(a) * 0.46]}>
                  <octahedronGeometry args={[0.1, 0]} />
                  {basic('#eafcff')}
                </mesh>
              );
            })}
          </group>
        </group>
      );

    case 'flameSweep':
      return (
        <group ref={root}>
          <group ref={kids}>
            {FLAME_SLOTS.map((i) => (
              <mesh key={i} position={[-1.5 + i * 0.44, 0.5, 0]}>
                <coneGeometry args={[0.28, 1.1, 8]} />
                {basic(i % 2 ? color : '#ffd27a')}
              </mesh>
            ))}
          </group>
          <pointLight color={color} intensity={12} distance={8} position={[0, 0.7, 0]} />
        </group>
      );

    case 'lash':
    case 'drain':
      return (
        <group ref={root}>
          <group ref={kids}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <mesh key={i}>
                <sphereGeometry args={[0.13, 8, 8]} />
                {basic(i % 2 ? color : '#ffffff')}
              </mesh>
            ))}
          </group>
          <group ref={mA}>
            <mesh>
              <sphereGeometry args={[0.22, 12, 12]} />
              {basic(color)}
            </mesh>
            <mesh position-y={0.2}>
              <sphereGeometry args={[0.12, 10, 10]} />
              {basic('#ffffff', { opacity: 0.8 })}
            </mesh>
          </group>
          <group ref={mB}>
            <mesh rotation-z={Math.PI / 2}>
              <torusGeometry args={[0.5, 0.06, 6, 24]} />
              {basic(color)}
            </mesh>
          </group>
          <pointLight color={color} intensity={9} distance={7} position={[-reach * 0.5, 1.2, 0]} />
        </group>
      );

    case 'hands':
      return (
        <group ref={root}>
          <group ref={kids}>
            {HAND_SLOTS.map(([x, z], i) => (
              <group key={i} position={[x, 0, z]} rotation-y={rnd(i, 7) * 2}>
                <mesh position-y={0.55}>
                  <boxGeometry args={[0.11, 1.05, 0.16]} />
                  {basic(color)}
                </mesh>
                <mesh position-y={1.14}>
                  <boxGeometry args={[0.24, 0.2, 0.26]} />
                  {basic(color)}
                </mesh>
                <mesh position={[0, 1.34, 0.06]}>
                  <boxGeometry args={[0.24, 0.34, 0.08]} />
                  {basic(color)}
                </mesh>
              </group>
            ))}
          </group>
          <mesh {...ring} position-y={0.04}>
            <ringGeometry args={[0.9, 2.1, 44]} />
            {basic(color, { opacity: 0.45 })}
          </mesh>
        </group>
      );

    case 'rocks':
      return (
        <group ref={root}>
          <group ref={kids}>
            {ROCK_SLOTS.map((i) => (
              <mesh key={i} position={[(i - 2) * 0.52, 0, (i % 2 ? 1 : -1) * 0.3]}>
                <dodecahedronGeometry args={[0.4, 0]} />
                {basic(color)}
              </mesh>
            ))}
          </group>
          <mesh {...ring} position-y={0.05}>
            <ringGeometry args={[0.7, 2, 44]} />
            {basic(color, { opacity: 0.4 })}
          </mesh>
        </group>
      );

    case 'quake':
      return (
        <group ref={root}>
          <group ref={kids}>
            {CRACK_SLOTS.map((i) => {
              const a = (i / CRACK_SLOTS.length) * Math.PI * 2;
              return (
                <mesh key={i} {...ring} rotation-z={a} position-y={0.06 + i * 0.004}>
                  <planeGeometry args={[0.34, 2.6]} />
                  {basic(color, { opacity: 0.85 })}
                </mesh>
              );
            })}
          </group>
          <mesh {...ring} position-y={0.05}>
            <ringGeometry args={[1.4, 2.4, 44]} />
            {basic(color, { opacity: 0.45 })}
          </mesh>
        </group>
      );

    case 'vortex':
      return (
        <group ref={root}>
          <group ref={kids}>
            {RING_SLOTS.map((i) => (
              <mesh key={i} position-y={0.45 + i * 0.72}>
                <torusGeometry args={[0.42 + i * 0.2, 0.06, 8, 30]} />
                {basic(i % 2 ? color : '#ffffff')}
              </mesh>
            ))}
          </group>
          <mesh position={[0, 2.6, 0]}>
            <coneGeometry args={[0.3, 1.4, 12, 1, true]} />
            {basic(color)}
          </mesh>
        </group>
      );

    case 'blades':
      return (
        <group ref={root}>
          <group ref={kids}>
            {[0, 1, 2, 3].map((i) => (
              <group key={i} rotation-y={(i * Math.PI) / 2}>
                <mesh position={[0.85, 1, 0]}>
                  <boxGeometry args={[0.06, 1, 0.22]} />
                  {basic('#e8eefc')}
                </mesh>
                <mesh position={[0.85, 1.6, 0]}>
                  <boxGeometry args={[0.12, 0.2, 0.12]} />
                  {basic(color)}
                </mesh>
              </group>
            ))}
          </group>
        </group>
      );

    case 'cloud':
      return (
        <group ref={root}>
          <group ref={kids}>
            {CLOUD_SLOTS.map((i) => (
              <mesh
                key={i}
                position={[Math.cos(i * 2.1) * (0.3 + (i % 4) * 0.35), 0.3 + (i % 5) * 0.3, Math.sin(i * 2.1) * (0.3 + (i % 3) * 0.35)]}
              >
                <sphereGeometry args={[0.26 + (i % 3) * 0.1, 8, 8]} />
                {basic(color)}
              </mesh>
            ))}
          </group>
          <mesh {...ring} position-y={0.05}>
            <ringGeometry args={[0.8, 2.1, 44]} />
            {basic(color, { opacity: 0.4 })}
          </mesh>
        </group>
      );

    case 'pillars':
      return (
        <group ref={root}>
          <group ref={kids}>
            {[-0.85, 0, 0.85].map((x, i) => (
              <mesh key={i} position={[x, 2.4, (i - 1) * 0.2]}>
                <cylinderGeometry args={[0.2, 0.3, 4.8, 12, 1, true]} />
                {basic(i === 1 ? '#ffffff' : color, { opacity: 0.75 })}
              </mesh>
            ))}
          </group>
          <mesh {...ring} position-y={0.05}>
            <ringGeometry args={[0.9, 2.2, 44]} />
            {basic(color, { opacity: 0.5 })}
          </mesh>
          <pointLight color={color} intensity={14} distance={10} position={[0, 2, 0]} />
        </group>
      );

    case 'echo':
      return (
        <group ref={root}>
          <group ref={kids}>
            {RING_SLOTS.map((i) => (
              <mesh key={i} {...ring} position-y={0.06}>
                <torusGeometry args={[1, 0.045, 6, 34]} />
                {basic(i % 2 ? color : '#ffffff')}
              </mesh>
            ))}
          </group>
          <pointLight color={color} intensity={8} distance={7} position={[0, 1, 0]} />
        </group>
      );

    case 'spears':
      return (
        <group ref={root}>
          <group ref={kids}>
            {SPEAR_SLOTS.map((i) => (
              <group key={i} position={[(i - 3) * 0.34, 0, (i % 3) - 1]}>
                <mesh position-y={0.85}>
                  <coneGeometry args={[0.11, 1.5, 5]} />
                  {basic('#f2e9d8')}
                </mesh>
                <mesh position-y={0.2}>
                  <cylinderGeometry args={[0.14, 0.14, 0.5, 6]} />
                  {basic(color)}
                </mesh>
              </group>
            ))}
          </group>
          <mesh {...ring} position-y={0.05}>
            <ringGeometry args={[0.7, 1.9, 44]} />
            {basic(color, { opacity: 0.4 })}
          </mesh>
        </group>
      );

    case 'swarm':
      return (
        <group ref={root}>
          <group ref={kids}>
            {SWARM_SLOTS.map((i) => (
              <mesh key={i}>
                <boxGeometry args={[0.1, 0.1, 0.1]} />
                {basic(i % 3 ? color : '#ffffff')}
              </mesh>
            ))}
          </group>
        </group>
      );

    case 'grid':
      return (
        <group ref={root}>
          <group ref={kids}>
            {[-2, -1, 0, 1, 2].map((k, i) => (
              <mesh key={`x${i}`} {...ring} position={[k * 0.8, 0.05, 0]}>
                <planeGeometry args={[0.035, 3.8]} />
                {basic(color)}
              </mesh>
            ))}
            {[-2, -1, 0, 1, 2].map((k, i) => (
              <mesh key={`z${i}`} {...ring} rotation-z={Math.PI / 2} position={[0, 0.06, k * 0.8]}>
                <planeGeometry args={[0.035, 3.8]} />
                {basic(color)}
              </mesh>
            ))}
          </group>
          <group ref={mA}>
            <mesh position-y={1.1}>
              <icosahedronGeometry args={[1.15, 1]} />
              {basic(color, { wireframe: true })}
            </mesh>
          </group>
          <pointLight color={color} intensity={10} distance={8} position={[0, 1.2, 0]} />
        </group>
      );

    case 'sonic':
      return (
        <group ref={root}>
          <group ref={kids}>
            {RING_SLOTS.map((i) => (
              <mesh key={i} rotation-y={Math.PI / 2} position={[0, 1.1, 0]}>
                <torusGeometry args={[0.5, 0.09, 8, 30]} />
                {basic(i % 2 ? color : '#ffffff')}
              </mesh>
            ))}
          </group>
          <mesh {...ring} position-y={0.05}>
            <ringGeometry args={[0.6, 2, 44]} />
            {basic(color, { opacity: 0.35 })}
          </mesh>
        </group>
      );

    case 'claw':
      return (
        <group ref={root}>
          <group ref={kids} position={[0.1, 0, 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[0.45, 1.45 - i * 0.34, -0.16 + i * 0.16]}>
                <boxGeometry args={[0.06, 1.35, 0.11]} />
                {basic(i === 1 ? '#ffffff' : color)}
              </mesh>
            ))}
          </group>
          <pointLight color={color} intensity={8} distance={6} position={[0.5, 1.3, 0]} />
        </group>
      );

    case 'gravity':
      return (
        <group ref={root}>
          <group ref={mA}>
            <mesh position-y={1.15}>
              <icosahedronGeometry args={[1.25, 1]} />
              {basic(color, { wireframe: true })}
            </mesh>
          </group>
          <group ref={kids}>
            {RING_SLOTS.map((i) => (
              <mesh key={i} {...ring} position-y={0.4 + i * 0.52}>
                <torusGeometry args={[1, 0.05, 6, 32]} />
                {basic(i % 2 ? color : '#ffffff')}
              </mesh>
            ))}
          </group>
          <pointLight color={color} intensity={10} distance={9} position={[0, 1.2, 0]} />
        </group>
      );

    case 'columns':
      return (
        <group ref={root}>
          <group ref={kids}>
            {COLUMN_SLOTS.map((i) => (
              <group key={i} position={[(i - 1.5) * 0.75, 0, (i % 2 ? 0.3 : -0.3)]}>
                <mesh position-y={1.7}>
                  <cylinderGeometry args={[0.42, 0.8, 3.4, 12, 1, true]} />
                  {basic(color, { opacity: 0.7 })}
                </mesh>
                <mesh position-y={3.5}>
                  <sphereGeometry args={[0.42, 10, 10]} />
                  {basic(color, { opacity: 0.6 })}
                </mesh>
              </group>
            ))}
          </group>
          <mesh {...ring} position-y={0.05}>
            <ringGeometry args={[0.9, 2.3, 44]} />
            {basic(color, { opacity: 0.45 })}
          </mesh>
        </group>
      );

    case 'afterimage':
      return (
        <group ref={root}>
          <group ref={kids}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} position={[-i * 0.45, 0.98, 0]}>
                <boxGeometry args={[0.5, 1.9, 0.36]} />
                {basic(color, { opacity: 0.6 })}
              </mesh>
            ))}
          </group>
        </group>
      );

    case 'plates':
      return (
        <group ref={root}>
          <group ref={kids}>
            {PLATE_SLOTS.map((i) => {
              const a = (i / PLATE_SLOTS.length) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.cos(a) * 1.35, 0.45 + (i % 3) * 0.55, Math.sin(a) * 1.35]} rotation-y={-a}>
                  <boxGeometry args={[0.34, 0.42, 0.07]} />
                  {basic(color, { opacity: 0.9 })}
                </mesh>
              );
            })}
          </group>
          <group ref={mA}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.1}>
              <torusGeometry args={[0.8, 0.05, 8, 32]} />
              {basic(color, { opacity: 0.7 })}
            </mesh>
          </group>
          <pointLight color={color} intensity={6} distance={6} position={[0, 1.1, 0]} />
        </group>
      );

    case 'leaves':
      return (
        <group ref={root}>
          <group ref={kids}>
            {LEAF_SLOTS.map((i) => (
              <mesh key={i}>
                <planeGeometry args={[0.24, 0.32]} />
                {basic(i % 3 ? color : '#c9f08a')}
              </mesh>
            ))}
          </group>
        </group>
      );

    case 'comet':
      return (
        <group ref={root}>
          <mesh>
            <sphereGeometry args={[0.24, 14, 14]} />
            {basic('#ffffff')}
          </mesh>
          <group ref={kids}>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[-(i + 1) * 0.3, 0, 0]}>
                <sphereGeometry args={[0.2 - i * 0.035, 10, 10]} />
                {basic(color)}
              </mesh>
            ))}
          </group>
          <pointLight color={color} intensity={9} distance={6} />
        </group>
      );

    case 'dashTrail':
      return (
        <group ref={root}>
          <group ref={kids}>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} position={[-i * 0.5, 0.98, 0]}>
                <boxGeometry args={[0.52, 1.85, 0.4]} />
                {basic(color, { opacity: 0.55 })}
              </mesh>
            ))}
          </group>
        </group>
      );

    case 'shockRing':
      return (
        <group ref={root}>
          <group ref={mA}>
            <mesh {...ring} position-y={0.06}>
              <ringGeometry args={[0.72, 1.05, 48]} />
              {basic(color)}
            </mesh>
          </group>
          <group ref={mB}>
            <mesh {...ring} position-y={0.08}>
              <ringGeometry args={[0.3, 0.46, 40]} />
              {basic('#ffffff', { opacity: 0.85 })}
            </mesh>
          </group>
          <group ref={kids}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position-y={0.95} rotation-y={(i * Math.PI) / 3}>
                <torusGeometry args={[0.92, 0.05, 8, 32]} />
                {basic(color)}
              </mesh>
            ))}
          </group>
          <pointLight color={color} intensity={12} distance={8} position={[0, 1, 0]} />
        </group>
      );

    case 'explosion':
    default:
      return (
        <group ref={root}>
          <group ref={mA}>
            <mesh position-y={1.05}>
              <sphereGeometry args={[0.95, 16, 16]} />
              {basic(color, { opacity: 0.75 })}
            </mesh>
          </group>
          <group ref={kids}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <mesh key={i} position-y={1.05} rotation-z={-(i * Math.PI) / 4}>
                <coneGeometry args={[0.26, 1.4, 6]} />
                {basic(i % 2 ? color : '#ffffff')}
              </mesh>
            ))}
          </group>
          <pointLight color={color} intensity={16} distance={10} position={[0, 1.1, 0]} />
        </group>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Karakter başına yetenek tablosu: [E, C, Q, Ultimate]               */
/* ------------------------------------------------------------------ */

const FX = (kind: SkillFxKind, scale?: number, spawn?: SkillSpawn): SkillFxDef => ({ kind, scale, spawn });

export const SKILL_FX: Record<string, [SkillFxDef, SkillFxDef, SkillFxDef, SkillFxDef]> = {
  //                 E                        C                        Q                          ULT
  frozman: [FX('shardSwirl'), FX('spikes'), FX('plates'), FX('columns')],
  kuroi: [FX('claw', 1, 'target'), FX('blades'), FX('plates'), FX('shockRing')],
  gaia: [FX('leaves'), FX('comet'), FX('plates'), FX('vortex')],
  volt: [FX('skyBolt'), FX('comet'), FX('shockRing', 1, 'target'), FX('skyStorm', 1.15)],
  blaze: [FX('comet'), FX('flameSweep', 1, 'target'), FX('plates'), FX('explosion')],
  riptide: [FX('comet'), FX('columns'), FX('plates'), FX('vortex')],
  zephyr: [FX('blades'), FX('vortex'), FX('dashTrail'), FX('sonic')],
  titan: [FX('rocks', 1, 'target'), FX('plates'), FX('quake'), FX('quake', 1.35)],
  crimson: [FX('drain', 1, 'target'), FX('comet'), FX('plates'), FX('shockRing')],
  ghost: [FX('afterimage'), FX('cloud'), FX('hands'), FX('columns')],
  fang: [FX('claw', 1, 'target'), FX('dashTrail'), FX('plates'), FX('claw', 1.25, 'target')],
  venom: [FX('cloud'), FX('cloud', 1.2), FX('spears', 1, 'target'), FX('swarm')],
  banshee: [FX('sonic'), FX('sonic', 0.85), FX('shockRing'), FX('echo')],
  zombie: [FX('claw', 1, 'target'), FX('swarm'), FX('plates'), FX('comet')],
  cx9: [FX('comet'), FX('blades'), FX('grid'), FX('grid', 1.3)],
  wraith: [FX('afterimage'), FX('lash', 1, 'target'), FX('plates'), FX('hands')],
  ossuary: [FX('spears'), FX('spears', 1.2), FX('spikes'), FX('spears', 1.35)],
  singularity: [FX('gravity'), FX('vortex'), FX('plates'), FX('gravity', 1.3)],
  chronos: [FX('echo', 1, 'target'), FX('plates'), FX('afterimage'), FX('echo', 1.3)],
  seraph: [FX('comet'), FX('plates'), FX('pillars'), FX('pillars', 1.3)],
};

const SKILL_ORDER: SkillId[] = ['e', 'c', 'q', 'ult'];

/** Karakter + yetenek → görsel tarifi. */
export function skillFxFor(charId: string, id: SkillId): SkillFxDef {
  const row = SKILL_FX[charId];
  const idx = SKILL_ORDER.indexOf(id);
  return row?.[idx] ?? FX('explosion');
}
