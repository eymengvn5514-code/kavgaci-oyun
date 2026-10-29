// Shaman animasyon kliplerini çözer: hangi kemik grubu hareket ediyor (kol/bacak),
// saldırı kliplerinde el/ayağın ileri uzandığı tepe anı (alt klip penceresi) ve
// kuroi iskeletinin gerçek yönü (headfront işaretçisi ile).
import fs from 'node:fs';

function readGlb(file) {
  const buf = fs.readFileSync(file);
  let off = 12;
  let json = null;
  let bin = null;
  const total = buf.readUInt32LE(8);
  while (off + 8 <= Math.min(total, buf.length)) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(data));
    if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  return { json, bin };
}

const COMP = { 5120: [1, Int8Array], 5121: [1, Uint8Array], 5122: [2, Int16Array], 5123: [2, Uint16Array], 5125: [4, Uint32Array], 5126: [4, Float32Array] };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(json, bin, index) {
  const a = json.accessors[index];
  const view = json.bufferViews[a.bufferView];
  const [size] = COMP[a.componentType];
  const comps = NUM[a.type];
  const base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = view.byteStride ?? size * comps;
  const out = [];
  for (let i = 0; i < a.count; i++) {
    const row = [];
    for (let c = 0; c < comps; c++) {
      const at = base + i * stride + c * size;
      row.push(size === 4 ? bin.readFloatLE(at) : size === 2 ? bin.readInt16LE(at) : bin.readInt8(at));
    }
    out.push(row);
  }
  return out;
}

// --- mat4 yardımcıları ---
const mul = (a, b) => {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return r;
};
const fromTRS = (t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) => {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
};
const apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

function worldMatrices(json) {
  const nodes = json.nodes;
  const out = [];
  const walk = (i, parent) => {
    const n = nodes[i];
    const local = n.matrix ? n.matrix : fromTRS(n.translation, n.rotation, n.scale);
    const world = parent ? mul(parent, local) : local;
    out[i] = world;
    for (const c of n.children ?? []) walk(c, world);
  };
  for (const r of json.scenes?.[0]?.nodes ?? []) walk(r, null);
  return out;
}

const file = process.argv[2];
const { json, bin } = readGlb(file);
const wm = worldMatrices(json);
const nodes = json.nodes;

const pos = (name) => {
  const i = nodes.findIndex((n) => (n.name ?? '').toLowerCase() === name.toLowerCase());
  if (i < 0) return null;
  return apply(wm[i], [0, 0, 0]);
};

console.log('### İSKELET YÖNÜ: ' + file.split(/[\\/]/).pop());
for (const key of ['mixamorig:hips', 'mixamorig:head', 'headfront', 'mixamorig:leftfoot', 'mixamorig:lefttoebase', 'mixamorig:lefthand', 'mixamorig:righthand']) {
  const p = pos(key);
  console.log(`  ${key}: ${p ? p.map((v) => v.toFixed(3)).join(', ') : '-'}`);
}
const head = pos('mixamorig:head');
const front = pos('headfront');
const hips = pos('mixamorig:hips');
const lf = pos('mixamorig:leftfoot');
const lt = pos('mixamorig:lefttoebase');
const rf = pos('mixamorig:rightfoot');
const norm2 = (v) => { const l = Math.hypot(v[0], v[2]) || 1; return [v[0] / l, v[2] / l]; };
if (head && front) {
  const d = norm2([front[0] - head[0], 0, front[2] - head[2]]);
  console.log(`  headfront yönü (x,z): ${d.map((v) => v.toFixed(3)).join(', ')}  yaw=${Math.atan2(d[1], d[0]).toFixed(3)}`);
}
if (lf && lt) {
  const d = norm2([lt[0] - lf[0], 0, lt[2] - lf[2]]);
  console.log(`  sol ayak->parmak (x,z): ${d.map((v) => v.toFixed(3)).join(', ')}  yaw=${Math.atan2(d[1], d[0]).toFixed(3)}`);
}
if (lf && rf) {
  const d = norm2([lf[0] - rf[0], 0, lf[2] - rf[2]]);
  console.log(`  sag ayak->sol ayak (x,z): ${d.map((v) => v.toFixed(3)).join(', ')}`);
}
if (hips && head) {
  console.log(`  hips y=${hips[1].toFixed(3)} head y=${head[1].toFixed(3)} -> ${head[1] > hips[1] ? 'DÜZ (yukarı)' : 'TERS (aşağı)'}`);
}

// --- animasyon: hangi kemik grubu oynuyor ---
const group = (name) => {
  const n = name.toLowerCase();
  if (/upleg|leg|foot|toe/.test(n)) return 'bacak';
  if (/arm|shoulder|hand/.test(n)) return 'kol';
  if (/spine|hips|neck|head/.test(n)) return 'gövde';
  return 'diğer';
};

