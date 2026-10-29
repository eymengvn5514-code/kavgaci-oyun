import { sortedCharacters } from '../data/characters';
import type { StageId } from '../game/types';
import type {
  ClientMessage,
  LobbySnapshot,
  MatchInfo,
  NetStatus,
  PeerState,
  ServerMessage,
} from './protocol';

export const QUEUE_MS = 30_000;
export const PICK_MS = 30_000;
export const VOTE_MS = 30_000;

const STAGE_IDS: StageId[] = ['colosseum', 'lava', 'voxel', 'ice', 'citadel'];
const CHAR_IDS = sortedCharacters.map((c) => c.id);
const BOT_NAMES = ['Gezgin', 'Kaya', 'Volkan', 'Sessiz', 'Poyraz', 'Karadelik'];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function emptySnapshot(): LobbySnapshot {
  return {
    status: 'idle',
    count: 0,
    players: [],
    phase: 'idle',
    role: null,
    opponentName: '',
    myPick: null,
    opponentPick: null,
    votes: { p1: null, p2: null },
    deadline: 0,
    stage: null,
    reason: null,
  };
}

/**
 * Online istemci — tek örnek. WebSocket sunucusuna bağlanır; sunucu yoksa
 * (yerel geliştirme) tarayıcı içi simülasyona düşer ve akış yine tam çalışır.
 */
class NetClient {
  private listeners = new Set<() => void>();
  private snap: LobbySnapshot = emptySnapshot();
  private ws: WebSocket | null = null;
  private simulated = false;
  private connectTried = false;
  private profile = { name: 'Oyuncu', xp: 0 };
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private stateCbs = new Set<(s: PeerState) => void>();
  private hitCbs = new Set<(dmg: number, stun: number, src?: string) => void>();
  private skillCbs = new Set<(id: string) => void>();

  /** Dövüş sırasında rakibin son durumu (konum/yön/aksiyon/can). */
  peerState: PeerState | null = null;
  /** Başlayan maçın sabit bilgisi (GameScreen okur). */
  matchInfo: MatchInfo | null = null;

  /* ---- abonelik (useSyncExternalStore) ---- */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snap;

  onPeerState(fn: (s: PeerState) => void) {
    this.stateCbs.add(fn);
    return () => {
      this.stateCbs.delete(fn);
    };
  }
  onPeerHit(fn: (dmg: number, stun: number, src?: string) => void) {
    this.hitCbs.add(fn);
    return () => {
      this.hitCbs.delete(fn);
    };
  }
  onPeerSkill(fn: (id: string) => void) {
    this.skillCbs.add(fn);
    return () => {
      this.skillCbs.delete(fn);
    };
  }

  private patch(partial: Partial<LobbySnapshot>) {
    this.snap = { ...this.snap, ...partial };
    for (const fn of this.listeners) fn();
  }

  private clearTimers() {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
  }

  /** Bağlantıyı kur (idempotent). Simülasyona düşerse `status: 'simulated'`. */
  connect() {
    if (this.connectTried) return;
    this.connectTried = true;
    const params = new URLSearchParams(location.search);
    const url = params.get('server')
      ?? (import.meta.env.VITE_WS_URL as string | undefined)
      ?? 'wss://kavgaci-online.onrender.com';

    if (!url) {
      this.startSimulation();
      return;
    }

    this.patch({ status: 'connecting' });
    let opened = false;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      const fallback = setTimeout(() => {
        if (!opened) {
          try {
            ws.close();
          } catch {
            /* yoksay */
          }
          this.ws = null;
          this.startSimulation();
        }
      }, 75_000);
      this.timers.push(fallback);

      ws.onopen = () => {
        opened = true;
        clearTimeout(fallback);
        netDebug.open = true;
        this.patch({ status: 'online' });
        this.sendProfile();
        this.keepAlive = setInterval(() => this.send({ t: 'ping' }), 25_000);
      };
      ws.onmessage = (ev) => {
        try {
          this.handle(JSON.parse(ev.data as string) as ServerMessage);
        } catch {
          /* bozuk mesaj */
        }
      };
      ws.onerror = () => {
        if (!opened) {
          this.ws = null;
        } else {
          this.patch({ status: 'error' });
        }
      };
      ws.onclose = () => {
        if (this.keepAlive) clearInterval(this.keepAlive);
        this.keepAlive = null;
        if (this.snap.status === 'online') this.patch({ status: 'error', phase: 'canceled', reason: 'net.disconnected' });
      };
    } catch {
      this.startSimulation();
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  setProfile(name: string, xp: number) {
    this.profile = {
      name: name.trim().slice(0, 24) || 'Oyuncu',
      xp: Math.max(0, Math.min(1_000_000, Math.floor(Number(xp) || 0))),
    };
    this.sendProfile();
  }

  private sendProfile() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.send({ t: 'profile', ...this.profile });
  }

  /* ---- dış API ---- */
  queue(name: string, character: string) {
    if (this.simulated) return this.simQueue();
    this.send({ t: 'queue', name, character });
  }

  cancel() {
    if (this.simulated) return this.simCancel();
    this.send({ t: 'cancel' });
  }

  pickCharacter(character: string) {
    if (this.simulated) return this.simPick(character);
    this.patch({ myPick: character });
    this.send({ t: 'pick', character });
  }

  vote(stage: string) {
    if (this.simulated) return this.simVote(stage);
    this.patch({ votes: { ...this.snap.votes, [this.snap.role ?? 'p1']: stage } });
    this.send({ t: 'vote', stage });
  }

