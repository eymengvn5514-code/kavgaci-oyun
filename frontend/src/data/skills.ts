import type { Character, ElementId } from './characters';

export type SkillId = 'e' | 'c' | 'q' | 'ult';

export type SkillKind = 'projectile' | 'strike' | 'aoe' | 'buff' | 'dash' | 'katana';

export interface SkillDef {
  id: SkillId;
  kind: SkillKind;
  damage: number;
  /** Etki menzili (dünya birimi). */
  range: number;
  /** Cooldown saniye — hepsi 10sn. */
  cd: number;
  color: string;
  /** Efektin yaşam süresi (saniye). */
  duration: number;
  /** Mermi hızı (birim/sn). */
  speed: number;
  /** Vurulan hedefe uygulanan sersemleme (saniye). */
  stun: number;
}

export const SKILL_IDS: SkillId[] = ['e', 'c', 'q', 'ult'];

export const SKILL_KEY_LABEL: Record<SkillId, string> = {
  e: 'E',
  c: 'C',
  q: 'Q',
  ult: 'R',
};

export const SKILL_KIND_LABEL: Record<SkillKind, { tr: string; en: string }> = {
  projectile: { tr: 'Menzilli', en: 'Projectile' },
  strike: { tr: 'Yakın vuruş', en: 'Strike' },
  aoe: { tr: 'Alan hasarı', en: 'Area hit' },
  buff: { tr: 'Güçlendirme', en: 'Power-up' },
  dash: { tr: 'Atılış', en: 'Dash' },
  katana: { tr: 'Katana Yağmuru', en: 'Katana Rain' },
};

/** Tüm yeteneklerin cooldown'u 10 saniye. */
export const SKILL_CD = 10;

/** Elementten yetenek davranış profili: [E, C, Q, Ultimate] */
const PROFILES: Record<ElementId, [SkillKind, SkillKind, SkillKind, SkillKind]> = {
  ice: ['projectile', 'strike', 'buff', 'aoe'],
  lightning: ['aoe', 'projectile', 'strike', 'aoe'],
  fire: ['projectile', 'strike', 'buff', 'aoe'],
  ghost: ['dash', 'projectile', 'aoe', 'dash'],
  zombie: ['strike', 'projectile', 'buff', 'projectile'],
  shadow: ['dash', 'strike', 'buff', 'aoe'],
  earth: ['strike', 'buff', 'aoe', 'aoe'],
  wind: ['projectile', 'aoe', 'dash', 'projectile'],
  water: ['projectile', 'aoe', 'buff', 'aoe'],
  steel: ['strike', 'aoe', 'buff', 'strike'],
  beast: ['strike', 'dash', 'buff', 'dash'],
  cyber: ['projectile', 'projectile', 'aoe', 'aoe'],
  poison: ['projectile', 'aoe', 'strike', 'aoe'],
  sound: ['aoe', 'projectile', 'aoe', 'aoe'],
  light: ['projectile', 'buff', 'buff', 'aoe'],
  blood: ['strike', 'projectile', 'buff', 'aoe'],
  bone: ['projectile', 'projectile', 'aoe', 'aoe'],
  gravity: ['aoe', 'aoe', 'buff', 'aoe'],
  time: ['strike', 'buff', 'buff', 'aoe'],
  nature: ['aoe', 'projectile', 'buff', 'aoe'],
};

/** Sersemletme yeteneği olan elementler. */
const STUN_ELEMENTS: ElementId[] = ['ice', 'lightning', 'sound', 'gravity', 'time', 'poison'];

function durationFor(kind: SkillKind, range: number, speed: number, base: number): number {
  if (kind === 'projectile') return range / speed + 0.7;
  if (kind === 'buff') return 6;
  return base;
}

export function getSkills(c: Character): Record<SkillId, SkillDef> {
  const [eKind, cKind, qKind, ultKind] = PROFILES[c.element];
  const atk = c.stats.atk;
  const rng = c.stats.range;
  const color = c.accent;
  const hasStun = STUN_ELEMENTS.includes(c.element);

  const build = (
    id: SkillId,
    kind: SkillKind,
    damage: number,
    range: number,
    speed: number,
    baseDuration: number,
    stunMult: number,
  ): SkillDef => ({
    id,
    kind,
    // Yetenek hasarları da %20 düşürüldü (yumruk/tekme ile tutarlı).
    damage: Math.round(damage * 0.8),
    range,
    cd: SKILL_CD,
    color,
    duration: durationFor(kind, range, speed, baseDuration),
    speed,
    stun: kind !== 'buff' && hasStun ? 0.9 * stunMult : 0,
  });

  return {
    e: build('e', eKind, 8 + atk, 2 + rng * 0.22, 14, 0.3, 0.8),
    c: build('c', cKind, 12 + atk * 1.3, 2.4 + rng * 0.3, 12, 0.45, 1),
    q: build('q', qKind, qKind === 'buff' ? 0 : 10 + atk, 2.2 + rng * 0.25, 11, 0.5, 0.9),
    ult: build('ult', ultKind, 22 + atk * 1.8, 3.6 + rng * 0.4, 16, 0.9, 1.4),
  };
}
