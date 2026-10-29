import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import type { ErrorInfo, MutableRefObject, ReactNode } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AnimationMixer,
  AnimationUtils,
  Box3,
  LoopOnce,
  LoopRepeat,
  MeshStandardMaterial,
  Plane,
  Vector3,
} from 'three';
import type { AnimationClip, Bone, BufferAttribute, Group, Mesh, Object3D } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { useGameStore } from '../store/useGameStore';
import type { Action, DismemberKind } from './types';
import { FIGHTER_HEIGHT } from './types';
import { ANIM_LIB_URL, MIXAMO_ANIM_URLS, normalizeId, overrideFor } from './models';

type ClipKey = 'idle' | 'walk' | 'run' | 'jump' | 'punch' | 'kick' | 'lowkick' | 'airkick' | 'airpunch' | 'crouch' | 'hit' | 'dead' | 'revive' | 'victory';

/** Klip adı eşleştirme sözlüğü — isim sırası öncelik sırasıdır. */
const CLIP_KEYWORDS: Record<ClipKey, string[]> = {
  idle: ['idle', 'stand', 'breath', 'wait', 'pose', 'base'],
  walk: ['walk', 'jog'],
  run: ['run', 'sprint'],
  jump: ['jump', 'leap'],
  punch: ['punch', 'jab', 'attack', 'slash', 'swing', 'melee', 'shoot'],
  kick: ['kick'],
  lowkick: ['low kick', 'lowkick', 'sweep'],
  airkick: ['flying kick', 'jump kick', 'air kick', 'airkick'],
  airpunch: ['jump punch', 'air punch', 'airpunch'],
  crouch: ['crouch', 'duck', 'sneak'],
  hit: ['hit', 'damage', 'hurt', 'stun', 'recoil', 'impact', 'behit', 'flyup'],
  dead: ['dead', 'death', 'ko', 'fall'],
  revive: ['arise', 'revive', 'getup', 'wake'],
  victory: ['victory', 'win', 'cheer', 'box', 'practice', 'taunt', 'agree', 'gesture'],
};

const LOOPING: ClipKey[] = ['idle', 'walk', 'run', 'crouch', 'victory'];

/** İskeletsiz Meshy modellerinde de tüm temel dövüş hareketlerini oynatır. */
const FALLBACK_CLIP: Partial<Record<ClipKey, ClipKey>> = {
  airpunch: 'punch',
  airkick: 'kick',
  lowkick: 'kick',
  kick: 'punch',
  run: 'walk',
  jump: 'idle',
  crouch: 'idle',
  hit: 'dead',
  dead: 'victory',
  revive: 'victory',
};

/** Klipleri hangi sırayla sahiplenelim (öncelik sırası). */
const PREFERENCE: ClipKey[] = ['idle', 'walk', 'run', 'punch', 'airpunch', 'airkick', 'lowkick', 'kick', 'hit', 'dead', 'revive', 'victory', 'jump', 'crouch'];

/** Bir bu süreden kısa klipler "taban katman" olur, döngüye alınmaz. */
const MIN_LOOP_SECONDS = 0.25;

/**
 * Ortak kütüphaneden gelen kliplerin isme göre anlamları.
 * Meshy isimleri UUID olabilir — burada elle eşlenir (analizden ölçüldü).
 */
const LIBRARY_ALIAS: Record<string, ClipKey> = {
  attack: 'punch',
  'skill_03': 'airkick',
  '01a131c9-2813-7116-a9ef-6433c99a3243': 'punch',
  '01a131ca-6f9c-70ef-8f3f-7bb93ef27093': 'kick',
  // crimson (kendi riglenmiş paketi) — analizle ölçüldü:
  //   c4: sağ el 0.73 m ileri (yumruk)   c3: sağ ayak 0.50 m ileri (tekme)
  '_01a131c4_83c3_70a0_91b4_69b375c7a7bb': 'punch',
  '_01a131c3_c20a_7061_88b1_1ffa91984979': 'kick',
  behit_flyup: 'hit',
  dead: 'dead',
  arise: 'revive',
  boxing_practice: 'victory',
  agree_gesture: 'victory',
  running: 'walk',
  walking: 'walk',
};

