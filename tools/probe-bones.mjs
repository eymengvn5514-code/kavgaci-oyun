// Kemik hedefleme doğrulaması: GLBModel'in `findBone` (sonda-eşleşme) mantığı
// gerçek iskeletlerde hangi kemiği buluyor? Uzuv koparma bunun üstüne kurulu.
import fs from 'node:fs';
import path from 'node:path';

const MATCHERS = ['head', 'leftarm', 'rightarm', 'leftupleg', 'rightupleg'];

function readGlb(file) {
  const buf = fs.readFileSync(file);
  let off = 12;
  let json = null;
  const total = buf.readUInt32LE(8);
  while (off + 8 <= Math.min(total, buf.length)) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(data));
    off += 8 + len;
  }
  return json;
}

/** three.js Object3D.traverse sırası: kökten derinlemesine ön-sıra. */
function preorder(json) {
  const nodes = json.nodes ?? [];
  const out = [];
  const walk = (i) => {
    out.push(i);
    for (const c of nodes[i].children ?? []) walk(c);
  };
  for (const r of json.scenes?.[0]?.nodes ?? []) walk(r);
  return out;
}

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '');

function findBone(names, ...wanted) {
  const w = wanted.map(norm);
  return names.find((n) => w.some((x) => norm(n).endsWith(x)));
}

const dir = path.join(process.cwd(), 'frontend', 'src', 'assets', 'models');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb'));

for (const f of files) {
  const json = readGlb(path.join(dir, f));
  const order = preorder(json);
  const joints = new Set();
  for (const mesh of json.nodes ?? []) if (mesh.skin !== undefined) for (const j of json.skins[mesh.skin].joints) joints.add(j);
  const names = order.filter((i) => joints.has(i)).map((i) => json.nodes[i].name);
  if (names.length === 0) {
    console.log(`${f.padEnd(16)} statik (kemik yok)`);
    continue;
  }
  const hit = MATCHERS.map((m) => `${m}->${findBone(names, m) ?? 'YOK'}`);
  console.log(`${f.padEnd(16)} kemik=${String(names.length).padStart(3)}  ${hit.join('  ')}`);
}
