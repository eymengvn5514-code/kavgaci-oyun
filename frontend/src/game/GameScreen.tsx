import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MathUtils } from 'three';
import { useTranslation } from 'react-i18next';
import Fighter from './Fighter';
import { Effects } from './Effects';
import type { EffectData } from './Effects';
import { Stage } from './stages';
import TouchControls from './TouchControls';
import { Weather } from './Weather';
import { skillFxFor } from './SkillFx';
import { FatalityFx, BloodPool } from './Fatality';
import { bloodFor, dismemberFor } from './finishers';
import { audio, SFX } from '../audio/audio';
import { releaseTouchHolds } from './touchInput';
import { SKILL_IDS, SKILL_KEY_LABEL, getSkills } from '../data/skills';
import type { SkillId } from '../data/skills';
import {
  BUFF_MULT,
  FATALITY_SECONDS,
  KATANA_CD,
  KATANA_DAMAGE_RATIO,
  KATANA_LEVEL,
  MAX_HP,
  ULT_HP_THRESHOLD,
} from './types';
import type { DismemberKind, FighterSide, World, WorldRef } from './types';
import { getCharacter, sortedCharacters } from '../data/characters';
import { levelInfo, useGameStore } from '../store/useGameStore';
import { net } from '../net/net';
import type { PeerState } from '../net/protocol';
import ProfileBadge from '../components/ProfileBadge';
import { MapIntro, MAP_INTRO } from '../screens/MapIntro';

interface Sync {
  cd: Record<FighterSide, Record<SkillId, number>>;
  stun: Record<FighterSide, number>;
  buff: Record<FighterSide, number>;
  /** Katana yeteneği cooldown (saniye). */
  katana: number;
}

const EMPTY_CD: Record<SkillId, number> = { e: 0, c: 0, q: 0, ult: 0 };

/** Ortak dünya: p1 her zaman SOL (-x), p2 her zaman SAĞ (+x). İki istemcide aynı. */
const freshWorld = (playerX: number, dummyX: number): World => ({
  playerX,
  dummyX,
  playerStun: 0,
  dummyStun: 0,
  playerBuff: 0,
  dummyBuff: 0,
  playerDash: 0,
  dummyDash: 0,
});

type Phase = 'fight' | 'ko' | 'roundend' | 'match' | 'fatality';

/** Finisher türü — R ile öldürürsen fatality, E ile öldürürsen labality. */
export interface Cine {
  victim: FighterSide;
  kind: 'fatality' | 'labality';
  /** Kaybedenin donmuş X konumu. */
  x: number;
  /** Koparılacak uzuv / kırılacak eklem. */
  dismember: DismemberKind;
  /** Kan rengi (elemente göre). */
  blood: string;
}

/** Kamera iki dövüşçünün ortasına bakar; aralıkları açıldıkça geri çekilir. */
function CameraRig({ world, cineRef }: { world: WorldRef; cineRef: { current: Cine | null } }) {
  const { camera } = useThree();
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const c = cineRef.current;
    if (c) {
      // yakın çekim: kaybedenin kafasına doğru süzül
      const vx = c.victim === 'player' ? world.current.playerX : world.current.dummyX;
      const side = c.victim === 'player' ? 1 : -1;
      camera.position.x = MathUtils.damp(camera.position.x, vx + side * 1.25, 5, dt);
      camera.position.y = MathUtils.damp(camera.position.y, 1.62, 5, dt);
      camera.position.z = MathUtils.damp(camera.position.z, 1.7, 4.5, dt);
      camera.lookAt(vx, 1.5, 0);
      return;
    }
    const a = world.current.playerX;
    const b = world.current.dummyX;
    const mid = MathUtils.clamp((a + b) / 2, -2.6, 2.6);
    const sep = Math.abs(a - b);
    const targetZ = MathUtils.clamp(9.4 + sep * 0.9, 10, 17.5);
    camera.position.x = MathUtils.damp(camera.position.x, mid, 6, dt);
    camera.position.y = MathUtils.damp(camera.position.y, 2.4, 6, dt);
    camera.position.z = MathUtils.damp(camera.position.z, targetZ, 4, dt);
    camera.lookAt(mid, 1.05, 0);
  });
  return null;
}