function skeletonAt(anim, t) {
  // t anındaki tüm kanal değerleri (doğrusal interpolasyon)
  const sets = { rot: {}, tr: {} };
  for (const ch of anim.channels ?? []) {
    if (ch.target.path !== 'rotation' && ch.target.path !== 'translation') continue;
    const sampler = anim.samplers[ch.sampler];
    const times = readAccessor(json, bin, sampler.input);
    const values = readAccessor(json, bin, sampler.output);
    let i0 = 0;
    while (i0 < times.length - 1 && times[i0 + 1][0] <= t) i0 += 1;
    const i1 = Math.min(i0 + 1, times.length - 1);
    const a = times[i0][0];
    const b = times[i1][0];
    const f = a === b ? 0 : (t - a) / (b - a);
    const v = values[i0].map((x, c) => x + (values[i1][c] - x) * f);
    if (ch.target.path === 'rotation') sets.rot[ch.target.node] = v;
    else sets.tr[ch.target.node] = v;
  }
  const world = {};
  const walk = (i, parent) => {
    const n = nodes[i];
    const local = fromTRS(sets.tr[i] ?? n.translation ?? [0, 0, 0], sets.rot[i] ?? n.rotation ?? [0, 0, 0, 1], n.scale ?? [1, 1, 1]);
    world[i] = parent ? mul(parent, local) : local;
    for (const c of n.children ?? []) walk(c, world[i]);
  };
  for (const r of json.scenes?.[0]?.nodes ?? []) walk(r, null);
  return world;
}

function maxExtension(anim, boneName) {
  const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const target = nodes.findIndex((n) => norm(n.name).endsWith(norm(boneName)));
  const refs = ['mixamorig:hips', 'hip']
    .map((n) => nodes.findIndex((x) => norm(x.name).endsWith(norm(n))))
    .filter((i) => i >= 0);
  if (target < 0 || refs.length === 0) return { peak: 0, window: [0, 1], maxExt: 0 };
  let durations = 0;
  for (const ch of anim.channels ?? []) {
    const sampler = anim.samplers[ch.sampler];
    const times = readAccessor(json, bin, sampler.input);
    if (times.length && times[times.length - 1][0] > durations) durations = times[times.length - 1][0];
  }
  const frames = Math.max(2, Math.round(durations * 30));
  let best = { t: 0, ext: -Infinity };
  for (let f = 0; f <= frames; f++) {
    const t = (f / frames) * durations;
    const world = skeletonAt(anim, t);
    const p = apply(world[target], [0, 0, 0]);
    let rx = 0, rz = 0;
    for (const r of refs) {
      const q = apply(world[r], [0, 0, 0]);
      rx += q[0]; rz += q[2];
    }
    rx /= refs.length; rz /= refs.length;
    const ext = p[0] - rx;
    if (ext > best.ext) best = { t, ext };
  }
  return { peak: best.t, window: [Math.max(0, best.t - 0.12), Math.min(durations, best.t + 0.45)], maxExt: best.ext };
}

for (const anim of json.animations ?? []) {
  const tally = {};
  let dur = 0;
  let top = [];
  for (const ch of anim.channels ?? []) {
    if (ch.target.path !== 'rotation' && ch.target.path !== 'translation') continue;
    const sampler = anim.samplers[ch.sampler];
    const times = readAccessor(json, bin, sampler.input);
    const values = readAccessor(json, bin, sampler.output);
    if (times.length) dur = Math.max(dur, times[times.length - 1][0]);
    let move = 0;
    for (let i = 1; i < values.length; i++) {
      let d = 0;
      for (let c = 0; c < values[i].length; c++) d += Math.abs(values[i][c] - values[i - 1][c]);
      move += d;
    }
    const name = nodes[ch.target.node]?.name ?? '?';
    const g = group(name);
    tally[g] = (tally[g] ?? 0) + move;
    top.push([name, move]);
  }
  top.sort((a, b) => b[1] - a[1]);
  const parts = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v.toFixed(0)}`).join(' ');
  console.log(`  - ${anim.name} (${dur.toFixed(2)}s, ${anim.channels.length} kanal): ${parts}`);
  console.log(`      en çok: ${top.slice(0, 4).map(([n, v]) => n + '=' + v.toFixed(1)).join(', ')}`);
  if (/attack|^01a131ca|^01a131c9|dead|arise|behit/i.test(anim.name)) {
    const todo = /01a131c9/i.test(anim.name) ? { a: 'righthand', b: 'lefthand' } : { a: 'righthand', b: 'rightfoot' };
    for (const [tag, bone] of Object.entries(todo)) {
      const r = maxExtension(anim, bone);
      console.log(`      uzanim[${bone}] tepe=${r.peak.toFixed(2)}s oneri=[${r.window[0].toFixed(2)}, ${r.window[1].toFixed(2)}] ileri=${r.maxExt.toFixed(3)}m`);
    }
  }
}