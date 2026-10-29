/**
 * Online protokolü — istemci ve sunucu (`server/index.mjs`) bu şekli paylaşır.
 *
 * Lobi akışı:  queue (30sn)  →  pick (karakter)  →  vote (harita)  →  fight
 * Maç yoksa 30sn sonunda iptal. Harita oylaması berabere → rastgele.
 *
 * Dövüş: paylaşılan dünya (p1 = sol, p2 = sağ). Her istemci KENDİ dövüşçüsünün
 * durumunu (konum/yön/aksiyon/can) yayınlar; rakip, ağdan gelen durumla sürülen
 * bir "kukla"dır. Hasar: saldıran `hit` yollar, isabet alan kendi canını düşürür.
 */
import type { Action } from '../game/types';

export type Role = 'p1' | 'p2';

/** Dövüşçünün ağ üzerinden yayınlanan anlık durumu. */
export interface PeerState {
  x: number;
  y: number;
  facing: 1 | -1;
  action: Action;
  hp: number;
}

export type LobbyPhase = 'idle' | 'queue' | 'pick' | 'vote' | 'starting' | 'fight' | 'canceled';
export type NetStatus = 'idle' | 'connecting' | 'online' | 'simulated' | 'error';

export interface LobbySnapshot {
  status: NetStatus;
  /** Üstte gösterilen aktif oyuncu sayısı. */
  count: number;
  /** Sunucuya şu anda bağlı gerçek oyuncular. */
  players: Array<{ id: string; name: string; xp: number }>;
  phase: LobbyPhase;
  role: Role | null;
  opponentName: string;
  myPick: string | null;
  opponentPick: string | null;
  votes: { p1: string | null; p2: string | null };
  /** Bu fazın bitiş zamanı (epoch ms). 0 = yok. */
  deadline: number;
  stage: string | null;
  /** İptal/hata sebebi (i18n anahtarı). */
  reason: string | null;
}

export interface MatchInfo {
  stage: string;
  role: Role;
  myChar: string;
  oppChar: string;
  /** Sunucu yoksa (yerel simülasyon) rakip bot AI ile oynar. */
  simulated: boolean;
}

/* ---- sunucu <-> istemci mesajları ---- */
export type ClientMessage =
  | { t: 'ping' }
  | { t: 'profile'; name: string; xp: number }
  | { t: 'queue'; name: string; character: string }
  | { t: 'cancel' }
  | { t: 'pick'; character: string }
  | { t: 'vote'; stage: string }
  | { t: 'state'; s: PeerState }
  | { t: 'hit'; dmg: number; stun: number; src?: string }
  | { t: 'skill'; id: string };

export type ServerMessage =
  | { t: 'pong' }
  | { t: 'hello'; id: string; count: number }
  | { t: 'count'; n: number }
  | { t: 'board'; players: Array<{ id: string; name: string; xp: number }> }
  | { t: 'queued'; deadline: number }
  | { t: 'match'; role: Role; opponent: { name: string; character: string | null }; deadline: number }
  | { t: 'opponentPicked'; character: string | null }
  | { t: 'phase'; phase: 'vote'; deadline: number }
  | { t: 'voteUpdate'; votes: { p1: string | null; p2: string | null } }
  | { t: 'start'; stage: string; role: Role; myChar: string; oppChar: string }
  | { t: 'cancel'; reason: string }
  | { t: 'peerState'; s: PeerState }
  | { t: 'peerHit'; dmg: number; stun: number; src?: string }
  | { t: 'peerSkill'; id: string }
  | { t: 'peerLeft' };