/** Cooldown / stun / buff zamanlayıcıları + HUD senkronu. */
function Engine({
  world,
  cd,
  katanaCd,
  onSync,
}: {
  world: WorldRef;
  cd: { current: Record<FighterSide, Record<SkillId, number>> };
  katanaCd: { current: number };
  onSync: (sync: Sync) => void;
}) {
  const last = useRef('');
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    if (katanaCd.current > 0) katanaCd.current = Math.max(0, katanaCd.current - dt);
    for (const side of ['player', 'dummy'] as const) {
      const c = cd.current[side];
      for (const id of SKILL_IDS) if (c[id] > 0) c[id] = Math.max(0, c[id] - dt);

      const stunKey = side === 'player' ? 'playerStun' : 'dummyStun';
      const buffKey = side === 'player' ? 'playerBuff' : 'dummyBuff';
      if (world.current[stunKey] > 0) world.current[stunKey] = Math.max(0, world.current[stunKey] - dt);
      if (world.current[buffKey] > 0) world.current[buffKey] = Math.max(0, world.current[buffKey] - dt);
    }

    const sig = [
      Math.ceil(cd.current.player.e),
      Math.ceil(cd.current.player.c),
      Math.ceil(cd.current.player.q),
      Math.ceil(cd.current.player.ult),
      Math.ceil(cd.current.dummy.e),
      Math.ceil(cd.current.dummy.c),
      Math.ceil(cd.current.dummy.q),
      Math.ceil(cd.current.dummy.ult),
      world.current.playerStun > 0 ? 1 : 0,
      world.current.dummyStun > 0 ? 1 : 0,
      world.current.playerBuff > 0 ? 1 : 0,
      world.current.dummyBuff > 0 ? 1 : 0,
      Math.ceil(katanaCd.current),
    ].join(',');

    if (sig !== last.current) {
      last.current = sig;
      onSync({
        cd: { player: { ...cd.current.player }, dummy: { ...cd.current.dummy } },
        stun: { player: world.current.playerStun, dummy: world.current.dummyStun },
        buff: { player: world.current.playerBuff, dummy: world.current.dummyBuff },
        katana: katanaCd.current,
      });
    }
  });
  return null;
}

