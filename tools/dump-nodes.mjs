// Bir GLB'nin node ağacını (transform + mesh/skin referansı) döker.
import fs from 'node:fs';

const file = process.argv[2];
const buf = fs.readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('GLB değil');
const total = buf.readUInt32LE(8);
let off = 12;
let json = null;
while (off + 8 <= Math.min(total, buf.length)) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(buf.subarray(off + 8, off + 8 + len)));
  off += 8 + len;
}

const nodes = json.nodes ?? [];
const meshes = json.meshes ?? [];
const accessors = json.accessors ?? [];
const skins = json.skins ?? [];

const fmt = (v) => (v ? v.map((n) => +(+n).toFixed(4)).join(', ') : '-');
const accessorInfo = (i) => {
  const a = accessors[i];
  if (!a) return '?';
  const name = { 5120: 'i8', 5121: 'u8', 5122: 'i16', 5123: 'u16', 5125: 'u32', 5126: 'f32' }[a.componentType];
  const min = a.min ? a.min.map((n) => +(+n).toFixed(3)).join(',') : '';
  const max = a.max ? a.max.map((n) => +(+n).toFixed(3)).join(',') : '';
  return `${name}${a.normalized ? ' norm' : ''} x${a.count}${min ? ` [${min}]..[${max}]` : ''}`;
};

console.log(`### ${file.split(/[\\/]/).pop()}`);
console.log(`skin sayısı: ${skins.length}`);
for (const [i, s] of skins.entries()) {
  console.log(`  skin[${i}] iskelet kök=${s.skeleton} eklemler=${s.joints?.length} ilk=${s.joints?.[0]}`);
}

let depth = 0;
const walk = (i) => {
  const n = nodes[i];
  if (!n) return;
  const bits = [];
  if (n.translation) bits.push(`T(${fmt(n.translation)})`);
  if (n.rotation) bits.push(`R(${fmt(n.rotation)})`);
  if (n.scale) bits.push(`S(${fmt(n.scale)})`);
  if (n.matrix) bits.push(`M(${n.matrix.map((v) => +v.toFixed(3)).join(',')})`);
  if (n.mesh != null) {
    const prim = meshes[n.mesh]?.primitives?.[0];
    bits.push(`mesh=${n.mesh}(${meshes[n.mesh]?.name ?? ''})`);
    if (prim) bits.push(`POS:${accessorInfo(prim.attributes?.POSITION)}`);
  }
  if (n.skin != null) bits.push(`SKIN=${n.skin}`);
  console.log(`${'  '.repeat(depth + 1)}[${i}] ${n.name ?? ''} ${bits.join(' ')}`);
  depth += 1;
  for (const c of n.children ?? []) walk(c);
  depth -= 1;
};

console.log('sahne kökleri:');
for (const r of json.scenes?.[0]?.nodes ?? []) walk(r);
