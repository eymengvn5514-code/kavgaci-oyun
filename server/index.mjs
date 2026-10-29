/**
 * KAVGACI online sunucusu — saf WebSocket (ws).
 *
 * Akış:  queue (30sn)  →  pick (30sn)  →  vote (30sn, berabere = rastgele)  →  fight
 *  - İki oyuncu eşleşince karakter seçer, sonra haritaya oy verir.
 *  - Dövüş fazında durum (state: konum/yön/aksiyon/can), isabet (hit) ve yetenek
 *    olayları (skill) karşı tarafa aktarılır.
 *
 * Dağıtım: Vercel WS tutmaz. Bu dosyayı Render / Railway / Fly / Koyeb gibi
 * bir Node host'una koy; ön yüzde `VITE_WS_URL=wss://...` ver.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8788);
const QUEUE_MS = 30_000;
const PICK_MS = 30_000;
const VOTE_MS = 30_000;
const STAGES = ['colosseum', 'lava', 'voxel', 'ice', 'citadel'];

const clients = new Map(); // id -> client
const matches = new Map(); // id -> match
let queue = [];
let matchSeq = 1;
const charPool = new Set(['frozman']);

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickChar = () => rand([...charPool]);
const now = () => Date.now();

function send(id, msg) {
  const c = clients.get(id);
  if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
}

function broadcastCount() {
  const n = clients.size;
  for (const c of clients.values()) send(c.id, { t: 'count', n });
}

function dropFromQueue(c) {
  queue = queue.filter((x) => x !== c.id);
  if (c.status === 'queue') c.status = 'idle';
}

function cancelMatch(match, reason) {
  for (const cid of [match.p1, match.p2]) {
    const c = clients.get(cid);
    if (!c) continue;
    c.status = 'idle';
    c.matchId = null;
    c.picked = null;
    c.voted = null;
    send(cid, { t: 'cancel', reason });
  }
  matches.delete(match.id);
}

function beginVote(match) {
  match.phase = 'vote';
  match.voteDeadline = now() + VOTE_MS;
  for (const cid of [match.p1, match.p2]) {
    send(cid, { t: 'phase', phase: 'vote', deadline: match.voteDeadline });
  }
}

function resolveVote(match) {
  const { p1, p2 } = match.votes;
  const stage = p1 && p2 && p1 === p2 ? p1 : rand(STAGES);
  match.stage = stage;
  match.phase = 'fight';
  for (const cid of [match.p1, match.p2]) {
    const role = cid === match.p1 ? 'p1' : 'p2';
    const mine = clients.get(cid)?.character ?? 'frozman';
    const opp = clients.get(role === 'p1' ? match.p2 : match.p1)?.character ?? 'frozman';
    send(cid, { t: 'start', stage, role, myChar: mine, oppChar: opp });
  }
}

function tryMatch() {
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    const ca = clients.get(a);
    const cb = clients.get(b);
    if (!ca || !cb) continue;
    const match = {
      id: 'm' + matchSeq++,
      p1: a,
      p2: b,
      phase: 'pick',
      pickDeadline: now() + PICK_MS,
      votes: {},
      stage: null,
    };
    matches.set(match.id, match);
    ca.status = cb.status = 'match';
    ca.matchId = cb.matchId = match.id;
    ca.picked = cb.picked = null;
    ca.voted = cb.voted = null;
    send(a, { t: 'match', role: 'p1', opponent: { name: cb.name, character: cb.character }, deadline: match.pickDeadline });
    send(b, { t: 'match', role: 'p2', opponent: { name: ca.name, character: ca.character }, deadline: match.pickDeadline });
  }
}

function onMessage(c, msg) {
  switch (msg.t) {
    case 'queue': {
      if (c.status !== 'idle') return;
      c.status = 'queue';
      c.queuedAt = now();
      if (typeof msg.name === 'string' && msg.name) c.name = msg.name.slice(0, 24);
      if (typeof msg.character === 'string' && msg.character) {
        c.character = msg.character;
        charPool.add(msg.character);
      }
      queue.push(c.id);
      send(c.id, { t: 'queued', deadline: now() + QUEUE_MS });
      tryMatch();
      break;
    }
    case 'cancel': {
      dropFromQueue(c);
      if (c.matchId) {
        const m = matches.get(c.matchId);
        if (m) cancelMatch(m, 'online.canceled');
      }
      send(c.id, { t: 'cancel', reason: 'online.canceled' });
      break;
    }
    case 'pick': {
      const m = matches.get(c.matchId);
      if (!m || m.phase !== 'pick') return;
      if (typeof msg.character === 'string' && msg.character) {
        c.character = msg.character;
        charPool.add(msg.character);
      }
      c.picked = c.character;
      for (const cid of [m.p1, m.p2]) {
        const peer = clients.get(cid === m.p1 ? m.p2 : m.p1);
        send(cid, { t: 'opponentPicked', character: peer?.picked ?? null });
      }
      if (clients.get(m.p1)?.picked && clients.get(m.p2)?.picked) beginVote(m);
      break;
    }
    case 'vote': {
      const m = matches.get(c.matchId);
      if (!m || m.phase !== 'vote') return;
      const role = c.id === m.p1 ? 'p1' : 'p2';
      m.votes[role] = STAGES.includes(msg.stage) ? msg.stage : rand(STAGES);
      for (const cid of [m.p1, m.p2]) {
        send(cid, { t: 'voteUpdate', votes: { p1: m.votes.p1 ?? null, p2: m.votes.p2 ?? null } });
      }
      if (m.votes.p1 && m.votes.p2) resolveVote(m);
      break;
    }
    case 'state': {
      const m = matches.get(c.matchId);
      if (!m || m.phase !== 'fight') return;
      const peer = c.id === m.p1 ? m.p2 : m.p1;
      const s = msg.s;
      if (!s || typeof s !== 'object') return;
      send(peer, { t: 'peerState', s });
      break;
    }
    case 'hit': {
      const m = matches.get(c.matchId);
      if (!m || m.phase !== 'fight') return;
      const peer = c.id === m.p1 ? m.p2 : m.p1;
      const dmg = Math.max(0, Math.min(200, Number(msg.dmg) || 0));
      const stun = Math.max(0, Math.min(5, Number(msg.stun) || 0));
      const src = typeof msg.src === 'string' ? msg.src.slice(0, 8) : undefined;
      if (dmg > 0) send(peer, { t: 'peerHit', dmg, stun, ...(src ? { src } : {}) });
      break;
    }
    case 'skill': {
      const m = matches.get(c.matchId);
      if (!m || m.phase !== 'fight') return;
      const peer = c.id === m.p1 ? m.p2 : m.p1;
      send(peer, { t: 'peerSkill', id: String(msg.id || '').slice(0, 8) });
      break;
    }
    default:
      break;
  }
}

function onClose(c) {
  dropFromQueue(c);
  if (c.matchId) {
    const m = matches.get(c.matchId);
    if (m) {
      const peer = c.id === m.p1 ? m.p2 : m.p1;
      matches.delete(m.id);
      const p = clients.get(peer);
      if (p) {
        p.status = 'idle';
        p.matchId = null;
        send(peer, { t: 'peerLeft' });
      }
    }
  }
  clients.delete(c.id);
  broadcastCount();
}

/** Zaman aşımlarını süpür. */
function tick() {
  const t = now();
  for (const c of [...clients.values()]) {
    if (c.status === 'queue' && t - c.queuedAt > QUEUE_MS) {
      dropFromQueue(c);
      send(c.id, { t: 'cancel', reason: 'online.timeout' });
    }
  }
  for (const m of [...matches.values()]) {
    if (m.phase === 'pick' && t > m.pickDeadline) {
      const pa = clients.get(m.p1);
      const pb = clients.get(m.p2);
      if (!pa || !pb) {
        cancelMatch(m, 'net.peerLeft');
        continue;
      }
      if (!pa.picked && !pb.picked) {
        cancelMatch(m, 'online.pickTimeout');
        continue;
      }
      if (!pa.picked) pa.picked = pickChar();
      if (!pb.picked) pb.picked = pickChar();
      beginVote(m);
    } else if (m.phase === 'vote' && t > m.voteDeadline) {
      if (!m.votes.p1) m.votes.p1 = rand(STAGES);
      if (!m.votes.p2) m.votes.p2 = rand(STAGES);
      resolveVote(m);
    }
  }
}

const http = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, count: clients.size, matches: matches.size }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('KAVGACI online server');
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (ws) => {
  const id = randomUUID();
  const client = {
    id,
    ws,
    name: 'Oyuncu',
    character: null,
    status: 'idle',
    matchId: null,
    picked: null,
    voted: null,
    queuedAt: 0,
  };
  clients.set(id, client);
  send(id, { t: 'hello', id, count: clients.size });
  broadcastCount();

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg && typeof msg.t === 'string') onMessage(client, msg);
  });

  ws.on('close', () => onClose(client));
  ws.on('error', () => onClose(client));
});

setInterval(tick, 500);

http.listen(PORT, () => {
  console.log(`[kavgaci] online server ws://localhost:${PORT} (health: http://localhost:${PORT}/health)`);
});