export default function GameScreen() {
  const { t } = useTranslation();
  const language = useGameStore((s) => s.language);
  const mode = useGameStore((s) => s.mode);
  const stage = useGameStore((s) => s.stage);
  const selectedId = useGameStore((s) => s.selectedId);
  const xp = useGameStore((s) => s.xp);
  const setScreen = useGameStore((s) => s.setScreen);
  const addXp = useGameStore((s) => s.addXp);
  const touchControls = useGameStore((s) => s.touchControls);
  const setTouchControls = useGameStore((s) => s.setTouchControls);
  const weather = useGameStore((s) => s.weather);
  const katanaUnlocked = levelInfo(xp).level >= KATANA_LEVEL;

  // dokunmatik cihazda tuşlar otomatik görünür; masaüstünde 📱 ile açılır
  const [coarsePointer] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
  );
  const showTouch = touchControls || coarsePointer;

  // online maç bilgisi ekran açılışında sabitlenir (lobi tarafından kurulur)
  const [online] = useState(() => (mode === 'online' ? net.matchInfo : null));
  // ortak dünya: p1 her zaman SOL, p2 her zaman SAĞ — rol spawn'ı belirler
  const realOnline = !!online && !online.simulated;
  const iAmP1 = !realOnline || online?.role === 'p1';
  const playerSpawn = iAmP1 ? -3 : 3;
  const dummySpawn = iAmP1 ? 3 : -3;
  const castSkillRef = useRef<(side: FighterSide, id: SkillId, opts?: { visualOnly?: boolean }) => void>(() => {});

  // ekran terk edilince basılı tutulan dokunmatik tuşlar takılı kalmasın
  useEffect(() => () => releaseTouchHolds(), []);

  const player = useMemo(() => {
    const id = (mode === 'online' ? online?.myChar : null) ?? selectedId;
    return getCharacter(id) ?? sortedCharacters[0];
  }, [mode, online?.myChar, selectedId]);
  const bot = useMemo(() => {
    if (mode === 'online' && online?.oppChar) {
      return getCharacter(online.oppChar) ?? sortedCharacters[1];
    }
    const others = sortedCharacters.filter((c) => c.id !== player.id);
    return others[Math.floor(Math.random() * others.length)];
  }, [mode, online?.oppChar, player.id]);

  // online: rakip kukla durumu + yetenek görselleri (yalnız gerçek sunucu modunda)
  const peerState = useRef<PeerState | null>(null);

  useEffect(() => {
    if (!realOnline) return;
    return net.onPeerSkill((id) => {
      if (id === 'katana') {
        spawnKatanaRef.current('dummy');
        return;
      }
      castSkillRef.current('dummy', id as SkillId, { visualOnly: true });
    });
  }, [realOnline]);

  // rakip çıkarsa lobiye dön
  useEffect(() => {
    if (mode !== 'online') return;
    return net.subscribe(() => {
      if (!net.matchInfo) setScreen('online');
    });
  }, [mode, setScreen]);

  const playerSkills = useMemo(() => getSkills(player), [player]);
  const botSkills = useMemo(() => getSkills(bot), [bot]);

  const world = useRef<World>(freshWorld(playerSpawn, dummySpawn));
  const cd = useRef<Record<FighterSide, Record<SkillId, number>>>({
    player: { ...EMPTY_CD },
    dummy: { ...EMPTY_CD },
  });
  const hpRef = useRef({ player: MAX_HP, dummy: MAX_HP });
  const nextId = useRef(1);
  const katanaCdRef = useRef(0);
  const spawnKatanaRef = useRef<(side: FighterSide, opts?: { damage?: boolean }) => void>(() => {});
  /** Her tarafın son vuruş kaynağı — finisher türünü belirler. */
  const lastHitSrc = useRef<Record<FighterSide, string>>({ player: 'melee', dummy: 'melee' });

  // yerel dövüşçü durumunu ~20Hz yayınla (can dahil)
  const lastSent = useRef(0);
  // son yerel durum (can hariç) — hasar anında anında yayınlamak için saklanır
  const lastLocal = useRef<Omit<PeerState, 'hp'>>({
    x: playerSpawn,
    y: 0,
    facing: iAmP1 ? 1 : -1,
    action: 'idle',
  });

  /** Rakip sekmesi arka plandayken rAF durur; hasar anında durumu hemen gönder. */
  const flushState = useCallback(() => {
    if (!realOnline) return;
    net.sendState({ ...lastLocal.current, hp: hpRef.current.player });
  }, [realOnline]);

  const sendLocalState = useCallback(
    (s: Omit<PeerState, 'hp'>) => {
      lastLocal.current = s;
      if (!realOnline) return;
      const t = performance.now();
      if (t - lastSent.current < 50) return;
      lastSent.current = t;
      net.sendState({ ...s, hp: hpRef.current.player });
    },
    [realOnline],
  );

  // sekme tekrar görünür olunca canı tazele (arka planda biriken hasar senkronu)
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) flushState();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [flushState]);

  const [phase, setPhase] = useState<Phase>('fight');
  const [intro, setIntro] = useState(() => !!MAP_INTRO[stage]);
  const [round, setRound] = useState(1);
  const [roundStart, setRoundStart] = useState(0);
  const [roundWinner, setRoundWinner] = useState<FighterSide | null>(null);
  const [scores, setScores] = useState({ player: 0, dummy: 0 });
  const [matchWinner, setMatchWinner] = useState<FighterSide | null>(null);
  const [p1Hp, setP1Hp] = useState(MAX_HP);
  const [p2Hp, setP2Hp] = useState(MAX_HP);
  const [effects, setEffects] = useState<EffectData[]>([]);
  /** Finisher yakın çekimi (fatality/labality). */
  const [cine, setCine] = useState<Cine | null>(null);
  const cineRef = useRef<Cine | null>(null);
  cineRef.current = cine;
  /** Koparılan uzuv — finisher bitse de tur sonuna kadar kopuk kalır. */
  const [dismember, setDismember] = useState<{ side: FighterSide; kind: DismemberKind } | null>(null);
  /** Yerde kalan kan gölleri (tur boyunca silinmez). */
  const [pools, setPools] = useState<{ id: number; x: number; color: string }[]>([]);
  const poolId = useRef(1);
  const [sync, setSync] = useState<Sync>({
    cd: { player: { ...EMPTY_CD }, dummy: { ...EMPTY_CD } },
    stun: { player: 0, dummy: 0 },
    buff: { player: 0, dummy: 0 },
    katana: 0,
  });

  // KO zamanlayıcısı efekt içinde phase değiştirdiği için, phase'i ref'te tutuyoruz
  // (aksi halde setPhase('ko') kendi cleanup'ını tetikler ve timeout iptal olur).
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const koLocked = useRef(false);

  /** Raundu kazananı skora yaz; 2'ye ulaşınca maçı bitir. */
  const scoreRound = useCallback(
    (w: FighterSide) => {
      const s = scoresRef.current;
      const ns = {
        player: s.player + (w === 'player' ? 1 : 0),
        dummy: s.dummy + (w === 'dummy' ? 1 : 0),
      };
      setScores(ns);
      // 2 raund; 1-1 olursa 3. raund. Kazanan skoru 2'ye ulaşınca maç biter.
      if (Math.max(ns.player, ns.dummy) >= 2) {
        setMatchWinner(w);
        setPhase('match');
        addXp(w === 'player' ? 60 : 25);
      } else {
        setRound((r) => r + 1);
        setPhase('roundend');
      }
    },
    [addXp],
  );

  // dev teşhis: oyun durumunu window'a akıt (otomasyon doğrulaması için)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const id = setInterval(() => {
      (window as unknown as { __hud?: Record<string, unknown> }).__hud = {
        phase,
        p1Hp,
        p2Hp,
        role: online?.role ?? null,
        iAmP1,
        realOnline,
        botX: Math.round(world.current.dummyX * 100) / 100,
        playerX: Math.round(world.current.playerX * 100) / 100,
      };
    }, 400);
    return () => clearInterval(id);
  }, [phase, p1Hp, p2Hp, online, iAmP1, realOnline]);

  // --- tur bitti: KO anı (1.5sn) ya da finisher yakın çekimi (2.9sn), sonra skor ---
  useEffect(() => {
    const w: FighterSide | null = p1Hp <= 0 ? 'dummy' : p2Hp <= 0 ? 'player' : null;
    if (!w || phaseRef.current !== 'fight' || koLocked.current) return;
    koLocked.current = true;
    setRoundWinner(w);

    const src = lastHitSrc.current[w];
    const finisher = src === 'ult' ? 'fatality' : src === 'e' ? 'labality' : null;
    const victim: FighterSide = w === 'player' ? 'dummy' : 'player';
    const victimChar = victim === 'player' ? player : bot;
    const vx = victim === 'player' ? world.current.playerX : world.current.dummyX;
    const blood = bloodFor(victimChar.element);

    // yerde kan kalsın (Mortal Kombat usulü)
    setPools((list) => [...list.slice(-5), { id: poolId.current++, x: vx, color: blood }]);
    if (!finisher) audio.bone(1);

    let id: ReturnType<typeof setTimeout>;
    if (finisher) {
      const dm = dismemberFor(victimChar.id, finisher);
      setDismember({ side: victim, kind: dm });
      setCine({ victim, kind: finisher, x: vx, dismember: dm, blood });
      setPhase('fatality');
      id = setTimeout(() => {
        setCine(null);
        scoreRound(w);
      }, FATALITY_SECONDS * 1000);
    } else {
      setPhase('ko');
      id = setTimeout(() => scoreRound(w), 1500);
    }
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1Hp, p2Hp]);

  // yeni tur başlarken KO kilidini aç
  useEffect(() => {
    if (phase === 'fight') koLocked.current = false;
  }, [phase, roundStart]);

  // --- raund sonu: kısa ara, sonra yeni raund başlat ---
  useEffect(() => {
    if (phase !== 'roundend') return;
    const id = setTimeout(() => {
      world.current = freshWorld(playerSpawn, dummySpawn);
      cd.current = { player: { ...EMPTY_CD }, dummy: { ...EMPTY_CD } };
      hpRef.current = { player: MAX_HP, dummy: MAX_HP };
      setP1Hp(MAX_HP);
      setP2Hp(MAX_HP);
      setEffects([]);
      setCine(null);
      setDismember(null);
      setPools([]);
      setPhase('fight');
      setRoundStart((r) => r + 1);
    }, 1700);
    return () => clearTimeout(id);
  }, [phase]);

  const applyDamage = useCallback(
    (target: FighterSide, amount: number, from: FighterSide, stun: number, source = 'melee') => {
      lastHitSrc.current[from] = source;
      const buffKey = from === 'player' ? 'playerBuff' : 'dummyBuff';
      const mult = world.current[buffKey] > 0 ? BUFF_MULT : 1;
      const dmg = Math.round(amount * mult);
      const next = Math.max(0, hpRef.current[target] - dmg);
      hpRef.current[target] = next;
      if (target === 'player') setP1Hp(next);
      else setP2Hp(next);

      if (stun > 0) {
        const stunKey = target === 'player' ? 'playerStun' : 'dummyStun';
        world.current[stunKey] = Math.max(world.current[stunKey], stun);
      }
    },
    [],
  );

  // dev test kancası: tur akışını deterministik doğrulamak için
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __kavgaciTest?: Record<string, (d: number, src?: string) => void> }).__kavgaciTest = {
      hitBot: (d: number, src?: string) => applyDamage('dummy', d, 'player', 0, src ?? 'melee'),
      hitPlayer: (d: number, src?: string) => applyDamage('player', d, 'dummy', 0, src ?? 'melee'),
    };
    return () => {
      delete (window as unknown as { __kavgaciTest?: unknown }).__kavgaciTest;
    };
  }, [applyDamage]);

  const handleHit = useCallback(
    (damage: number, attacker: FighterSide) => {
      audio.hit(0.55);
      lastHitSrc.current[attacker] = 'melee';
      // online: hasar yerelde uygulanmaz — rakibe bildirilir, rakip kendi canını düşürür
      if (realOnline) {
        if (attacker === 'player') net.sendHit(damage, 0, 'melee');
        return;
      }
      applyDamage(attacker === 'player' ? 'dummy' : 'player', damage, attacker, 0, 'melee');
    },
    [applyDamage, realOnline],
  );

  // efekt kaynaklı hasar (mermi teması): online'da rakibe bildirilir
  const handleEffectDamage = useCallback(
    (target: FighterSide, amount: number, from: FighterSide, stun: number, source = 'melee') => {
      lastHitSrc.current[from] = source;
      if (realOnline) {
        if (from === 'player') net.sendHit(amount, stun, source);
        return;
      }
      applyDamage(target, amount, from, stun, source);
    },
    [applyDamage, realOnline],
  );

  // rakip durumu: kuklayı sür (konum/yön/aksiyon) + rakip canını yansıt
  useEffect(() => {
    if (!realOnline) return;
    return net.onPeerState((s) => {
      peerState.current = s;
      if (s.hp !== hpRef.current.dummy) {
        hpRef.current.dummy = s.hp;
        setP2Hp(s.hp);
      }
    });
  }, [realOnline]);

  // rakip bana vurdu → kendi canım düşer (hasarın sahibi benim), hemen yayınla
  useEffect(() => {
    if (!realOnline) return;
    return net.onPeerHit((dmg, stun) => {
      applyDamage('player', dmg, 'dummy', stun);
      flushState();
    });
  }, [realOnline, applyDamage, flushState]);

  const removeEffect = useCallback((id: number) => {
    setEffects((list) => list.filter((e) => e.id !== id));
  }, []);

  const castSkill = useCallback(
    (side: FighterSide, id: SkillId, opts?: { visualOnly?: boolean }) => {
      if (phase !== 'fight') return;
      const def = (side === 'player' ? playerSkills : botSkills)[id];
      if (cd.current[side][id] > 0) return;
      if (id === 'ult' && hpRef.current[side] > MAX_HP * ULT_HP_THRESHOLD) return;

      cd.current[side][id] = def.cd;
      lastHitSrc.current[side] = id;
      // karakter yeteneği sesi
      const actor = side === 'player' ? player : bot;
      audio.spell(actor.element, side === 'player' ? 0.9 : 0.55);

      const myX = side === 'player' ? world.current.playerX : world.current.dummyX;
      const oppX = side === 'player' ? world.current.dummyX : world.current.playerX;
      const facing: 1 | -1 = oppX >= myX ? 1 : -1;
      const target: FighterSide = side === 'player' ? 'dummy' : 'player';
      const gap = Math.abs(oppX - myX);

      // yetenek görseli + doğduğu yer (kendine / hedefe / yere)
      const fxDef = skillFxFor(actor.id, id);
      let fxX = myX;
      let fxY = 1.0;
      if (def.kind === 'strike') {
        fxX = oppX;
        fxY = 1.0;
      } else if (def.kind === 'aoe') {
        fxX = oppX;
        fxY = 0;
      } else if (def.kind === 'projectile') {
        fxX = myX;
        fxY = 1.05;
      }

      if (import.meta.env.DEV) {
        const probe = ((window as unknown as { __kavgaciFx?: unknown[] }).__kavgaciFx ??= []);
        probe.push({
          side,
          id,
          kind: def.kind,
          fx: fxDef.kind,
          x: Number(fxX.toFixed(2)),
          y: fxY,
          dist: Number(gap.toFixed(2)),
          at: Date.now(),
        });
        if (probe.length > 40) probe.shift();
      }

      if (def.kind === 'buff') {
        const buffKey = side === 'player' ? 'playerBuff' : 'dummyBuff';
        world.current[buffKey] = def.duration;
      }

      if (def.kind === 'dash') {
        const dashKey = side === 'player' ? 'playerDash' : 'dummyDash';
        world.current[dashKey] = facing * Math.min(def.range, Math.abs(oppX - myX) + 1.2);
      }

      if (!opts?.visualOnly && (def.kind === 'strike' || def.kind === 'aoe' || def.kind === 'dash')) {
        const dist = Math.abs(oppX - myX);
        const inFront = (oppX - myX) * facing > 0;
        if (dist <= def.range && inFront) {
          // online: hasar rakibe bildirilir (rakip kendi canını düşürür)
          if (realOnline) net.sendHit(def.damage, def.stun, id);
          else applyDamage(target, def.damage, side, def.stun, id);
        }
      }

      // yetenek görselini rakibe de gönder (yerel oyuncu, gerçek online)
      if (side === 'player' && realOnline && !opts?.visualOnly) net.sendSkill(id);

      setEffects((list) => [
        ...list,
        {
          id: nextId.current++,
          kind: def.kind,
          fx: fxDef.kind,
          fxScale: fxDef.scale,
          dist: gap,
          owner: side,
          src: id,
          x: fxX,
          y: def.kind === 'projectile' ? fxY : def.kind === 'aoe' ? 0 : 1.0,
          facing,
          color: def.color,
          damage: def.damage,
          range: def.range,
          duration: def.duration,
          speed: def.speed,
          stun: def.stun,
        },
      ]);
    },
    [applyDamage, bot, botSkills, phase, player, playerSkills, realOnline],
  );

  castSkillRef.current = castSkill;

  // Katana yağmuru — 50. seviyede açılır; rakip üstüne kılıç yağdırır, %20 can götürür.
  spawnKatanaRef.current = (side, opts) => {
    if (phaseRef.current !== 'fight') return;
    const myX = side === 'player' ? world.current.playerX : world.current.dummyX;
    const oppX = side === 'player' ? world.current.dummyX : world.current.playerX;
    const actor = side === 'player' ? player : bot;
    audio.playSfx(SFX.spell[7], side === 'player' ? 1 : 0.6);
    lastHitSrc.current[side] = 'katana';
    setEffects((list) => [
      ...list,
      {
        id: nextId.current++,
        kind: 'katana',
        dist: Math.abs(oppX - myX),
        owner: side,
        src: 'katana',
        x: oppX,
        y: 0,
        facing: oppX >= myX ? 1 : -1,
        color: actor.accent,
        damage: 0,
        range: 2.4,
        duration: 1.5,
        speed: 0,
        stun: 0.6,
      },
    ]);
    if (opts?.damage) {
      const dmg = MAX_HP * KATANA_DAMAGE_RATIO;
      if (realOnline) net.sendHit(dmg, 0.6, 'katana');
      else applyDamage(side === 'player' ? 'dummy' : 'player', dmg, side, 0.6, 'katana');
    }
  };

  const castKatana = useCallback(() => {
    if (!katanaUnlocked || katanaCdRef.current > 0) return;
    if (phaseRef.current !== 'fight') return;
    katanaCdRef.current = KATANA_CD;
    spawnKatanaRef.current('player', { damage: true });
    if (realOnline) net.sendSkill('katana');
  }, [katanaUnlocked, realOnline, applyDamage]);

  // T tuşu ile katana yeteneği (50. seviye).
  useEffect(() => {
    if (!katanaUnlocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyT' && !e.repeat) castKatana();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [katanaUnlocked, castKatana]);

  const rematch = () => {
    world.current = freshWorld(playerSpawn, dummySpawn);
    cd.current = { player: { ...EMPTY_CD }, dummy: { ...EMPTY_CD } };
    hpRef.current = { player: MAX_HP, dummy: MAX_HP };
    setP1Hp(MAX_HP);
    setP2Hp(MAX_HP);
    setEffects([]);
    setCine(null);
    setDismember(null);
    setPools([]);
    setScores({ player: 0, dummy: 0 });
    setMatchWinner(null);
    setRoundWinner(null);
    setRound(1);
    setPhase('fight');
    setRoundStart((r) => r + 1);
  };

  const ultReady = p1Hp <= MAX_HP * ULT_HP_THRESHOLD;
  // HUD dünya tarafına bağlanır: sol her zaman p1, sağ her zaman p2
  const leftFighter = iAmP1 ? player : bot;
  const rightFighter = iAmP1 ? bot : player;
  const leftHp = iAmP1 ? p1Hp : p2Hp;
  const rightHp = iAmP1 ? p2Hp : p1Hp;
  const totalRounds = round;
  const roundWinnerName = roundWinner ? (roundWinner === 'player' ? player.name : bot.name) : '';
  const skillNames = useMemo(
    () => ({
      e: player.skills.e[language],
      c: player.skills.c[language],
      q: player.skills.q[language],
      ult: player.skills.ult[language],
    }),
    [player, language],
  );

  return (
    <div className={`game-screen${showTouch ? ' touch-on' : ''}`}>
      <Canvas
        shadows="percentage"
        camera={{ position: [0, 2.4, 11.2], fov: 40 }}
        dpr={[1, 2]}
        gl={{ localClippingEnabled: true }}
      >
        <CameraRig world={world} cineRef={cineRef} />
        <Engine world={world} cd={cd} katanaCd={katanaCdRef} onSync={setSync} />
        <Stage id={stage} />
        <Weather type={weather} />
        <Effects list={effects} world={world} onDamage={handleEffectDamage} onDone={removeEffect} />
        {pools.map((p) => (
          <BloodPool key={p.id} x={p.x} color={p.color} size={1.15} />
        ))}
        {cine && (
          <FatalityFx
            victimX={cine.x}
            victim={cine.victim}
            kind={cine.kind}
            dismember={cine.dismember}
            color={cine.victim === 'player' ? player.color : bot.color}
            blood={cine.blood}
          />
        )}
        <Fighter
          character={player}
          side="player"
          spawnX={playerSpawn}
          isPlayer
          active={phase === 'fight'}
          hp={p1Hp}
          stunned={sync.stun.player > 0}
          buffed={sync.buff.player > 0}
          world={world}
          onHit={handleHit}
          onCast={(id) => castSkill('player', id)}
          roundStart={roundStart}
          victory={phase === 'match' && matchWinner === 'player'}
          onLocalState={sendLocalState}
          finisher={cine?.victim === 'player'}
          dismember={dismember?.side === 'player' ? dismember.kind : 'none'}
        />
        <Fighter
          character={bot}
          side="dummy"
          spawnX={dummySpawn}
          isPlayer={false}
          active={phase === 'fight'}
          hp={p2Hp}
          stunned={sync.stun.dummy > 0}
          buffed={sync.buff.dummy > 0}
          world={world}
          onHit={handleHit}
          onCast={(id) => castSkill('dummy', id)}
          roundStart={roundStart}
          victory={phase === 'match' && matchWinner === 'dummy'}
          puppet={realOnline ? peerState : undefined}
          finisher={cine?.victim === 'dummy'}
          dismember={dismember?.side === 'dummy' ? dismember.kind : 'none'}
        />
      </Canvas>

      <div className="hud">
        <div className="hud-bar left">
          <span className="hud-name" style={{ color: leftFighter.accent }}>
            {leftFighter.name}
          </span>
          <div className="hp-track">
            <div className="hp-fill" style={{ width: `${leftHp}%`, background: leftFighter.color }} />
          </div>
        </div>
        <div className="hud-bar right">
          <span className="hud-name" style={{ color: rightFighter.accent }}>
            {rightFighter.name}
          </span>
          <div className="hp-track">
            <div className="hp-fill" style={{ width: `${rightHp}%`, background: rightFighter.color }} />
          </div>
        </div>
      </div>

      <div className="round-chip">
        <span className="round-label">{t('game.round')} {totalRounds}</span>
        <span className="round-score">{scores.player} - {scores.dummy}</span>
      </div>

      <div className="game-topbar">
        <ProfileBadge name={player.name} color={player.accent} xp={xp} />
        <button className="btn btn-ghost" onClick={() => setScreen('menu')}>
          ← {t('game.menu')}
        </button>
        <button
          className={`btn btn-ghost touch-toggle${showTouch ? ' active' : ''}`}
          title={t('game.touchToggle')}
          onClick={() => setTouchControls(!touchControls)}
        >
          📱
        </button>
        {mode === 'online' && (
          <span className="online-badge">
            {t('menu.online')} · {bot.name}
            {online?.simulated ? ' (bot)' : ''}
          </span>
        )}
      </div>

      <div className="game-status">
        {sync.stun.player > 0 && <span className="status-chip stun">SERSEM</span>}
        {sync.buff.player > 0 && <span className="status-chip buff">GÜÇ +%35</span>}
      </div>

      <div className="skillbar">
        {SKILL_IDS.map((id) => {
          const remaining = sync.cd.player[id];
          const locked = id === 'ult' && !ultReady;
          const ready = remaining <= 0 && !locked;
          return (
            <div key={id} className={`skill-slot${ready ? ' ready' : ''}${locked ? ' locked' : ''}`}>
              <span className="slot-key">{SKILL_KEY_LABEL[id]}</span>
              <span className="slot-name">{player.skills[id][language]}</span>
              <span className="slot-meta">
                {remaining > 0 ? `${Math.ceil(remaining)}s` : locked ? '%50' : t('game.ready')}
              </span>
            </div>
          );
        })}
        {katanaUnlocked && (
          <div
            className={`skill-slot katana${sync.katana <= 0 ? ' ready' : ''}`}
            onClick={castKatana}
          >
            <span className="slot-key">T</span>
            <span className="slot-name">{t('game.katana')}</span>
            <span className="slot-meta">
              {sync.katana > 0 ? `${Math.ceil(sync.katana)}s` : t('game.ready')}
            </span>
          </div>
        )}
      </div>

      <div className="game-hint">{t('game.controls')}</div>

      {intro && <MapIntro stageId={stage} label={t('select.stage')} onDone={() => setIntro(false)} />}

      {showTouch && phase !== 'match' && (
        <TouchControls
          cd={sync.cd.player}
          ultReady={ultReady}
          skillNames={skillNames}
          onCast={(id) => castSkill('player', id)}
          katana={katanaUnlocked ? { cd: sync.katana, onCast: castKatana } : undefined}
        />
      )}

      {phase === 'ko' && (
        <div className="result-overlay ko-flash">
          <div className="ko-text">{t('game.knockout')}</div>
        </div>
      )}

      {cine && (
        <div className={`finisher-overlay ${cine.kind}`}>
          <div className="finisher-vignette" />
          <div className="finisher-text">{cine.kind === 'fatality' ? 'FATALITY' : 'LABALITY'}</div>
          <div className="finisher-sub">{t('game.finisher')}</div>
        </div>
      )}

      {phase === 'roundend' && (
        <div className="result-overlay">
          <div className="result-card small">
            <h2>{roundWinnerName} {t('game.roundWins')}</h2>
            <p className="round-score-big">{scores.player} - {scores.dummy}</p>
          </div>
        </div>
      )}

      {phase === 'match' && matchWinner && (
        <div className="result-overlay victory">
          <div className="result-card">
            <h2>
              {matchWinner === 'player' ? player.name : bot.name} {t('game.wins')}
            </h2>
            <p>+{matchWinner === 'player' ? 60 : 25} XP</p>
            <div className="result-actions">
              <button className="btn btn-primary" onClick={rematch}>
                {t('game.rematch')}
              </button>
              <button className="btn btn-ghost" onClick={() => setScreen('menu')}>
                {t('game.menu')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}