/**
 * Saldırı klipleri uzun (yumruk 2.8s, tekme 5s). El/ayağın en öne uzandığı
 * pencere ölçüldü ve alt klip olarak kesiliyor — vuruşlar oyun hızında okunur.
 */
const SUB_WINDOWS: Partial<Record<ClipKey, [number, number]>> = {
  punch: [0.98, 1.55],
  kick: [1.48, 2.05],
  hit: [0.0, 0.75],
};

/** Karaktere özel alt-pencere düzeltmeleri (ölçülen değerler). */
const CHAR_TRIM: Record<string, Partial<Record<ClipKey, [number, number]>>> = {
  crimson: {
    punch: [0.98, 1.55],
    kick: [1.05, 1.62],
  },
};

/** Saldırı kliplerinin hedef süresi (dövüş ritmi). */
const ATTACK_DURATION: Partial<Record<ClipKey, number>> = {
  punch: 0.44,
  kick: 0.64,
  lowkick: 0.62,
  airkick: 0.68,
  airpunch: 0.42,
  hit: 0.75,
  dead: 1.9,
};

const MIXAMO_FILE_KEY: Record<string, ClipKey> = {
  mixamoidle: 'idle',
  mixamowalk: 'walk',
  mixamorun: 'run',
  mixamojump: 'jump',
  mixamogroundkick: 'kick',
  mixamolowkick: 'lowkick',
  mixamoflyingkick: 'airkick',
};

function retargetMixamoClip(source: AnimationClip, key: ClipKey, boneNames: Set<string>): AnimationClip {
  const clip = source.clone();
  clip.tracks = clip.tracks.filter((track) => {
    const dot = track.name.indexOf('.');
    const sourceNode = dot < 0 ? track.name : track.name.slice(0, dot);
    const colonNode = sourceNode.replace(/^mixamorig(?=[A-Z])/, 'mixamorig:');
    const targetNode = boneNames.has(sourceNode) ? sourceNode : boneNames.has(colonNode) ? colonNode : null;
    if (!targetNode) return false;
    track.name = `${targetNode}${dot < 0 ? '' : track.name.slice(dot)}`;
    // Locomotion is driven by the game controller; keep the Mixamo hip bob but
    // remove forward root travel so the imported motion cannot slide twice.
    if ((key === 'walk' || key === 'run') && /mixamorig:?Hips\.position$/.test(track.name)) {
      const values = track.values as Float32Array;
      for (let i = 0; i + 2 < values.length; i += 3) {
        values[i] = values[0];
        values[i + 2] = values[2];
      }
    }
    return true;
  });
  clip.name = `mixamo-${key}`;
  return clip;
}

function clipKeyFor(action: Action): ClipKey {
  switch (action) {
    case 'walk':
      return 'walk';
    case 'run':
      return 'run';
    case 'jump':
      return 'jump';
    case 'crouch':
      return 'crouch';
    case 'punch':
    case 'lowpunch':
      return 'punch';
    case 'kick':
      return 'kick';
    case 'lowkick':
      return 'lowkick';
    case 'airkick':
      return 'airkick';
    case 'airpunch':
      return 'airpunch';
    case 'stun':
      return 'hit';
    case 'dead':
      return 'dead';
    case 'revive':
      return 'revive';
    case 'victory':
      return 'victory';
    default:
      return 'idle';
  }
}

