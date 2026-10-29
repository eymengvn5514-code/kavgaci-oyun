/**
 * Model boru hattı.
 *
 * KULLANIM
 *   1) İndirdiğin .glb / .gltf dosyasını  ->  `modeller/` klasörüne at
 *   2) Dosyayı karakter id'siyle yeniden adlandır:  frozman.glb, ghost.glb, kuroi.glb ...
 *   3) `npm run models`  (frontend klasöründe)
 *
 * Script her dosyayı sadeleştirir (meshopt + webp 1024) ve
 * `frontend/src/assets/models/<id>.glb` olarak yazar.
 *
 * Dosya adı büyük/küçük harf, boşluk, tire, alt çizgi fark etmez:
 *   "Kuroi Final.glb"  ->  kuroi.glb
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const inbox = path.join(root, 'modeller');
const outDir = path.join(root, 'frontend', 'src', 'assets', 'models');

fs.mkdirSync(inbox, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const normalize = (raw) => raw.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const disabled = process.argv.includes('--keep-source');
const files = fs
  .readdirSync(inbox)
  .filter((f) => /\.(glb|gltf)$/i.test(f) && !f.startsWith('~$'));

if (files.length === 0) {
  console.log(`\n  modeller/ klasörü boş.`);
  console.log(`  İndirdiğin dosyayı buraya at:  ${inbox}`);
  console.log(`  ve karakter id'siyle adlandır (örn. frozman.glb).\n`);
  process.exit(0);
}

console.log(`\n  ${files.length} dosya işleniyor...\n`);

for (const file of files) {
  const id = normalize(file);
  const src = path.join(inbox, file);
  const dst = path.join(outDir, `${id}.glb`);
  const before = fs.statSync(src).size / 1024 / 1024;

  console.log(`  > ${file}  ->  ${id}.glb   (${before.toFixed(1)} MB)`);

  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      '--yes',
      '@gltf-transform/cli',
      'optimize',
      src,
      dst,
      '--texture-compress',
      'webp',
      '--texture-size',
      '1024',
      '--simplify',
      'true',
      '--simplify-error',
      '0.001',
      '--compress',
      'meshopt',
    ],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    console.log(`    !! ${file} optimize edilemedi.\n`);
    continue;
  }

  const after = fs.statSync(dst).size / 1024 / 1024;
  console.log(`    OK  ${after.toFixed(2)} MB  (${(before / after).toFixed(1)}x küçüldü)\n`);

  if (!disabled) fs.rmSync(src, { force: true });
}

console.log(`  Bitti. Modeller:  ${outDir}\n`);
