export type FighterSide = 'player' | 'dummy';

/**
 * Finisher'da kopan uzuv (fatality) / kırılan kemik (labality).
 * İskelet kemikleri ölçeklenerek sıfıra çöktürülür — uzuv gerçekten gövdeden ayrılır.
 */
export type DismemberKind = 'none' | 'head' | 'arm' | 'headArm' | 'arms' | 'legs';

/** Finisher yakın çekiminin süresi (saniye). */
export const FATALITY_SECONDS = 3.2;

export type AttackPose = 'punch' | 'kick' | 'lowpunch' | 'lowkick' | 'airkick' | 'airpunch';

/** Dövüşçünün anlık durumu — hem primitif hem GLB rig bunu okur. */
export type Action = 'idle' | 'walk' | 'run' | 'jump' | 'crouch' | 'stun' | 'dead' | 'revive' | 'victory' | AttackPose;

/** GLB'nin ölçekleneceği hedef boy (metre). Primitif rig ile aynı. */
export const FIGHTER_HEIGHT = 1.85;

/** Bir dövüşçünün o kareki girdisi (klavye/dokunmatik ya da ağdan). */
export interface PlayerInput {
  left: boolean;
  right: boolean;
  crouch: boolean;
  run: boolean;
  /** Tek seferlik — tüketilince temizlenir. */
  jump: boolean;
  /** Tek seferlik — tüketilince temizlenir. */
  attack: 'punch' | 'kick' | null;
}

export type StageId = 'colosseum' | 'lava' | 'voxel' | 'ice' | 'citadel';

/** Hava modu — maç öncesi seçilir, dövüşte partikül olarak oynar. */
export type WeatherId = 'none' | 'rain' | 'snow' | 'katana';

/** Katana yeteneği 50. seviyede açılır. */
export const KATANA_LEVEL = 50;
/** Katana yağmuru rakibin canının %20'sini götürür. */
export const KATANA_DAMAGE_RATIO = 0.2;
export const KATANA_CD = 14;

/** İki dövüşçünün paylaştığı anlık durum (her frame güncellenir). */
export interface World {
  playerX: number;
  dummyX: number;
  playerStun: number;
  dummyStun: number;
  playerBuff: number;
  dummyBuff: number;
  /** Bekleyen dash mesafesi (skill). Fighter bir sonraki frame uygular. */
  playerDash: number;
  dummyDash: number;
}

export type WorldRef = { current: World };

export const ARENA_HALF_WIDTH = 5.2;
export const ARENA_MIN_X = -ARENA_HALF_WIDTH + 0.4;
export const ARENA_MAX_X = ARENA_HALF_WIDTH - 0.4;

export const MOVE_SPEED = 3.4;
export const JUMP_VELOCITY = 6.2;
export const GRAVITY = -18;

export const ATTACK_RANGE = 1.7;
// Not: yumruk/tekme hasarı %20 düşürüldü (çok vuruyorlardı).
export const PUNCH_DAMAGE = 4;
export const KICK_DAMAGE = 6;
export const CROUCH_PUNCH_DAMAGE = 3;
export const CROUCH_KICK_DAMAGE = 7;

export const MAX_HP = 100;
/** Ultimate bu oranın altına inince açılır. */
export const ULT_HP_THRESHOLD = 0.5;
/** Buff (power-up) hasar çarpanı. */
export const BUFF_MULT = 1.35;