function resolveClips(clips: AnimationClip[]): Partial<Record<ClipKey, AnimationClip>> {
  const pool = clips.map((clip) => ({ clip, name: clip.name.toLowerCase(), used: false }));
  const out: Partial<Record<ClipKey, AnimationClip>> = {};

  // 1) Açık ad eşlemesi (UUID klipler dahil) — en güvenilir.
  for (const entry of pool) {
    if (entry.used) continue;
    const key = LIBRARY_ALIAS[entry.name];
    if (key && !out[key]) {
      out[key] = entry.clip;
      entry.used = true;
    }
  }

  // 2) Anahtar kelime eşlemesi.
  for (const key of PREFERENCE) {
    if (out[key]) continue;
    let best: AnimationClip | undefined;
    let bestRank = Number.MAX_SAFE_INTEGER;
    for (const entry of pool) {
      if (entry.used) continue;
      if (LOOPING.includes(key) && entry.clip.duration < MIN_LOOP_SECONDS) continue;
      const rank = CLIP_KEYWORDS[key].findIndex((kw) => entry.name.includes(kw));
      if (rank >= 0 && rank < bestRank) {
        best = entry.clip;
        bestRank = rank;
      }
    }
    if (best) {
      out[key] = best;
      pool.find((e) => e.clip === best)!.used = true;
    }
  }
  return out;
}

/** Saldırı kliplerini ölçülen pencereye göre keser. */
function trimToward(clip: AnimationClip, key: ClipKey, characterId: string): AnimationClip {
  const win = CHAR_TRIM[characterId]?.[key] ?? SUB_WINDOWS[key];
  if (!win) return clip;
  const [a, b] = win;
  const span = b - a;
  if (clip.duration <= span * 1.25) return clip;
  return AnimationUtils.subclip(clip, `${clip.name}::${key}`, Math.round(a * 30) + 1, Math.round(b * 30), 30);
}

interface Scan {
  size: Vector3;
  center: Vector3;
  minY: number;
  skinned: boolean;
  bottom: { x: number; z: number; n: number };
}

/**
 * İskeletli (skinned) modellerde kafes kökü genelde küçük bir ölçek taşır
 * (örn. 0.01) ve POSITION normalize tam sayıdır; Box3 o zaman saçmalar.
 * Bu yüzden iskelet varsa kemik uçları esas alınır.
 */
const SKIN_TOP_PAD = 0.09; // kafa/et payı (kemik açıklığı oranı)
const SKIN_FOOT_PAD = 0.07; // ayak tabanının en alt kemiğin altına uzanımı

const _point = new Vector3();

function bonesOf(root: Object3D): Bone[] {
  const bones: Bone[] = [];
  root.traverse((child) => {
    const bone = child as Bone;
    if (bone.isBone) bones.push(bone);
  });
  return bones;
}

/** Kemik adı eşleştirmesi: 'mixamorig:LeftToeBase' -> 'lefttoebase' ile biter. */
function findBone(bones: Bone[], ...names: string[]): Bone | undefined {
  const wanted = names.map((n) => n.toLowerCase().replace(/[^a-z]/g, ''));
  return bones.find((b) => {
    const key = b.name.toLowerCase().replace(/[^a-z]/g, '');
    return wanted.some((w) => key.endsWith(w));
  });
}

