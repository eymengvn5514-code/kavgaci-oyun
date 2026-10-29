// "değişik farklı şeyler" klasörünü tarar, her .glb'yi okur ve özet çıkarır.
import fs from 'node:fs';
import path from 'node:path';

const dir = 'C:\\Users\\FlawlessX\\Desktop\\my game\\değişik farklı şeyler';
const CHUNK_JSON = 0x4e4f534a;

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546c67) return null;
  const total = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  while (off + 8 <= Math.min(total, buf.length)) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(buf.subarray(off + 8, off + 8 + len)));
    off += 8 + len;
  }
  return json;
}

const files = [];
function walk(p) {
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.glb$/i.test(entry.name)) files.push(full);
  }
}
walk(dir);

for (const f of files) {
  const rel = path.relative(dir, f);
  const sizeMb = (fs.statSync(f).size / 1024 / 1024).toFixed(1);
  const json = readGlb(f);
  if (!json) { console.log(`\n### ${rel}  (${sizeMb} MB)  -> GEÇERSİZ`); continue; }
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const accessors = json.accessors ?? [];
  let verts = 0;
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const m of meshes) for (const p of m.primitives ?? []) {
    const a = accessors[p.attributes?.POSITION];
    if (a) { verts += a.count; if (a.min && a.max) for (let i = 0; i < 3; i++) { box.min[i] = Math.min(box.min[i], a.min[i]); box.max[i] = Math.max(box.max[i], a.max[i]); } }
  }
  const size = box.min[0] === Infinity ? [0, 0, 0] : box.min.map((v, i) => +(box.max[i] - v).toFixed(2));
  const skins = json.skins?.length ?? 0;
  const anims = (json.animations ?? []).map((a) => a.name);
  const mats = json.materials?.length ?? 0;
  const imgBytes = (json.images ?? []).reduce((s, img) => {
    const bv = img.bufferView != null ? json.bufferViews[img.bufferView] : null;
    return s + (bv?.byteLength ?? 0);
  }, 0);
  console.log(`\n### ${rel}`);
  console.log(`  ${sizeMb} MB | vertex ${verts.toLocaleString('tr-TR')} | bbox(X,Y,Z) ${size.join(' x ')} | skin ${skins} | materyal ${mats} | doku ${(imgBytes/1024/1024).toFixed(1)} MB`);
  if (anims.length) console.log(`  animasyonlar: ${anims.join(', ')}`);
  const roots = (json.scenes?.[0]?.nodes ?? []).map((i) => nodes[i]?.name).filter(Boolean);
  console.log(`  kök düğümler: ${roots.join(', ') || '-'}`);
}