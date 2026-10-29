import { memo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import type { Group, Material } from 'three';
import type { SkillKind } from '../data/skills';
import type { FighterSide, WorldRef } from './types';
import { SkillFx } from './SkillFx';
import type { SkillFxKind } from './SkillFx';

export interface EffectData {
  id: number;
  kind: SkillKind;
  /** Karaktere özel efekt katmanı (karakter + yetenek tablosundan). */
  fx?: SkillFxKind;
  /** Efekt katmanının boy çarpanı (ultiler daha büyük). */
  fxScale?: number;
  /** Rakiple aradaki mesafe — bağlantılı efektler (kan emme, kamçı) için. */
  dist: number;
  owner: FighterSide;
  /** Vuruşun kaynağı (yetenek id'si) — finisher türünü belirler. */
  src?: string;
  x: number;
  y: number;
  facing: 1 | -1;
  color: string;
  damage: number;
  range: number;
  duration: number;
  speed: number;
  stun: number;
}

interface EffectProps {
  data: EffectData;
  world: WorldRef;
  onDamage: (
    target: FighterSide,
    amount: number,
    from: FighterSide,
    stun: number,
    source?: string,
  ) => void;
  onDone: (id: number) => void;
}

/* Geometri argümanları modül düzeyinde sabit — her yeniden çizimde yeni dizi
 * oluşturulmaz (R3F args karşılaştırması gereksiz kopya yapmaz). */
const GEO = {
  orb: [0.24, 16, 16] as const,
  cone: [0.2, 0.8, 8] as const,
  ring: [0.55, 1, 40] as const,
  ring2: [0.2, 0.5, 20] as const,
  cyl: [0.95, 0.95, 1.7, 22, 1, true] as const,
  buffSphere: [0.85, 20, 20] as const,
  torus: [0.85, 0.04, 8, 32] as const,
  box: [0.5, 1.5, 0.4] as const,
  strikeBox: [0.16, 1.7, 0.75] as const,
  strikeCore: [0.3, 1.1, 0.3] as const,
};

const KATANA_SLOTS = [0, 1, 2, 3, 4, 5];

/**
 * Tek yetenek görseli. `memo` ile sarılıdır: yeni bir efekt eklendiğinde
 * diğer efektler yeniden çizilmez (performans).
 */
const Effect = memo(function Effect({ data, world, onDamage, onDone }: EffectProps) {
  const group = useRef<Group>(null);
  const blades = useRef<Group>(null);
  const elapsed = useRef(0);
  const consumed = useRef(false);
  const mats = useRef<Material[]>([]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    elapsed.current += dt;
    const t = Math.min(1, elapsed.current / data.duration);
    const g = group.current;

    let x = data.x;
    let y = data.y;
    let scale = 1;

    if (data.kind === 'projectile') {
      x = data.x + data.facing * data.speed * elapsed.current;
      y = data.y + Math.sin(elapsed.current * 16) * 0.07;

      const targetX = data.owner === 'player' ? world.current.dummyX : world.current.playerX;
      if (!consumed.current) {
        const past = data.facing === 1 ? x >= targetX - 0.45 : x <= targetX + 0.45;
        const near = Math.abs(x - targetX) < 0.75;
        if (past || near) {
          consumed.current = true;
          onDamage(
            data.owner === 'player' ? 'dummy' : 'player',
            data.damage,
            data.owner,
            data.stun,
            data.src,
          );
          onDone(data.id);
          return;
        }
      }
      if (elapsed.current >= data.duration) {
        onDone(data.id);
        return;
      }
    } else if (data.kind === 'buff') {
      x = data.owner === 'player' ? world.current.playerX : world.current.dummyX;
      scale = 1 + Math.sin(elapsed.current * 7) * 0.05;
      if (elapsed.current >= data.duration) {
        onDone(data.id);
        return;
      }
    } else if (data.kind === 'aoe') {
      y = 0;
      scale = 0.5 + t * (data.range * 0.55);
      if (elapsed.current >= data.duration) {
        onDone(data.id);
        return;
      }
    } else if (data.kind === 'dash') {
      x = data.x + data.facing * data.range * Math.min(1, t * 2.4);
      scale = 1 - t * 0.4;
      if (elapsed.current >= data.duration) {
        onDone(data.id);
        return;
      }
    } else if (data.kind === 'katana') {
      x = data.x;
      y = 0;
      scale = 1;
      if (elapsed.current >= data.duration) {
        onDone(data.id);
        return;
      }
    } else {
      x = data.fx ? data.x : data.x + data.facing * 0.85;
      scale = 1 + t * 0.5;
      if (elapsed.current >= data.duration) {
        onDone(data.id);
        return;
      }
    }

    if (g) {
      g.position.set(x, y, 0);
      g.scale.setScalar(scale * (data.fxScale ?? 1));
      g.rotation.y = data.kind === 'katana' ? 0 : data.facing === 1 ? 0 : Math.PI;

      // malzeme listesini BİR kez topla; her kare traverse yerine düz döngü
      if (mats.current.length === 0) {
        g.traverse((o) => {
          const m = (o as unknown as { material?: Material }).material;
          if (m && mats.current.length < 140 && !mats.current.includes(m)) mats.current.push(m);
        });
      }
    }

    // kılıç yağmuru — her kılıç gecikmeli düşer
    if (data.kind === 'katana' && blades.current) {
      blades.current.children.forEach((child, i) => {
        const local = Math.max(0, Math.min(1, (elapsed.current - i * 0.09) / 0.55));
        child.position.y = 6.5 - local * 6.5;
        child.rotation.z = (i % 2 ? 1 : -1) * local * 2.2;
        child.visible = local > 0 && local < 1;
      });
    }

    const alpha = 1 - t * 0.85;
    for (const m of mats.current) {
      m.transparent = true;
      m.opacity = alpha;
    }
  });

  useEffect(() => {
    mats.current = [];
  }, []);

  const color = data.color;
  const fxLayer = data.fx ? (
    <SkillFx kind={data.fx} color={color} duration={data.duration} dist={data.dist} />
  ) : null;

  if (data.kind === 'projectile') {
    return (
      <group ref={group} position={[data.x, data.y, 0]}>
        {fxLayer}
        <mesh>
          <sphereGeometry args={GEO.orb} />
          <meshBasicMaterial color={color} toneMapped={false} transparent />
        </mesh>
        <mesh position={[-data.facing * 0.5, 0, 0]} rotation-z={data.facing === 1 ? Math.PI / 2 : -Math.PI / 2}>
          <coneGeometry args={GEO.cone} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.45} />
        </mesh>
        <pointLight color={color} intensity={7} distance={5} />
      </group>
    );
  }

  if (data.kind === 'aoe') {
    return (
      <group ref={group} position={[data.x, 0, 0]}>
        {fxLayer}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
          <ringGeometry args={GEO.ring} />
          <meshBasicMaterial color={color} toneMapped={false} transparent side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={GEO.cyl} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.22} side={DoubleSide} />
        </mesh>
        <pointLight color={color} intensity={10} distance={8} position={[0, 1, 0]} />
      </group>
    );
  }

  if (data.kind === 'buff') {
    return (
      <group ref={group} position={[data.x, data.y, 0]}>
        {fxLayer}
        <mesh>
          <sphereGeometry args={GEO.buffSphere} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.2} side={DoubleSide} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2}>
          <torusGeometry args={GEO.torus} />
          <meshBasicMaterial color={color} toneMapped={false} transparent />
        </mesh>
        <pointLight color={color} intensity={5} distance={5} />
      </group>
    );
  }

  if (data.kind === 'dash') {
    return (
      <group ref={group} position={[data.x, data.y, 0]}>
        {fxLayer}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-data.facing * i * 0.45, 0, 0]}>
            <boxGeometry args={GEO.box} />
            <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.4 - i * 0.1} />
          </mesh>
        ))}
        <pointLight color={color} intensity={6} distance={5} />
      </group>
    );
  }

  // katana yağmuru
  if (data.kind === 'katana') {
    return (
      <group ref={group} position={[data.x, 0, 0]}>
        <group ref={blades}>
          {KATANA_SLOTS.map((i) => {
            const ox = -1.2 + i * 0.48;
            return (
              <group key={i} position={[ox, 6.5, 0]} rotation={[0, 0, Math.PI]}>
                <mesh>
                  <boxGeometry args={[0.06, 1.15, 0.16]} />
                  <meshBasicMaterial color="#e8eefc" toneMapped={false} transparent />
                </mesh>
                <mesh position={[0, 0.72, 0]}>
                  <boxGeometry args={[0.09, 0.3, 0.06]} />
                  <meshBasicMaterial color={color} toneMapped={false} transparent />
                </mesh>
                <mesh position={[0, 0.55, 0]}>
                  <boxGeometry args={[0.24, 0.06, 0.1]} />
                  <meshBasicMaterial color="#c9a227" toneMapped={false} transparent />
                </mesh>
              </group>
            );
          })}
        </group>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.6, 1.3, 40]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent side={DoubleSide} />
        </mesh>
        <pointLight color={color} intensity={12} distance={9} position={[0, 1.2, 0]} />
      </group>
    );
  }

  // strike
  return (
    <group ref={group} position={[data.x, data.y, 0]}>
      {fxLayer}
      <mesh rotation-z={-0.5}>
        <boxGeometry args={GEO.strikeBox} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.8} />
      </mesh>
      <mesh rotation-z={-0.5} position={[0, 0, 0.05]}>
        <boxGeometry args={GEO.strikeCore} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.35} />
      </mesh>
      <pointLight color={color} intensity={7} distance={5} />
    </group>
  );
});

export function Effects({
  list,
  world,
  onDamage,
  onDone,
}: {
  list: EffectData[];
  world: WorldRef;
  onDamage: EffectProps['onDamage'];
  onDone: (id: number) => void;
}) {
  return (
    <>
      {list.map((effect) => (
        <Effect key={effect.id} data={effect} world={world} onDamage={onDamage} onDone={onDone} />
      ))}
    </>
  );
}
