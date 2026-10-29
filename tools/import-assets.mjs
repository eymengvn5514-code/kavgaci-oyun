// Kullanıcının Desktop'ındaki varlıkları projeye aktarır.
//   node tools/import-assets.mjs
// Idempotent: var olan hedefi üzerine yazar.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const DESK = path.join(os.homedir(), 'Desktop');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FE = path.join(ROOT, 'frontend');

/** [kaynak (Desktop'a göre), hedef (frontend'e göre)] */
const JOBS = [
  // --- ses ---
  ['menü arka plan sesi şarkı\\Açılış Perdesi.mp3', 'public/audio/menu.mp3'],
  ['site oyun açılış effecht sesi\\transition-sound-effects-04.wav', 'public/audio/intro.wav'],
  ['kemik kırılma ses effeckleri\\bone-sound-effects-01.wav', 'public/audio/bone-01.wav'],
  ['kemik kırılma ses effeckleri\\bone-sound-effects-02.wav', 'public/audio/bone-02.wav'],
  ['sesler\\spell-sound-effects-01.wav', 'public/audio/spell-01.wav'],
  ['sesler\\spell-sound-effects-03.wav', 'public/audio/spell-03.wav'],
  ['sesler\\spell-sound-effects-04.wav', 'public/audio/spell-04.wav'],
  ['sesler\\spell-sound-effects-05.wav', 'public/audio/spell-05.wav'],
  ['sesler\\spell-sound-effects-06.wav', 'public/audio/spell-06.wav'],
  ['sesler\\spell-sound-effects-08.wav', 'public/audio/spell-08.wav'],
  ['sesler\\spell-sound-effects-09.wav', 'public/audio/spell-09.wav'],
  ['sesler\\spell-sound-effects-10.wav', 'public/audio/spell-10.wav'],
  ['sesler\\transition-sound-effects-07.wav', 'public/audio/transition-07.wav'],
  ['sesler\\AI Sound Effects-2026-10-18T15-47-50.wav', 'public/audio/spell-ai.wav'],
  // --- görsel ---
  ['oyun açılışında 5sn görüncek resim\\Gemini_Generated_Image_75r8o975r8o975r8.jfif', 'public/intro.jpg'],
  ['map seçildikden sonra mapi tanıtan görseller\\kolezyum tanıtım görseli\\Gemini_Generated_Image_9v8y389v8y389v8y.jfif', 'public/maps/colosseum-1.jpg'],
  ['map seçildikden sonra mapi tanıtan görseller\\kolezyum tanıtım görseli\\Gemini_Generated_Image_uuex4duuex4duuex.jfif', 'public/maps/colosseum-2.jpg'],
  // --- model: karakter ---
  ['crimson vampir adam ekle bunuda\\ringlenmiş animasyonları var.glb', 'src/assets/models/crimson.glb'],
  // --- model: eşya ---
  ['kanatlar\\Meshy_AI_Gilded_Angel_Wings_1018172446_texture.glb', 'src/assets/gear/wings.glb'],
  // --- model: harita ---
  ['map içnide kolezyum fln farklı mapler var\\colezyum.glb', 'src/assets/maps/colosseum.glb'],
  // --- model: tanıtımcı ---
  ['tanıtımcı\\tanıtımcı efe.glb', 'public/tutorial/efe.glb'],
  ['tanıtımcı\\tanıtımcı recep.glb', 'public/tutorial/recep.glb'],
];

let ok = 0;
let missing = 0;
for (const [srcRel, dstRel] of JOBS) {
  const src = path.join(DESK, srcRel);
  const dst = path.join(FE, dstRel);
  if (!fs.existsSync(src)) {
    console.log(`  ATLA  (yok): ${srcRel}`);
    missing++;
    continue;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(2);
  console.log(`  KOPY  ${mb.padStart(7)} MB  ${dstRel}`);
  ok++;
}
console.log(`\nAktarıldı: ${ok}  ·  eksik: ${missing}`);