/** Modeli tarar: boyut + ayak bölgesi (yön tespiti için). */
function scanModel(root: Object3D): Scan {
  root.updateWorldMatrix(true, true);
  const meshBox = new Box3().setFromObject(root);
  const meshSize = new Vector3();
  meshBox.getSize(meshSize);

  let box = meshBox;
  let skinned = false;
  const bottom = { x: 0, z: 0, n: 0 };

  const bones = bonesOf(root);
  if (bones.length > 0) {
    const boneBox = new Box3();
    for (const bone of bones) boneBox.expandByPoint(bone.getWorldPosition(_point));
    const span = boneBox.max.y - boneBox.min.y;
    const staticSize = Math.max(meshSize.x, meshSize.y, meshSize.z);
    // Kemik kutusu mantıklıysa onu kullan: normalize ölçek çökmesine karşı
    // (kemikler mesh'ten büyük görünür) VE gerçek boyutlu modellerde
    // (kemikler mesh'ten kısa kalır) kafes kutusuna güvenilmez.
    if (Number.isFinite(span) && span > 0.35 && span > staticSize * 0.5) {
      box = boneBox;
      skinned = true;
      const cut = boneBox.min.y + span * 0.2;
      for (const bone of bones) {
        const p = bone.getWorldPosition(_point);
        if (p.y <= cut) {
          bottom.x += p.x;
          bottom.z += p.z;
          bottom.n += 1;
        }
      }
    }
  }

  if (!skinned) {
    const cut = meshBox.min.y + meshSize.y * 0.07;
    let sx = 0;
    let sz = 0;
    let n = 0;
    root.traverse((child) => {
      const mesh = child as Mesh;
      const geometry = mesh.geometry;
      if (!mesh.isMesh || !geometry) return;
      const position = geometry.attributes.position as BufferAttribute | undefined;
      if (!position) return;
      const stride = Math.max(1, Math.floor(position.count / 6000));
      for (let i = 0; i < position.count; i += stride) {
        _point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        if (_point.y <= cut) {
          sx += _point.x;
          sz += _point.z;
          n += 1;
        }
      }
    });
    bottom.x = sx;
    bottom.z = sz;
    bottom.n = n;
  }

  const size = new Vector3();
  box.getSize(size);
  const center = new Vector3();
  box.getCenter(center);
  return { size, center, minY: box.min.y, skinned, bottom };
}

/** İskelet: 'headfront' kemiği Meshy/Mixamo'da yüz yönünü işaretler. */
function headfrontYaw(root: Object3D): number | null {
  const bones = bonesOf(root);
  const head = findBone(bones, 'head');
  const front = findBone(bones, 'headfront');
  if (!head || !front) return null;
  const from = head.getWorldPosition(new Vector3());
  const dir = front.getWorldPosition(new Vector3()).sub(from);
  dir.y = 0;
  if (dir.lengthSq() < 1e-8) return null;
  return Math.atan2(dir.z, dir.x);
}

/** İskelet: ayak parmağı - ayak bileği vektörü ön yönü verir (yedek). */
function toeYaw(root: Object3D): number | null {
  const bones = bonesOf(root);
  const toe = findBone(bones, 'lefttoebase', 'lefttoe', 'toebase', 'righttoebase');
  const foot = findBone(bones, 'leftfoot', 'foot', 'rightfoot');
  if (!toe || !foot) return null;
  const from = foot.getWorldPosition(new Vector3());
  const dir = toe.getWorldPosition(new Vector3()).sub(from);
  dir.y = 0;
  if (dir.lengthSq() < 1e-8) return null;
  return Math.atan2(dir.z, dir.x);
}

/**
 * Modeli +X yönüne baktırır.
 * 1) İskelet: headfront işaretçisi (en güvenilir).
 * 2) İskelet yedeği: parmak-bilek vektörü.
 * 3) Statik Meshy modelleri native +Z bakar.
 */
function detectYaw(root: Object3D): number {
  const front = headfrontYaw(root);
  if (front !== null) return front;
  const toe = toeYaw(root);
  if (toe !== null) return toe;
  return Math.PI / 2;
}

/** GLB yüklenemezse primitif rig'e düşer. */
export class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[kavgaci] GLB yüklenemedi, yer tutucuya düşüldü:', error.message, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface GLBModelProps {
  url: string;
  characterId: string;
  /** El eşyası (katana vb.). */
  handUrl?: string;
  /** Sırt eşyası (çanta vb.). */
  backUrl?: string;
  /** Sırt eşyasının id'si — yerleşimi belirler (örn. kanatlar). */
  backId?: string;
  actionRef: MutableRefObject<Action>;
  /** Finisher: koparılan uzuv / kırılan eklem (iskelette uygulanır). */
  dismember?: DismemberKind;
}

