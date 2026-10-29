import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import type { Group } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AVATAR_URL } from '../game/models';
import { levelInfo } from '../store/useGameStore';

function AvatarModel() {
  const { scene } = useGLTF(AVATAR_URL, false, true);
  const spin = useRef<Group>(null);

  const { inst, scale, offset } = useMemo(() => {
    const instance = clone(scene);
    instance.traverse((child) => {
      const m = child as (typeof child & { material?: { map?: unknown } });
      (m as { castShadow?: boolean }).castShadow = true;
      void m;
    });
    const box = new Box3().setFromObject(instance);
    const size = new Vector3();
    box.getSize(size);
    const center = new Vector3();
    box.getCenter(center);
    const s = 1.55 / Math.max(0.001, Math.max(size.x, size.y, size.z));
    return { inst: instance, scale: s, offset: new Vector3(-center.x, -box.min.y, -center.z) };
  }, [scene]);

  useFrame((_, raw) => {
    if (spin.current) spin.current.rotation.y += Math.min(raw, 0.05) * 0.7;
  });

  return (
    <group ref={spin}>
      <group scale={scale}>
        <group position={offset}>
          <primitive object={inst} />
        </group>
      </group>
    </group>
  );
}

export default function ProfileBadge({
  name,
  color,
  xp,
  compact = false,
}: {
  name: string;
  color: string;
  xp: number;
  compact?: boolean;
}) {
  const { level, current, needed } = levelInfo(xp);
  const pct = needed > 0 ? Math.round((current / needed) * 100) : 100;

  return (
    <div className={`profile-badge${compact ? ' compact' : ''}`}>
      <div className="profile-avatar">
        <Canvas camera={{ position: [0, 1.15, 3.2], fov: 30 }} dpr={[1, 2]} gl={{ antialias: false, alpha: true }}>
          <ambientLight intensity={1.15} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} />
          <Suspense fallback={null}>
            <AvatarModel />
          </Suspense>
        </Canvas>
      </div>
      <div className="profile-info">
        <span className="profile-name" style={{ color }}>
          {name}
        </span>
        <div className="level-row">
          <span className="profile-level">LV {level}</span>
          <div className="xp-track">
            <div className="xp-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}