  /** Dövüş sırasında kendi dövüşçü durumunu rakibe yolla. */
  sendState(s: PeerState) {
    if (this.simulated) return;
    netDebug.lastSent = s;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      netDebug.sendFail++;
      return;
    }
    netDebug.sent++;
    this.send({ t: 'state', s });
  }

  /** Rakibe isabet bildir (hasar orada uygulanır). `src` = vuruşun kaynağı (ult/e). */
  sendHit(dmg: number, stun: number, src?: string) {
    if (this.simulated) return;
    this.send({ t: 'hit', dmg: Math.round(dmg), stun, ...(src ? { src } : {}) });
  }

  /** Yetenek tetiklemesini rakibe yolla (rakibin ekranında da oynasın). */
  sendSkill(id: string) {
    if (this.simulated) return;
    this.send({ t: 'skill', id });
  }

  reset() {
    this.clearTimers();
    this.matchInfo = null;
    this.peerState = null;
    this.patch({ ...emptySnapshot(), status: this.snap.status, count: this.snap.count });
  }

  /* ---- sunucu mesajlarını işle ---- */
  private handle(msg: ServerMessage) {
    switch (msg.t) {
      case 'hello':
        this.patch({ status: 'online', count: msg.count });
        break;
      case 'count':
        this.patch({ count: msg.n });
        break;
      case 'board':
        this.patch({ players: msg.players });
        break;
      case 'queued':
        this.patch({ phase: 'queue', deadline: msg.deadline, reason: null });
        break;
      case 'match':
        this.patch({
          phase: 'pick',
          role: msg.role,
          opponentName: msg.opponent.name,
          opponentPick: msg.opponent.character,
          deadline: msg.deadline,
          myPick: null,
        });
        break;
      case 'opponentPicked':
        this.patch({ opponentPick: msg.character });
        break;
      case 'phase':
        this.patch({ phase: 'vote', deadline: msg.deadline });
        break;
      case 'voteUpdate':
        this.patch({ votes: msg.votes });
        break;
      case 'start':
        this.matchInfo = {
          stage: msg.stage,
          role: msg.role,
          myChar: msg.myChar,
          oppChar: msg.oppChar,
          simulated: false,
        };
        this.patch({ phase: 'starting', stage: msg.stage });
        break;
      case 'cancel':
        this.patch({ phase: 'canceled', reason: msg.reason, deadline: 0 });
        break;
      case 'peerState':
        netDebug.received++;
        netDebug.lastRecv = msg.s;
        this.peerState = msg.s;
        for (const fn of this.stateCbs) fn(msg.s);
        break;
      case 'peerHit':
        for (const fn of this.hitCbs) fn(msg.dmg, msg.stun, msg.src);
        break;
      case 'peerSkill':
        for (const fn of this.skillCbs) fn(msg.id);
        break;
      case 'peerLeft':
        this.matchInfo = null;
        this.patch({ phase: 'canceled', reason: 'net.peerLeft', deadline: 0 });
        break;
    }
  }

  /* ================= yerel simülasyon (sunucu yok) ================= */
  private startSimulation() {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
    this.simulated = true;
    const status: NetStatus = 'simulated';
    this.patch({ status, count: 0, players: [] });
  }

  private simQueue() {
    this.patch({ phase: 'queue', deadline: Date.now() + QUEUE_MS, reason: null });
    // rakip "bulunur" → karşı seçime geç
    this.timers.push(
      setTimeout(() => {
        if (this.snap.phase !== 'queue') return;
        this.patch({
          phase: 'pick',
          role: 'p1',
          opponentName: pick(BOT_NAMES),
          opponentPick: null,
          myPick: null,
          deadline: Date.now() + PICK_MS,
        });
      }, 1800 + Math.random() * 2200),
    );
  }

  private simPick(character: string) {
    this.patch({ myPick: character });
    this.timers.push(
      setTimeout(() => {
        if (this.snap.phase !== 'pick') return;
        this.patch({
          phase: 'vote',
          opponentPick: pick(CHAR_IDS),
          deadline: Date.now() + VOTE_MS,
        });
      }, 1400 + Math.random() * 1600),
    );
  }

  private simVote(stage: string) {
    this.patch({ votes: { ...this.snap.votes, p1: stage } });
    this.timers.push(
      setTimeout(() => {
        if (this.snap.phase !== 'vote') return;
        const opp = pick(STAGE_IDS);
        this.patch({ votes: { p1: stage, p2: opp } });
        const resolved = opp === stage ? stage : pick(STAGE_IDS);
        this.matchInfo = {
          stage: resolved,
          role: 'p1',
          myChar: this.snap.myPick ?? pick(CHAR_IDS),
          oppChar: this.snap.opponentPick ?? pick(CHAR_IDS),
          simulated: true,
        };
        this.patch({ phase: 'starting', stage: resolved });
      }, 1500 + Math.random() * 1800),
    );
  }

  private simCancel() {
    this.clearTimers();
    this.patch({ phase: 'idle', deadline: 0, role: null, opponentName: '', myPick: null, opponentPick: null });
  }
}

export const net = new NetClient();

/** DEV teşhis: ağ sayaçları (yalnız geliştirmede window.__net). */
export const netDebug = {
  open: false,
  sent: 0,
  received: 0,
  sendFail: 0,
  lastSent: null as PeerState | null,
  lastRecv: null as PeerState | null,
};

if (import.meta.env.DEV) {
  (window as unknown as { __net?: unknown }).__net = netDebug;
}