/** Sırt eşyası yerleşimleri (id -> hedef boy + konum). */
const BACK_PROP: Record<
  string,
  { target: number; position: [number, number, number]; rotation: [number, number, number] }
> = {
  wings: { target: 1.5, position: [0, 1.0, -0.42], rotation: [0, 0, 0] },
  pack: { target: 0.4, position: [0, 1.12, -0.34], rotation: [0, Math.PI, 0] },
};

/** Bir eşya/süs GLB'sini hedef boyuta oturtup takar (model ölçeği içinde). */
export function PropGLB({
  url,
  target,
  position,
  rotation,
  tint,
}: {
  url: string;
  /** Hedef boy (metre, dünya). */
  target: number;
  /** Konum (dünya metre). */
  position: [number, number, number];
  rotation?: [number, number, number];
  tint?: string;
}) {
  const { scene } = useGLTF(url, false, true);
  const fit = useMemo(() => {
    const instance = cloneSkeleton(scene);
    instance.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const material = mesh.material as MeshStandardMaterial | undefined;
      // Dokusuz modellere çelik/gri ton (örn. katana).
      if ((!material || !material.map) && tint) {
        mesh.material = new MeshStandardMaterial({ color: tint, metalness: 0.85, roughness: 0.3 });
      }
    });
    const box = new Box3().setFromObject(instance);
    const size = new Vector3();
    box.getSize(size);
    const center = new Vector3();
    box.getCenter(center);
    const s = target / Math.max(0.001, Math.max(size.x, size.y, size.z));
    return { instance, s, offset: new Vector3(-center.x, -box.min.y, -center.z) };
  }, [scene, target, tint]);

  return (
    <group position={position} rotation={rotation} scale={fit.s}>
      <group position={fit.offset}>
        <primitive object={fit.instance} />
      </group>
    </group>
  );
}

