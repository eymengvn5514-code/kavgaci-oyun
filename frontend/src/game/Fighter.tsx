import { Suspense, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import type { Group } from 'three';
import type { Character } from '../data/characters';
import type { SkillId } from '../data/skills';
import type { Action, AttackPose, DismemberKind, FighterSide, PlayerInput, WorldRef } from './types';
import type { PeerState } from '../net/protocol';import {
  ARENA_MAX_X,
  ARENA_MIN_X,
  ATTACK_RANGE,
  CROUCH_KICK_DAMAGE,
  CROUCH_PUNCH_DAMAGE,
  GRAVITY,
  JUMP_VELOCITY,
  KICK_DAMAGE,
  MOVE_SPEED,
  PUNCH_DAMAGE,
} from './types';
import { useKeyboard } from '../hooks/useKeyboard';
import { touchInput } from './touchInput';
import { CHARACTER_WEAPONS, itemUrl, modelFor } from './models';
import GLBModel, { ModelBoundary } from './GLBModel';
import { useGameStore } from '../store/useGameStore';

interface FighterProps {
  character: Character;
  side: FighterSide;
  spawnX: number;
  isPlayer: boolean;
  active: boolean;
  hp: number;
  stunned: boolean;
  buffed: boolean;
  world: WorldRef;
  onHit: (damage: number, attacker: FighterSide) => void;
  onCast: (id: SkillId) => void;
  /** Her tur başında artar → konum sıfırlanır + dirilme animasyonu oynar. */
  roundStart: number;
  /** Maç galibi: zafer animasyonu (boks antrenmanı vb.) oynar. */
  victory: boolean;
  /** Online: rakip kukla — durumu ağdan sürülür (yerel simülasyon yok). */
  puppet?: { current: PeerState | null };
  /** Online: her kare yerel dövüşçü durumunu bildir (ağa gönderilir). */
  onLocalState?: (s: Omit<PeerState, 'hp'>) => void;
  /** Finisher sahnesi oynuyor: dövüşçü ölü değil, sersem ayakta durur. */
  finisher?: boolean;
  /** Koparılacak uzuv (iskelette uygulanır). */
  dismember?: DismemberKind;
}

const ATTACKS: Record<AttackPose, { dur: number; dmg: number; range: number }> = {
  punch: { dur: 0.36, dmg: PUNCH_DAMAGE, range: ATTACK_RANGE },
  airpunch: { dur: 0.36, dmg: PUNCH_DAMAGE, range: ATTACK_RANGE },
  kick: { dur: 0.6, dmg: KICK_DAMAGE, range: ATTACK_RANGE + 0.25 },
  lowpunch: { dur: 0.3, dmg: CROUCH_PUNCH_DAMAGE, range: 1.5 },
  lowkick: { dur: 0.62, dmg: CROUCH_KICK_DAMAGE, range: 2.0 },
  airkick: { dur: 0.68, dmg: KICK_DAMAGE + 2, range: ATTACK_RANGE + 0.6 },
};

/** Dövüşçü — durum makinesi + hitbox burada; görsel `GLBModel` veya primitif rig. */
export default function Fighter({
  character,
  side,
  spawnX,
  isPlayer,
  active,
  hp,
  stunned,
  buffed,
  world,
  onHit,
  onCast,
  roundStart,
  victory,
  puppet,
  onLocalState,
  finisher,
  dismember,
}: FighterProps) {
  const root = useRef<Group>(null);
  const actionRef = useRef<Action>('idle');
  const modelUrl = modelFor(character.id);
  const equipment = useGameStore((s) => s.equipment);
  const charEquip = equipment[character.id];
  const handId = charEquip?.hand ?? CHARACTER_WEAPONS[character.id];
  const handUrl = handId ? itemUrl(handId) : undefined;
  const backId = charEquip?.back;
  const backUrl = backId ? itemUrl(backId) : undefined;
  const body = useRef<Group>(null);
  const armFront = useRef<Group>(null);
  const armBack = useRef<Group>(null);
  const legFront = useRef<Group>(null);
  const legBack = useRef<Group>(null);
  const head = useRef<Group>(null);

  const keyboard = useKeyboard();
  const mouse = useRef({ punch: false, kick: false });

  const pos = useRef(spawnX);
  const y = useRef(0);
  const vy = useRef(0);
  const facing = useRef<1 | -1>(side === 'player' ? 1 : -1);
  const action = useRef<Action>('idle');
  const timer = useRef(0);
  const attack = useRef<{ pose: AttackPose; dur: number; dmg: number; range: number } | null>(null);
  const hasHit = useRef(false);
  const aiTimer = useRef(1);
  const reviveLeft = useRef(0);

  // --- tur başlangıcı: konum sıfırla + dirilme animasyonu ---
  useEffect(() => {
    pos.current = spawnX;
    y.current = 0;
    vy.current = 0;
    facing.current = side === 'player' ? 1 : -1;
    attack.current = null;
    hasHit.current = false;
    if (actionRef.current === 'dead') {
      action.current = 'revive';
      reviveLeft.current = 0.95;
    } else {
      action.current = 'idle';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundStart]);

  useEffect(() => {
    if (!isPlayer) return;
    const down = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('button, .hud, .skillbar, .game-topbar, .result-overlay')) return;
      if (e.button === 0) mouse.current.punch = true;
      if (e.button === 2) mouse.current.kick = true;
    };
    const block = (e: Event) => e.preventDefault();
    window.addEventListener('mousedown', down);
    window.addEventListener('contextmenu', block);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('contextmenu', block);
    };
  }, [isPlayer]);

  const opponentX = () => (side === 'player' ? world.current.dummyX : world.current.playerX);

  const startAttack = (pose: AttackPose) => {
    if (attack.current) return;
    attack.current = { pose, ...ATTACKS[pose] };
    action.current = pose;
    timer.current = ATTACKS[pose].dur;
    hasHit.current = false;
  };

  /** Bir girdi karesini uygular — yerel oyuncu ve ağdan gelen rakip aynı yolu kullanır. */
  const applyInput = (input: PlayerInput, dt: number) => {
    const inAir = y.current > 0.001;
    if (input.attack === 'punch') startAttack(inAir ? 'airpunch' : input.crouch ? 'lowpunch' : 'punch');
    else if (input.attack === 'kick') {
      startAttack(inAir ? 'airkick' : input.crouch ? 'lowkick' : 'kick');
      // Havada tekme: karakter kısa süre ileri süzülür; yere değince hareket normale döner.
      if (inAir) {
        pos.current = MathUtils.clamp(pos.current + facing.current * 0.7, ARENA_MIN_X, ARENA_MAX_X);
        vy.current = Math.max(vy.current, 0.8);
      }
    }
    else if (input.jump) {
      if (!inAir) {
        vy.current = JUMP_VELOCITY;
        action.current = 'jump';
      }
    } else if (input.crouch && !inAir) {
      action.current = 'crouch';
    } else if ((input.left || input.right) && !inAir) {
      pos.current += (input.left ? -1 : 1) * MOVE_SPEED * (input.run ? 1.65 : 1) * dt;
      action.current = input.run ? 'run' : 'walk';
    } else {
      action.current = inAir ? 'jump' : 'idle';
    }
  };

  const tryHit = (damage: number, range: number) => {
    if (hasHit.current) return;
    const dist = Math.abs(opponentX() - pos.current);
    const inFront = (opponentX() - pos.current) * facing.current > 0;
    if (dist <= range && inFront) {
      hasHit.current = true;
      onHit(damage, side);
    }
  };

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const g = root.current;

    // --- online kukla: rakip tamamen ağdan sürülür (simülasyon yok) ---
    if (puppet) {
      const s = puppet.current;
      if (s) {
        const k = Math.min(1, dt * 16);
        pos.current += (s.x - pos.current) * k;
        y.current += (s.y - y.current) * k;
        facing.current = s.facing;
        action.current = s.action;
      } else {
        action.current = 'idle';
      }
      if (finisher) action.current = 'stun';
      pos.current = MathUtils.clamp(pos.current, ARENA_MIN_X, ARENA_MAX_X);
      if (side === 'player') world.current.playerX = pos.current;
      else world.current.dummyX = pos.current;
      if (g) {
        g.position.x = pos.current;
        g.position.y = y.current;
        g.rotation.y = facing.current === 1 ? 0 : Math.PI;
      }
      actionRef.current = action.current;
      return;
    }

    const deadNow = hp <= 0 && !finisher;
    const stunnedNow = stunned && !deadNow;

    // --- dirilme animasyonu: durum makinesi devre dışı ---
    if (reviveLeft.current > 0) {
      reviveLeft.current -= dt;
      action.current = 'revive';
      if (reviveLeft.current <= 0) action.current = 'idle';
    }

    // --- dash (skill) uygula ---
    const dashKey = side === 'player' ? 'playerDash' : 'dummyDash';
    if (world.current[dashKey] !== 0) {
      pos.current = MathUtils.clamp(pos.current + world.current[dashKey], ARENA_MIN_X, ARENA_MAX_X);
      world.current[dashKey] = 0;
    }

    if (finisher) {
      // Finisher: gövde ayakta kalır, uzuv çekilene kadar sersem sallanır.
      attack.current = null;
      action.current = 'stun';
    } else if (deadNow) {
      attack.current = null;
      action.current = 'dead';
    } else if (victory) {
      attack.current = null;
      action.current = 'victory';
    } else if (reviveLeft.current <= 0 && stunnedNow) {
      attack.current = null;
      action.current = 'stun';
    } else if (reviveLeft.current <= 0 && active && !attack.current) {
      if (isPlayer) {
        const p = keyboard.pressed.current;
        const j = keyboard.justPressed.current;

        if (j['KeyE']) onCast('e');
        if (j['KeyC']) onCast('c');
        if (j['KeyQ']) onCast('q');
        if (j['KeyR']) onCast('ult');

        const input: PlayerInput = {
          left: !!(p['KeyA'] || p['ArrowLeft'] || touchInput.left),
          right: !!(p['KeyD'] || p['ArrowRight'] || touchInput.right),
          crouch: !!(p['KeyS'] || p['ArrowDown'] || touchInput.crouch),
          run: !!(p['ShiftLeft'] || p['ShiftRight']),
          jump: !!(j['Space'] || j['ArrowUp'] || touchInput.jump),
          attack:
            touchInput.attack ??
            (mouse.current.punch ? 'punch' : mouse.current.kick ? 'kick' : null),
        };
        applyInput(input, dt);
      } else {
        // --- bot ---
        const dx = opponentX() - pos.current;
        const dist = Math.abs(dx);
        aiTimer.current -= dt;
        if (aiTimer.current <= 0) {
          const r = Math.random();
          if (hp < 50 && r < 0.22) {
            onCast('ult');
            aiTimer.current = 1.6;
          } else if (r < 0.3) {
            onCast((['e', 'c', 'q'] as SkillId[])[Math.floor(Math.random() * 3)]);
            aiTimer.current = 1.1;
          } else if (dist < ATTACK_RANGE + 0.4 && r < 0.62) {
            startAttack(Math.random() < 0.5 ? 'punch' : 'kick');
            aiTimer.current = 0.8 + Math.random() * 0.6;
          } else if (dist > 2.0) {
            pos.current += (dx > 0 ? 1 : -1) * MOVE_SPEED * 0.75 * dt;
            action.current = 'walk';
            aiTimer.current = 0.25;
          } else {
            action.current = 'idle';
            aiTimer.current = 0.3;
          }
        }
      }
    }

    // --- saldırı zamanlayıcı ---
    if (attack.current && reviveLeft.current <= 0) {
      timer.current -= dt;
      const a = attack.current;
      const elapsed = a.dur - timer.current;
      const hitWindow = a.pose === 'airkick' ? elapsed > 0.12 && elapsed < 0.34 : elapsed > 0.06 && elapsed < 0.2;
      if (hitWindow) tryHit(a.dmg, a.range);
      if (timer.current <= 0) {
        attack.current = null;
        if (!deadNow && !stunnedNow) action.current = y.current > 0.001 ? 'jump' : 'idle';
      }
    }

    // --- yerçekimi ---
    if (y.current > 0 || vy.current > 0) {
      vy.current += GRAVITY * dt;
      y.current += vy.current * dt;
      if (y.current <= 0) {
        y.current = 0;
        vy.current = 0;
      }
    }

    // --- otomatik yönelme (dövüş oyunu standardı) ---
    const dxFace = opponentX() - pos.current;
    if (!deadNow && Math.abs(dxFace) > 0.3) facing.current = dxFace > 0 ? 1 : -1;

    // --- arena sınırı: haritanın dışına çıkılmaz ---
    pos.current = MathUtils.clamp(pos.current, ARENA_MIN_X, ARENA_MAX_X);

    // --- dünyaya yaz ---
    if (side === 'player') world.current.playerX = pos.current;
    else world.current.dummyX = pos.current;

    if (g) {
      g.position.x = pos.current;
      g.position.y = y.current;
      g.rotation.y = facing.current === 1 ? 0 : Math.PI;
    }

    // --- pozlama ---
    const act = action.current;
    actionRef.current = act;

    // GLB varsa pozu modelin kendisi (klipler) ya da GLBModel içindeki kök oynatma sürer.
    if (!modelUrl || deadNow) {
      // Saldırı penceresi: 0 →1→0 (vuruş ortada).
      const a = attack.current;
      const env =
        a && reviveLeft.current <= 0
          ? Math.sin(Math.min(1, MathUtils.clamp((a.dur - timer.current) / a.dur, 0, 1)) * Math.PI)
          : 0;
      const isLow = act === 'lowpunch' || act === 'lowkick';
      const reviveP = reviveLeft.current > 0 ? MathUtils.clamp(1 - reviveLeft.current / 0.95, 0, 1) : 1;
      const targetBodyY = act === 'crouch' || isLow ? -0.26 : 0;
      const targetLean = deadNow
        ? -1.5 * reviveP
        : act === 'punch'
          ? -0.2 * (1 + env * 0.3)
          : act === 'kick'
            ? 0.1
            : act === 'stun'
              ? 0.34
              : 0;

      if (body.current) {
        body.current.position.y = MathUtils.damp(body.current.position.y, targetBodyY, 10, dt);
        body.current.rotation.x = MathUtils.damp(body.current.rotation.x, targetLean, 9, dt);
        // Ölüyken yere yatar.
        if (deadNow) body.current.position.y = MathUtils.damp(body.current.position.y, -0.22 * reviveP, 8, dt);
      }

      // --- kol/bacak ileri uzaması: el ve ayak gerçekten öne gitsin ---
      const punchAmt = act === 'punch' ? Math.PI / 2 : act === 'lowpunch' ? Math.PI / 2.6 : 0;
      const kickAmt = act === 'kick' || act === 'airkick' ? Math.PI / 2.1 : act === 'lowkick' ? Math.PI / 2.9 : 0;
      const armReach = punchAmt > 0 ? 0.26 * env : 0;
      const legReach = kickAmt > 0 ? 0.34 * env : 0;

      if (armFront.current) {
        armFront.current.rotation.z = MathUtils.damp(armFront.current.rotation.z, punchAmt, 26, dt);
        armFront.current.position.x = MathUtils.damp(armFront.current.position.x, armReach, 26, dt);
      }
      if (armBack.current) {
        armBack.current.rotation.z = MathUtils.damp(armBack.current.rotation.z, act === 'punch' ? 0.4 : 0, 16, dt);
        armBack.current.position.x = MathUtils.damp(armBack.current.position.x, -armReach * 0.4, 16, dt);
      }
      if (legFront.current) {
        legFront.current.rotation.z = MathUtils.damp(legFront.current.rotation.z, kickAmt, 22, dt);
        legFront.current.position.x = MathUtils.damp(legFront.current.position.x, legReach, 22, dt);
      }
      if (legBack.current) {
        legBack.current.rotation.z = MathUtils.damp(legBack.current.rotation.z, act === 'kick' ? -0.22 : 0, 14, dt);
        legBack.current.position.x = MathUtils.damp(legBack.current.position.x, -legReach * 0.3, 14, dt);
      }
      if (head.current) {
        const shake = act === 'stun' ? Math.sin(performance.now() * 0.03) * 0.12 : 0;
        head.current.rotation.z = MathUtils.damp(head.current.rotation.z, side === 'player' ? -0.05 : 0.05, 8, dt) + shake;
      }
    }

    // tek-seferlik girdileri sıfırla
    if (isPlayer) {
      onLocalState?.({ x: pos.current, y: y.current, facing: facing.current, action: attack.current?.pose ?? action.current });
      keyboard.justPressed.current = {};
      mouse.current.punch = false;
      mouse.current.kick = false;
      touchInput.jump = false;
      touchInput.attack = null;
    }
  });

  const { color, accent } = character;

  // Primitif rig (GLB yoksa) de uzvunu kaybeder.
  const headGone = dismember === 'head' || dismember === 'headArm';
  const armGone = dismember === 'arm' || dismember === 'headArm' || dismember === 'arms';
  const legGone = dismember === 'legs';

  const rig = (
    <group ref={body}>
        {/* gövde */}
        <mesh castShadow position={[0, 1.05, 0]}>
          <boxGeometry args={[0.32, 0.72, 0.5]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.15} />
        </mesh>
        <mesh position={[0.17, 1.12, 0]}>
          <boxGeometry args={[0.06, 0.4, 0.34]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
        </mesh>
        {/* ön bacak altı (kalça) */}
        <mesh position={[0, 0.45, 0.09]}>
          <boxGeometry args={[0.3, 0.28, 0.36]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        {/* kafa */}
        {!headGone && (
        <group ref={head} position={[0, 1.62, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.21, 24, 24]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
          <mesh position={[0.16, 0.02, 0.08]}>
            <boxGeometry args={[0.05, 0.06, 0.06]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
          </mesh>
          <mesh position={[0.16, 0.02, -0.08]}>
            <boxGeometry args={[0.05, 0.06, 0.06]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
          </mesh>
        </group>
        )}
        {/* ön kol */}
        {!armGone && (
        <group ref={armFront} position={[0, 1.36, 0.31]}>
          <mesh castShadow position={[0, -0.28, 0]}>
            <boxGeometry args={[0.15, 0.58, 0.15]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        </group>
        )}
        {/* arka kol */}
        <group ref={armBack} position={[0, 1.36, -0.31]}>
          <mesh castShadow position={[0, -0.28, 0]}>
            <boxGeometry args={[0.15, 0.58, 0.15]} />
            <meshStandardMaterial color={accent} roughness={0.6} />
          </mesh>
        </group>
        {/* ön bacak */}
        {!legGone && (
        <group ref={legFront} position={[0, 0.72, 0.13]}>
          <mesh castShadow position={[0, -0.34, 0]}>
            <boxGeometry args={[0.16, 0.68, 0.16]} />
            <meshStandardMaterial color="#22242c" roughness={0.7} />
          </mesh>
        </group>
        )}
        {/* arka bacak */}
        {!legGone && (
        <group ref={legBack} position={[0, 0.72, -0.13]}>
          <mesh castShadow position={[0, -0.34, 0]}>
            <boxGeometry args={[0.16, 0.68, 0.16]} />
            <meshStandardMaterial color="#22242c" roughness={0.7} />
          </mesh>
        </group>
        )}
    </group>
  );

  return (
    <group ref={root}>
      {modelUrl ? (
        <ModelBoundary fallback={rig}>
          <Suspense fallback={rig}>
            <GLBModel
              url={modelUrl}
              characterId={character.id}
              handUrl={handUrl}
              backUrl={backUrl}
              backId={backId}
              actionRef={actionRef}
              dismember={dismember}
            />
          </Suspense>
        </ModelBoundary>
      ) : (
        rig
      )}

      {/* buff aurası */}
      {buffed && (
        <mesh position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.95, 20, 20]} />
          <meshBasicMaterial color={accent} transparent opacity={0.16} />
        </mesh>
      )}
    </group>
  );
}
