// GLB içini okur: mesh, iskelet, animasyon, doku ve boyut raporu.
// Kullanım: node tools/inspect-glb.mjs <dosya.glb> [daha fazla...]
import fs from 'node:fs';
import path from 'node:path';

const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546c67) return null;
  const total = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  let binLen = 0;
  while (off + 8 <= Math.min(total, buf.length)) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(data));
    if (type === CHUNK_BIN) binLen = len;
    off += 8 + len;
  }
  return { json, binLen, fileLen: buf.length };
}

const fmt = (n) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB');

function report(file) {
  const glb = readGlb(file);
  if (!glb) {
    console.log(`\n### ${path.basename(file)}\n  !! geçerli bir GLB değil`);
    return;
  }
  const { json: g, binLen, fileLen } = glb;
  console.log(`\n### ${path.basename(file)}`);
  console.log(`  dosya: ${fmt(fileLen)}   (json+binary: ${fmt(fileLen - binLen)} + ${fmt(binLen)})`);

  const ext = [...(g.extensionsUsed ?? []), ...(g.extensionsRequired ?? []).map((e) => e + ' *')];
  if (ext.length) console.log(`  uzantılar: ${[...new Set(ext)].join(', ')}`);

  // --- düğümler / iskelet ---
  const nodes = g.nodes ?? [];
  const roots = (g.scenes?.[0]?.nodes ?? []).map((i) => nodes[i]?.name).filter(Boolean);
  console.log(`  düğüm: ${nodes.length}   kök: ${roots.slice(0, 6).join(', ') || '-'}`);
  const skins = g.skins ?? [];
  if (skins.length) {
    const joints = Math.max(...skins.map((s) => s.joints?.length ?? 0));
    console.log(`  iskelet (skin): ${skins.length}   kemik: ${joints}`);
  } else {
    console.log('  iskelet (skin): YOK  (riglenmemiş — animasyon oynatılamaz)');
  }

  // --- mesh / vertex ---
  const meshes = g.meshes ?? [];
  const accessors = g.accessors ?? [];
  let verts = 0;
  let tris = 0;
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const m of meshes) {
    for (const p of m.primitives ?? []) {
      const posIdx = p.attributes?.POSITION;
      if (posIdx != null) {
        const a = accessors[posIdx];
        verts += a.count ?? 0;
        if (a.min && a.max) {
          for (let i = 0; i < 3; i++) {
            box.min[i] = Math.min(box.min[i], a.min[i]);
            box.max[i] = Math.max(box.max[i], a.max[i]);
          }
        }
      }
      const idx = p.indices;
      if (idx != null) tris += Math.floor((accessors[idx]?.count ?? 0) / 3);
    }
  }
  console.log(`  mesh: ${meshes.length}   vertex: ${verts.toLocaleString('tr-TR')}   üçgen: ${tris.toLocaleString('tr-TR')}`);
  if (Number.isFinite(box.min[0])) {
    const size = box.min.map((v, i) => +(box.max[i] - v).toFixed(3));
    console.log(`  bbox boyut (X,Y,Z): ${size.join(' x ')}   yükseklik(Y): ${size[1]}`);
    console.log(`    -> ${size[0] > size[2] * 1.15 ? 'omuzlar X ekseninde: model +/-Z yönüne bakıyor' : size[2] > size[0] * 1.15 ? 'omuzlar Z ekseninde: model +/-X yönüne bakıyor' : 'belirsiz (kareye yakın)'}`);
  }

  // --- materyal / doku ---
  const mats = g.materials ?? [];
  console.log(`  materyal: ${mats.length}`);
  const images = g.images ?? [];
  const views = g.bufferViews ?? [];
  let imgBytes = 0;
  const imgList = images.map((img, i) => {
    const bv = img.bufferView != null ? views[img.bufferView] : null;
    const bytes = bv?.byteLength ?? 0;
    imgBytes += bytes;
    return `${i}:${(img.mimeType ?? '?').replace('image/', '')}${bytes ? ' ' + fmt(bytes) : ''}${img.name ? ' (' + img.name + ')' : ''}`;
  });
  console.log(`  doku: ${images.length}   toplam ${fmt(imgBytes)}`);
  if (imgList.length) console.log('    ' + imgList.slice(0, 8).join('\n    '));

  // --- animasyon ---
  const anims = g.animations ?? [];
  if (!anims.length) {
    console.log('  animasyon: YOK');
  } else {
    const totalSec = (a) => {
      let max = 0;
      for (const s of a.samplers ?? []) {
        const acc = accessors[s.input];
        if (acc?.max?.[0] > max) max = acc.max[0];
      }
      return max;
    };
    console.log(`  animasyon: ${anims.length}`);
    for (const a of anims) {
      console.log(`    - "${a.name ?? '(isimsiz)'}"  ${totalSec(a).toFixed(2)}sn  ${(a.channels ?? []).length} kanal`);
    }
  }
}

const args = process.argv.slice(2);
if (!args.length) {
  console.log('kullanım: node tools/inspect-glb.mjs <dosya.glb> [daha fazla...]');
  process.exit(1);
}
for (const f of args) report(f);