export default function GLBModel({
  url,
  characterId,
  handUrl,
  backUrl,
  backId,
  actionRef,
  dismember,
}: GLBModelProps) {
  const { scene, animations } = useGLTF(url, false, true);
  const { animations: sharedAnims } = useGLTF(ANIM_LIB_URL, false, true);
  const mixamoUrls = Object.values(MIXAMO_ANIM_URLS);
  const mixamoSources = useLoader(FBXLoader, mixamoUrls);
  const flip = useGameStore((s) => s.facingFlips[characterId] ?? false);
  if (import.meta.env.DEV) console.info(`[kavgaci] GLB yüklendi: ${characterId} (${animations.length} klip)`);

  const model = useMemo(() => {
    const instance = cloneSkeleton(scene);
    instance.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
    });
    return instance;
  }, [scene]);

  const fit = useMemo(() => {
    const scan = scanModel(model);
    const override = overrideFor(characterId);
    const height = scan.skinned ? scan.size.y * (1 + SKIN_TOP_PAD) : scan.size.y;
    const floor = scan.skinned ? scan.minY - scan.size.y * SKIN_FOOT_PAD : scan.minY;
    const baseYaw = override?.yaw ?? detectYaw(model);
    const yaw = baseYaw + (flip ? Math.PI : 0);
    const scale = override?.scale ?? FIGHTER_HEIGHT / (height || 1);
    const offset = new Vector3(-scan.center.x, -floor + (override?.yOffset ?? 0), -scan.center.z);

    if (import.meta.env.DEV) {
      let view = document.getElementById('kavgaci-debug') as HTMLPreElement | null;
      if (!view) {
        view = document.createElement('pre') as HTMLPreElement;
        view.id = 'kavgaci-debug';
        view.style.cssText =
          'position:fixed;top:150px;right:8px;z-index:9999;background:rgba(0,0,0,.75);color:#0f0;font:11px/1.5 monospace;padding:6px 8px;white-space:pre;pointer-events:none;border-radius:6px';
        document.body.appendChild(view);
      }
      const store = ((window as unknown as { __kavgaciScan?: Record<string, string> }).__kavgaciScan ??= {});
      const bones = bonesOf(model);
      const boneYs = bones
        .slice(0, 6)
        .map((b) => `${b.name.split(':').pop()}=${b.position.y.toFixed(2)}`)
        .join(' ');
      store[characterId] =
        `${characterId} (${scan.skinned ? 'iskelet' : 'statik'}): ${scan.size.x.toFixed(2)}x${scan.size.y.toFixed(2)}x${scan.size.z.toFixed(2)} olcek=${scale.toFixed(3)} yon=${yaw.toFixed(2)} anim=${animations.length} kemik=${bones.length} [${boneYs}]${flip ? ' FLIP' : ''}`;
      view.textContent = `[kavgaci]\n${Object.values(store).join('\n')}`;
    }

    return { scale, yaw, offset };
  }, [model, characterId, flip]);

  // Ortak kütüphane klipleri yalnızca iskeletli modellere bağlanabilir.
  const skinned = bonesOf(model).length > 0;

  const clips = useMemo(() => {
    const own = resolveClips(animations);
    const shared = skinned ? resolveClips(sharedAnims) : {};
    const mixamo: Partial<Record<ClipKey, AnimationClip>> = {};
    if (skinned) {
      const boneNames = new Set(bonesOf(model).map((bone) => bone.name));
      const files = Object.keys(MIXAMO_ANIM_URLS);
      files.forEach((file, index) => {
        const key = MIXAMO_FILE_KEY[normalizeId(file)];
        const source = mixamoSources[index]?.animations[0];
        if (key && source) mixamo[key] = retargetMixamoClip(source, key, boneNames);
      });
    }
    // Mixamo clips take priority for locomotion and melee; character-owned clips
    // remain available for deaths, revives, victories and character-specific moves.
    const merged: Partial<Record<ClipKey, AnimationClip>> = { ...shared, ...own, ...mixamo };
    const out: Partial<Record<ClipKey, AnimationClip>> = {};
    for (const key of Object.keys(merged) as ClipKey[]) {
      const clip = merged[key];
      if (clip) out[key] = trimToward(clip, key, characterId);
    }
    return out;
  }, [animations, sharedAnims, mixamoSources, skinned, model, characterId]);

  const mixer = useMemo(
    () => (Object.keys(clips).length > 0 ? new AnimationMixer(model) : null),
    [model, clips],
  );

  const actions = useMemo(() => {
    const map: Partial<Record<ClipKey, ReturnType<AnimationMixer['clipAction']>>> = {};
    if (!mixer) return map;
    for (const key of PREFERENCE) {
      const clip = clips[key];
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      const loop = LOOPING.includes(key);
      action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = !loop;
      const targetDur = ATTACK_DURATION[key];
      if (targetDur) action.setDuration(targetDur);
      map[key] = action;
    }
    return map;
  }, [mixer, clips]);

  /** Hareketli Meshy modellerinde rig yoksa aynı savaş hareketini kök pozu taşır. */

  const activeKey = useRef<ClipKey | null>(null);
  const puppet = useRef<Group>(null);
  const lastAction = useRef<Action | null>(null);
  const actionTime = useRef(0);

  /**
   * Finisher: koparılan uzvun kemikleri. Uzuv kemiği sıfıra yakın ölçeğe
   * çöktürülür — iskelet ağırlıklı köşe noktaları kemiğin dibine yığılır,
   * yani uzuv GERÇEKTEN gövdeden ayrılır (ek mesh değil, kemik seviyesi).
   */
  const limbs = useMemo(() => {
    const bones = bonesOf(model);
    return {
      head: findBone(bones, 'head'),
      armL: findBone(bones, 'leftarm'),
      armR: findBone(bones, 'rightarm'),
      legL: findBone(bones, 'leftupleg', 'leftleg'),
      legR: findBone(bones, 'rightupleg', 'rightleg'),
    };
  }, [model]);

  const boneScale = useRef(new Map<Bone, number>());
  const dismemberRef = useRef<DismemberKind>('none');
  dismemberRef.current = dismember ?? 'none';
  const lastDm = useRef<DismemberKind | null>(null);

  /**
   * Kemiksiz (statik) modellerde uzuv koparma: iskelet yok, ölçeklenemez.
   * Onun yerine dünya uzayında yatay bir kırpma düzlemiyle kafa kesilir —
   * kesik yüzey düz çıkar, tıpkı yakın çekimde görünen gibi.
   * (İskeletli modellerde düzlem kullanılmaz; orada gerçek kemik çöker.)
   */
  useEffect(() => {
    const severHead = dismember === 'head' || dismember === 'headArm';
    const planes = !skinned && severHead ? [new Plane(new Vector3(0, -1, 0), 1.5)] : null;
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) {
        if (!m) continue;
        if (m.clippingPlanes === planes) continue;
        m.clippingPlanes = planes;
        m.needsUpdate = true;
      }
    });
  }, [model, skinned, dismember]);

  // dev teşhis: çözülen klip eşlemesini window'a yaz (otomasyon doğrulaması)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const store = ((window as unknown as { __kavgaciClips?: Record<string, string> }).__kavgaciClips ??= {});
    store[characterId] = Object.keys(clips).join(',');
    return () => {
      delete store[characterId];
    };
  }, [clips, characterId]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const action = actionRef.current;

    if (lastAction.current !== action) {
      lastAction.current = action;
      actionTime.current = 0;
    } else {
      actionTime.current += dt;
    }
    const t = actionTime.current;

    const requestedKey = clipKeyFor(action);
    let key: ClipKey | undefined = requestedKey;
    const visited = new Set<ClipKey>();
    while (key && !clips[key] && FALLBACK_CLIP[key] && !visited.has(key)) {
      visited.add(key);
      key = FALLBACK_CLIP[key];
    }
    const hasClip = Boolean(key && clips[key]);

    if (mixer) {
      if (hasClip && activeKey.current !== key) {
        const next = actions[key!];
        const previous = activeKey.current ? actions[activeKey.current] : null;
        if (next) {
          next.reset();
          next.enabled = true;
          next.setEffectiveTimeScale(1);
          next.setEffectiveWeight(1);
          next.play();
          if (previous && previous !== next) next.crossFadeFrom(previous, key === 'dead' ? 0.25 : 0.14, false);
          activeKey.current = key!;
        }
      }
      mixer.update(dt);
    }

    // --- finisher: kemik seviyesinde uzuv koparma / eklem kırma ---
    const dm = dismemberRef.current;
    if (dm !== 'none' || boneScale.current.size > 0) {
      const collapse = (bone: Bone | undefined, severed: boolean) => {
        if (!bone) return;
        let base = boneScale.current.get(bone);
        if (base === undefined) {
          base = bone.scale.x || 1;
          boneScale.current.set(bone, base);
        }
        bone.scale.setScalar(severed ? 0.0015 : base);
      };
      collapse(limbs.head, dm === 'head' || dm === 'headArm');
      collapse(limbs.armR, dm === 'arm' || dm === 'headArm' || dm === 'arms');
      collapse(limbs.armL, dm === 'arms');
      collapse(limbs.legL, dm === 'legs');
      collapse(limbs.legR, dm === 'legs');
    }

    if (import.meta.env.DEV && lastDm.current !== dm) {
      lastDm.current = dm;
      const probe = ((window as unknown as { __kavgaciBones?: Record<string, string> }).__kavgaciBones ??= {});
      const s = (b?: Bone) => (b ? b.scale.x.toFixed(4) : 'yok');
      probe[characterId] =
        `dm=${dm} head=${s(limbs.head)} armR=${s(limbs.armR)} armL=${s(limbs.armL)} legL=${s(limbs.legL)}`;
    }

    // İskelet animasyonu yoksa (veya o hareket için klip yoksa) kök seviyesinde oynat.
    const weight = hasClip ? 0.35 : 1;
    let px = 0;
    let py = 0;
    let lean = 0;

    switch (action) {
      case 'walk':
        py = Math.abs(Math.sin(t * 9)) * 0.035 * weight;
        px = Math.sin(t * 9) * 0.02 * weight;
        lean = -0.06 * weight;
        break;
      case 'run':
        py = Math.abs(Math.sin(t * 13)) * 0.06 * weight;
        px = Math.sin(t * 13) * 0.035 * weight;
        lean = -0.14 * weight;
        break;
      case 'crouch':
        py = -0.16;
        lean = -0.12;
        break;
      case 'jump':
        lean = -0.1;
        break;
      case 'punch': {
        const p = Math.sin(Math.min(1, t / 0.44) * Math.PI);
        px = 0.34 * p * weight;
        py = -0.02 * p * weight;
        lean = -0.2 * p * weight;
        break;
      }
      case 'lowpunch': {
        const p = Math.sin(Math.min(1, t / 0.4) * Math.PI);
        px = 0.24 * p * weight;
        py = -0.14;
        lean = -0.26 * p * weight;
        break;
      }
      case 'kick': {
        const p = Math.sin(Math.min(1, t / 0.64) * Math.PI);
        px = 0.46 * p * weight;
        py = 0.05 * p * weight;
        lean = -0.16 * p * weight;
        break;
      }
      case 'airkick': {
        const p = Math.sin(Math.min(1, t / 0.68) * Math.PI);
        px = 0.56 * p * weight;
        py = 0.08 * p * weight;
        lean = -0.3 * p * weight;
        break;
      }
      case 'lowkick': {
        const p = Math.sin(Math.min(1, t / 0.62) * Math.PI);
        px = 0.5 * p * weight;
        py = -0.12;
        lean = -0.3 * p * weight;
        break;
      }
      case 'stun':
        lean = 0.26;
        px = -0.07;
        py = Math.sin(t * 22) * 0.012;
        break;
      case 'dead':
        lean = 1.45;
        py = -0.18;
        break;
      case 'revive':
        lean = Math.max(0, 1.45 * (1 - Math.min(1, t / 0.9)));
        py = -0.18 * (1 - Math.min(1, t / 0.9));
        break;
      case 'victory':
        px = Math.sin(t * 2.4) * 0.05 * weight;
        py = Math.abs(Math.sin(t * 4.2)) * 0.05 * weight;
        lean = -0.08 + Math.sin(t * 2.4) * 0.06;
        break;
      default:
        py = Math.sin(t * 1.9) * 0.012;
        break;
    }

    if (puppet.current) {
      puppet.current.position.set(px, py, 0);
      puppet.current.rotation.z = lean;
    }
  });

  return (
    <group ref={puppet}>
      <group rotation-y={fit.yaw} scale={fit.scale}>
        <group position={fit.offset}>
          <primitive object={model} />
        </group>
        {handUrl && (
          <Suspense fallback={null}>
            <PropGLB
              url={handUrl}
              target={0.55}
              position={[0.34, 0.98, 0.06]}
              rotation={[0, 0, -1.25]}
              tint="#9fb0bd"
            />
          </Suspense>
        )}
        {backUrl && (
          <Suspense fallback={null}>
            <PropGLB
              url={backUrl}
              target={(backId && BACK_PROP[backId]?.target) || 0.4}
              position={(backId && BACK_PROP[backId]?.position) || [0, 1.12, -0.34]}
              rotation={(backId && BACK_PROP[backId]?.rotation) || [0, Math.PI, 0]}
            />
          </Suspense>
        )}
      </group>
    </group>
  );
}
