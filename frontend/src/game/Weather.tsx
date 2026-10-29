import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry } from 'three';
import type { WeatherId } from './types';

const COUNT = 1400;
const SPAN = 34;
const TOP = 22;

/**
 * Harita hava modu. Maç öncesi seçilen `type`'a göre yağmur / kar / katana
 * yağmuru partikülleri oynar. Tamamen görsel — oyun mantığını etkilemez.
 */
export function Weather({ type }: { type: WeatherId }) {
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SPAN;
      pos[i * 3 + 1] = Math.random() * TOP;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPAN;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    return geo;
  }, []);

  // partikül hızları (yağmur hızlı, kar yavaş salınır)
  const speeds = useMemo(() => {
    const s = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) s[i] = 0.6 + Math.random() * 0.7;
    return s;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, rawDelta) => {
    if (type === 'none') return;
    const dt = Math.min(rawDelta, 0.05);
    const attr = geometry.attributes.position as BufferAttribute;
    const arr = attr.array as Float32Array;
    const fall = type === 'rain' ? 30 : type === 'katana' ? 11 : type === 'snow' ? 1.7 : 0;
    const drift = type === 'snow' ? 0.9 : type === 'katana' ? 0.35 : 0.15;
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3;
      arr[j + 1] -= fall * speeds[i] * dt;
      arr[j] += Math.sin((arr[j + 1] + i) * 0.4) * drift * dt;
      if (arr[j + 1] < 0) {
        arr[j + 1] = TOP;
        arr[j] = (Math.random() - 0.5) * SPAN;
        arr[j + 2] = (Math.random() - 0.5) * SPAN;
      }
    }
    attr.needsUpdate = true;
  });

  if (type === 'none') return null;

  const color = type === 'rain' ? '#8ec5ff' : type === 'snow' ? '#ffffff' : '#d8dee9';
  const size = type === 'rain' ? 0.08 : type === 'snow' ? 0.17 : 0.28;

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
