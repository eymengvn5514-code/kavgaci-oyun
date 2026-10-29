# Kavgaci Oyun — Teknik Tasarım Dokümanı (v0.1)

> 2.5D dövüş oyunu · web sitesi · Vercel/Netlify uyumlu · 20 karakter

---

## 0. Özet Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Görünüm | **2.5D** (3D model, yan görünüş, düz savaş düzlemi) | Meshy + Mixamo burada çalışır, MK tarzı his |
| Motor | **Three.js** (+ WebGL2) | Web'de en yaygın, GLB native, hafif |
| Maç | **1v1** (maçta tek karakter) | istediğin format |
| Programlama dili | **TypeScript** | hata yakalar, ölçeklenir |
| Build/Dev | **Vite** | hızlı, statik çıktı verir |
| Menü UI | **React** (oyun canvas'ı ayrı) | karakter seç / ayarlar / lobi için ideal |
| Model formatı | **GLB** | web standardı |
| Animasyon | **Mixamo (ortak iskelet) → FBX → GLB** | retarget gerekmez, tek animasyon seti 20 karaktere uyar |
| Deploy (site) | **Vercel** veya **Netlify** (statik) | istediğin gibi |
| Deploy (online MP) | **Colyseus** (Node) → Railway/Render'de host | oda + state sync hazır, dövüş oyununa uygun; frontend Vercel'de kalır |
| İlerleme | **Level/unlock** sistemi | başlangıç 3 karakter açık, her level 1 karakter açar |
| Arayüz dili | **TR + EN** (ayarlardan) | i18n, react-i18next |
| Fizik | Basit AABB hitbox/hurtbox | dövüş oyununda tam fizik motoru gereksiz |
| Netcode | Sunucu otoriteli, 60Hz state sync (v1) → sonra rollback | önce çalışsın, sonra rekabetçi |

---

## 1. Dosya Formatı — "FBX mi GLB mi?"

**Web oyunu için cevap: GLB.**

- **Mixamo** yalnızca **FBX** export eder (Binary / ASCII / FBX for Unity). GLB vermez.
- **Meshy** hem GLB hem FBX verir → **GLB'yi seç**.
- Web'de **GLB** kullan. `THREE.GLTFLoader` native ve hızlı. FBX için `FBXLoader` var ama büyük, doku yolları sorunlu, sıkıntılı → kullanma.

### Pipeline (Blender GEREKMEZ)

```
MESHY (model)              -> GLB indir (veya FBX)
   │
   ▼
MIXAMO (auto-rig)          -> karakteri otomatik rigle, FBX indir (Binary, T-pose, With Skin)
   │                          NOT: Mixamo tüm karakterleri AYNI iskeletle diziyor
   │                          → rig farkı olmadığı için retarget GEREKMEZ
   ▼
ANIMASYONLAR               -> her animasyon için FBX indir (Binary, Without Skin, 30fps, "In Place")
   │
   ▼
DÖNÜŞTÜRME (Blender'sız)   -> FBX2glTF (facebookincubator, ücretsiz CLI) veya
   │                          "Coolega Mixamo Converter" / "Mixamo2GLB Animation Merger" (hazır araç)
   │                          ALTERNATİF: dönüştürmeden, Three.js FBXLoader ile FBX'i direkt yükle
   ▼
THREE.JS                   -> GLB + AnimationMixer, sahnede oyna
```

> **Neden Blender'a gerek yok?** Blender'ın bu işteki tek rolü *retarget* (animasyonu farklı bir iskelete uyarlama). Mixamo bütün karakterleri kendi standart iskeletiyle riglerse animasyonlar zaten birebir uyar → retarget yok → Blender yok. Geriye sadece FBX→GLB dönüşümü kalır; onu ücretsiz araçlar (FBX2glTF) veya doğrudan Three.js FBXLoader halleder.

### En kolay yol — tek araç: Meshy (önerilen)

Meshy artık model + rig + animasyon + GLB'yi tek yerde yapıyor:

1. Meshy'de modeli üret (T-pose / A-pose promptu ile; "T-pose, game asset" yaz).
2. **Animate** sekmesinde AI auto-rig (30 saniye altı, otomatik kemik yerleşimi).
3. Hazır hareket kütüphanesinden (600+ klip: idle, walk, run, jump, **combat motions**) animasyon seç; ya da **Text-to-Animation** ile kendi skill animasyonunu üret.
4. **FBX veya GLB** olarak, animasyonlar gömülü şekilde export et → doğrudan Three.js'e.

Bu yolda Mixamo'ya ve hiçbir dönüştürücüye gerek kalmaz. Mixamo'yu sadece daha fazla/çeşitli dövüş animasyonu istersen **ek** kaynak olarak kullan.

### Format seçimi (NET)

| Kaynak | Verdiği | Ne kullan |
|---|---|---|
| Meshy | FBX / GLB (animasyon gömülü) | **GLB** ✔ |
| Mixamo | FBX (Binary / ASCII / Unity) + DAE | **FBX Binary** → GLB'ye çevir |
| **.dae (COLLADA)** | eski format | **KULLANMA** — ağır, three.js'te ColladaLoader legacy ve yavaş |

**Kısa kural:** İndirirken **GLB** varsa **GLB** al. Yoksa **FBX** al. **.dae alma.**

### Altın kurallar

- **Her karakteri aynı Mixamo iskeletiyle rigle.** Böylece tek animasyon seti 20 karaktere de uyar (retarget otomatik).
- Dönüştürmede **Y-up** kullan (FBX2glTF'te `--y-up`); Mixamo cm kullanır, GLB'ye geçerken ölçek `0.01` düzeltmesi gerekebilir.
- **Boyut hedefleri:** karakter başına GLB **5–15 MB**. Fazlaysa:
  - Geometry: **Draco** veya **Meshopt** sıkıştırma
  - Texture: **KTX2 / Basis** (`.ktx2`), 1024–2048px, öbür türlü PNG/JPG
- **Vertex count:** karakter başına 20k–60k vertex yeter (mobilde 20k tut).
- Animasyon FBX'lerini indirirken: **"Without Skin"** + **"30 samples per second"** + **Keyframe Reduction: uniform**.
- Dosya isimleri tutarlı olsun: `char_frozman.glb`, `char_frozman@idle.glb` veya tek dosyada `actions: idle, walk, run, jab, cross, kick_high, kick_low, jump, jump_kick, roll, block, hit, dizzy, ko, skill_e, skill_c, skill_q, ultimate`.

---

## 2. Oyun Kontrolleri (senin anlattığın şema)

Mortal Kombat tarzı, klavye (ayarlardan yeniden atanabilir):

| Tuş | Aksiyon |
|---|---|
| `A` / `D` | sola / sağa yürü |
| `W` | zıpla (havada tekme/yumruk) |
| `S` | eğil / blok |
| `J` | yumruk (normal) |
| `K` | tekme (normal) |
| `S` + `J` | **yerden yumruk** (eğilirken yumruk) |
| `S` + `K` | **yerden tekme** (low kick) |
| `A` + `Space` | **geriye zıplama** (backdash) |
| `S` + `Space` | **ileri takla / top gibi yuvarlanma** (roll) |
| `W` + `K` | **havadan tekme** (jump kick) |
| `E` | Skill 1 |
| `C` | Skill 2 |
| `Q` | Skill 3 |
| `R` | **Ultimate** (canı %50 altına inince açılır, karaktere göre) |

**Hasar / durum mantığı (ortak kurallar):**
- **Sersemleme (stun):** süre boyunca tuşlar kilitli, hareket yok, skill atılamaz. (Volt E = 1sn, Volt Q = 1.5sn, Zombie baby = 0.5sn...)
- **Donma (freeze):** aynı sersemleme gibi ama görsel buz + 1.5sn (FROZman E).
- **Savunma / blok:** `S` basılıyken gelen hasar azalır (whiff vs block farkı ileride denge).
- **Cooldown modeli ("maç başı" vs "kullanım sonrası"):** her skill'in **maç başı lockout** süresi (uzun) ve **kullanım sonrası recharge** süresi (kısa) ayrı. Örn. FROZman E: `start=18s`, `recharge=16s`.

Her karakter sayfası: `KARAKTERLER.md`

---

## 3. Site / Menü Mimarisi

```
[Loading / Splash]
        │
        ▼
[Ana Menü]
   ├─ ONLINE      -> Lobi -> Rakip Bul -> Karakter Seç -> Stage -> Maç
   ├─ SINGLE      -> Arcade / VS CPU -> Karakter Seç -> Stage -> Maç
   ├─ CHARACTERS  -> 20 karakter grid (roster, skill/move listesi, lore)
   └─ ⚙ SETTINGS  -> Ses, Tuş Atama (keybinds), Grafik kalitesi, Dil
```

- **CHARACTERS** bölümünde: 20 kart, tıklayınca karakter detay (portre, element, E/C/Q/Ultimate açıklaması, stat barı).
- **SETTINGS (çark):** master/müzik/SFX ses, keybind remap (JSON'a kaydet, localStorage), grafik preset (düşük/orta/yüksek), FPS göstergesi aç/kapa.
- İleride: `kilitli karakterler` (sen "istediğim sürece açacağım" dedin → hepsini baştan açık bırak veya coin/level ile aç; `characters.json`'dan yönet).

---

## 4. Teknoloji Yığını (önerilen)

```
Frontend (statik → Vercel/Netlify)
├─ Vite + TypeScript
├─ React            -> menüler, karakter seç, ayarlar
├─ Three.js         -> oyun sahnesi, GLB, animasyon, kamera
├─ Zustand/Redux    -> UI state (seçili karakter, ayarlar, lobi)
└─ howler.js        -> ses/müzik

Oyun çekirdeği (Three.js içinde)
├─ Entity-Component mantığı (basit)
├─ State machine     -> Idle/Walk/Jump/Attack/Block/Hit/Stun/KO
├─ Combat system     -> hitbox / hurtbox (AABB), frame data
├─ Cooldown manager  -> skill başına timer
└─ Input buffer      -> kombo + öncelik

Online (ayrı servis)
├─ Colyseus (Node) veya PartyKit (Cloudflare) -> WebSocket odalar
├─ Sunucu otoriteli state (pozisyon, HP, cooldown, stun)
└─ Host: Railway / Render / Fly.io (Colyseus) ya da Cloudflare (PartyKit)
```

### Neden online için ayrı sunucu?
Vercel/Netlify **statik** site barındırır; kalıcı WebSocket tutmaz. Online için:
- **Kolay yol:** **PartyKit** (Cloudflare, Vercel/Netlify ile iyi gider, room mantığı dahili)
- **Klasik yol:** **Colyseus** → Railway/Render/Fly.io'da Node sunucu; frontend Vercel'de
- **Hızlı prototip:** **Supabase Realtime** (ama dövüş oyunu için gecikme sınırda)

**Netcode planı:** v1 = input gönder, sunucu simüle, 60Hz state snapshot → interpolate. v2 = rollback (GGPO tarzı) rekabetçi olsun istersen.

---

## 5. Mixamo'dan Alınacak Animasyon Listesi (setin çekirdeği)

Her karakter için — hepsi ortak Mixamo iskeletiyle riglendiği için animasyonlar birebir uyar (retarget yok):

**Hareket**
- `idle` (nefes/duruş)
- `walk_forward`, `walk_backward`
- `run_forward`
- `jump` (start), `jump_fall` (air), `jump_land`
- `crouch_idle`, `crouch_walk`
- `roll_forward` (takla), `backdash` (geriye zıplama)

**Hücum**
- `punch_jab` (hızlı yumruk)
- `punch_cross` (ağır yumruk)
- `kick_high`, `kick_low` (yerden tekme)
- `crouch_punch` (yerden yumruk)
- `jump_kick` (havadan tekme)
- `grab` + `throw`

**Savunma / tepki**
- `block`, `block_hit`
- `hit_light`, `hit_heavy`
- `dizzy` (sersemleme)
- `ko` / `death`
- `victory` / `intro`

**Skill'ler (karakter özel, elle veya özel animasyon)**
- Her karakterin E/C/Q/Ultimate'i için **özel animasyon** gerekir (Mixamo'da birebir yok). Yol:
  1. En yakın Mixamo hareketini **base** al (örn. `throw`, `spell_cast`, `punch`),
  2. Görseli **VFX ile süsle** (buz, yıldırım, ateş partikülleri) — Blender şart değil,
  3. Poz + efekt birleşince "skill" hissi çıkar; animasyonun birebir skill olması gerekmez.

> Not: Skill'lerin **görsel gücü VFX'ten gelir**, animasyonun birebir "buz püskürtme" olması şart değil. Üfleme pozu + buz partikülü = aynı iş.

---

## 6. VFX / Efekt Stratejisi (bu işin yarısı)

- **Partikül sistemleri:** Three.js `Points` + özel shader veya `three.quarks` / `@react-three/postprocessing`.
  - Buz (FROZman): beyaz-mavi kristal partikül + ekran kenarı frost shader
  - Yıldırım (Volt): şerit/bolt line + flash + screen shake
  - Ateş (Blaze): turuncu-sarı gaz + heat distortion
  - Ghost: yarı saydam mavi iz + afterimage (klon efekti)
  - Zombie: yeşil asit damlası + süzülen ruh sprite'ları
- **Kamera:** normalde sabit yan görünüm; **skill cinematic** anında kamera yaklaşır (over-shoulder / close-up). FROZman buz püskürtürken: kamera karakterin ağzına yakın, 0.5–1sn.
- **Post-processing:** bloom (yıldırım/ateş), vignette, hafif chromatic aberration.

---

## 7. Yol Haritası (sıralı)

| Faz | İçerik | Çıktı |
|---|---|---|
| **0** | Proje iskeleti (Vite+TS+Three), menü React | Boş sahne + menü gezilebilir |
| **1** | 1 karakter GLB + animasyon + kontrol, hareket+jump | Dummy üstünde kontrol testi |
| **2** | Combat çekirdeği: hitbox/hurtbox, yumruk/tekme, HP, blok, stun | İki kukla dövüşür |
| **3** | Cooldown + skill sistemi + VFX iskeleti | Skill bar + E/C/Q çalışır |
| **4** | İlk 5 karakter (FROZman, Volt, Blaze, Ghost, Zombie) | Roster kımıldıyor |
| **5** | Karakter seç ekranı + 20 karakter slotu + details | CHARACTERS bölümü biter |
| **6** | Single (CPU AI basit state machine) | Offline maç |
| **7** | Online (Colyseus/PartyKit), lobi, eşleşme | İki oyuncu maç |
| **8** | Denge, ses, polish, deploy | Yayın |

---

## 8. Kararlar (netleşti)

1. **Görünüm:** 2.5D ✔
2. **Blender:** **Gerekmez.** Rig Mixamo'da ortak iskelet olduğu için retarget yok; sadece FBX→GLB dönüşümü, onu ücretsiz araçlar yapar.
3. **Online:** **Colyseus** (Node) — oda/state sync hazır, dövüş oyununa uygun. Host: Railway/Render/Fly.io. Frontend Vercel/Netlify'de kalır.
4. **Karakterler:** **Level/unlock.** Başlangıçta 3 açık, her level 1 karakter açar.
5. **Dil:** **TR + EN**, ayarlardan değiştirilebilir.

### 8.1 İlerleme / Level Sistemi

- **Maç formatı:** **1v1** — her maçta tek karakter seçilir.
- **Hesap Level + XP.** XP maçtan gelir (kazanma > kaybetme; kombo/finish bonusu opsiyonel).
- **Başlangıç:** 3 karakter açık → **FROZman, Kuroi, Gaia** (kodda uygulandı).
- **Her level → 1 yeni karakter** açılır. **Seviye 18**'de 20 karakter tamam (başlangıç 3 + 17 seviye).
- **Kayıt:** offline `localStorage` (zustand persist, anahtar: `kavgaci-save`), online ise hesap bazlı (sunucu/DB).
- **XP eğrisi (uygulandı):** Seviye N'den N+1'e geçmek için gereken XP = `100 × N` (1→2: 100, 2→3: 200, 3→4: 300 ...).
- **Açılış sırası** `src/data/characters.ts` içindeki her karakterin `unlockOrder` alanı; istediğin an değiştirilir (örn. sevdiğin karakteri erken aç).

### 8.2 Dil (i18n)

- **react-i18next** + `src/i18n/locales/tr.ts`, `src/i18n/locales/en.ts` (tip güvenliği için JSON değil `.ts`).
- Ayarlar > **Language** sekmesinden TR/EN; seçim `localStorage`'a yazılır.
- UI metinleri çeviriden gelir. **Karakter isimleri özel isim** (çevrilmez), **skill isimleri çevrilir** (örn. "Buz Püskürtme" ↔ "Frost Breath").

---

## 9. İlk Kod İskeleti (başlamak için hazır)

Proje kökü: `C:\Users\FlawlessX\Desktop\my game` · **uygulama klasörü: `frontend/`** (dokümanlar `oyun/` içinde kalıyor).

Kurulum **tamamlandı**. Kullanılan komutlar:

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install three @react-three/fiber @react-three/drei zustand howler i18next react-i18next @types/three
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build → dist/  (Vercel/Netlify'a bu klasörü ver)
```

Sahne + GLB yükleme iskeleti:

```ts
// src/game/CharacterLoader.ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';

export async function loadCharacter(url: string): Promise<{
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
}> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);          // .glb
  const root = gltf.scene;
  const mixer = new THREE.AnimationMixer(root);

  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of gltf.animations) {
    actions[clip.name] = mixer.clipAction(clip);
  }
  return { root, mixer, actions };
}
```

Oyun döngüsü + kontrol iskeleti ve combat hitbox sistemi bir sonraki adımda yazılır.

---

## 10. Uygulanan İskelet — Faz 0 (TAMAM) + Faz 2 çekirdeği

> Durum: `npm run build` temiz (tsc + vite geçer), tarayıcıda çalışıyor, konsolda hata yok.

### Dosya yapısı (`frontend/src`)

```
data/characters.ts        20 karakter (isim, element, renk, unlockOrder, stat, E/C/Q/Ult skill)
i18n/index.ts             i18next kurulumu (tr/en)
i18n/locales/tr.ts|en.ts  arayüz metinleri
store/useGameStore.ts     zustand + persist: ekran, dil, mod, XP, seviye, seçili karakter, ayarlar
hooks/useKeyboard.ts      klavye durumu (basılı + tek-seferlik)
game/types.ts             World, ActionState, sabitler (hız, zıplama, hasar, arena)
game/Fighter.tsx          yer tutucu dövüşçü: hareket, zıplama, yumruk/tekme, basit bot AI
game/GameScreen.tsx       R3F sahne (arena, ışık, kamera), HUD (HP bar), round sonucu
screens/MainMenu.tsx      ONLINE / SINGLE / CHARACTERS + ⚙
screens/CharacterSelect.tsx  20'li grid, kilit seviyeleri, detay paneli, DÖVÜŞ
screens/SettingsScreen.tsx   Dil (TR/EN), ses, grafik
App.tsx / main.tsx / index.css
```

### Uygulanan davranışlar

- **Menü akışı:** Menü → (ONLINE/SINGLE → Karakter Seç) veya (CHARACTERS) → DÖVÜŞ → Arena. ⚙ → Ayarlar.
- **Seviye/kilit:** `levelInfo(xp)` ile seviye; `unlockedCountFor(level)` = 3 + (level−1). Kart üzerinde "Seviye N'de açılır" yazar. Karakter seç ekranında `+XP (test)` butonu (test için 120 XP).
- **Dil:** Ayarlardan TR/EN, anında değişir, `localStorage`'a yazılır. Element ve skill adları TR/EN çevrilir; karakter isimleri özel isim.
- **Arena (yer tutucu):** iki kapsül-vari karakter (blok+kol+bacak primitifleri), yan görünüş sabit kamera, zemin + arka duvar + iki sınır çizgisi, gölge.
- **Kontroller (çalışıyor):** `A/D` yürü, `W` zıpla, `J` yumruk (5 hasar), `K` tekme (8 hasar), `S` çömel/blok. Vuruş menzili `1.7`. Tek-seferlik tuş sıfırlama var (basılı tutunca spam yok).
- **Bot:** yaklaşır, menzilde ara sıra yumruk/tekme atar.
- **HP + sonuç:** HP barları HUD'da; ölen taraf belirlenince sonuç ekranı (Tekrar / Menü) + XP verir (kazanma 60, kaybetme 25).

### Modeller gelince yapılacak takas

`game/Fighter.tsx` içindeki `<group>` primitifleri, aynı pozisyon/rotasyon sözleşmesiyle bir GLB'ye bağlanacak: `useGLTF(url)` + `mixer.clipAction('idle'|'walk'|'jump'|'punch'|'kick')`. Durum makinesi (`Action` tipi) ve hitbox mantığı aynen kalır; sadece "pozlama" kısmı `AnimationAction` ile değişir.

### Sıradaki adımlar

1. **Faz 1:** ilk GLB (FROZman) → `useGLTF` + `AnimationMixer` + `idle/walk/jump/punch/kick` klipleri.
2. **Faz 2:** gerçek hitbox/hurtbox (AABB) + frame data, blok hasar azaltma, `stun`/`freeze` durumları.
3. **Faz 3:** E/C/Q cooldown yöneticisi (maç başı lockout + kullanım sonrası recharge) + skill VFX iskeleti + Ultimate (%50 HP altı).
4. **Faz 4:** ilk 5 karakterin GLB'leri takılır.
5. **Faz 7:** Colyseus sunucusu (ayrı `server/` klasörü) + lobi.

---

## 11. Revizyon — Kontroller, Yetenekler, Arena (TAMAM)

> Durum: `npm run build` temiz, tarayıcıda doğrulandı (4 arena, skill cooldown 10s, hasar döngüsü çalışıyor, konsolda hata yok).

### 11.1 Kontroller (J/K kaldırıldı)

| Girdi | Aksiyon |
|---|---|
| **Sol tık** | Yumruk (5 hasar, menzil 1.7) |
| **Sağ tık** | Tekme (8 hasar, menzil 1.95) |
| **S + Sol tık** | **Yerden yumruk** (4 hasar, menzil 1.5) |
| **S + Sağ tık** | **Yerden tekme** (9 hasar, menzil 2.0, en uzun menzilli temel saldırı) |
| A / D | Geri / İleri yürü |
| W | Zıpla |
| S (basılı) | Çömel — yerden saldırıların ön şartı |
| E / C / Q | Yetenek 1 / 2 / 3 |
| R | Ultimate (can %50'nin altındayken) |

- Fare olayları `window` üzerinden dinlenir; sağ tık menüsü `contextmenu` ile kapatılır.
- Tıklama koruması: `button`, `.hud`, `.skillbar`, `.game-topbar`, `.result-overlay` üzerine gelen tıklar saldırı sayılmaz (menü butonuna basınca yumruk atmaz).
- **Otomatik yönelme:** dövüşçü her zaman rakibe döner (MK standardı). Bu yüzden A/D yön değiştirmez, sadece konum değiştirir.

### 11.2 Arena / "Haritadan çıkma" düzeltmesi

- Konum `ARENA_MIN_X = −4.8` … `ARENA_MAX_X = +4.8` aralığına kelepçeli (`MathUtils.clamp`), her frame.
- Kamera `[0, 2.4, 11.2]`, `fov 40` → görünen yatay genişlik ≈ ±5.8 birim. Dövüşçüler (±4.8) ve arena duvarları (±5.5) her zaman kadrajda.
- `stage` bileşenindeki `<Bounds>` her arenaya görünür kenar duvarı koyar.

### 11.3 4 Arena (`game/stages.tsx`)

| id | Ad (TR) | Görünüm |
|---|---|---|
| `colosseum` | Kolezyum | kum zemin, 13 sütun + tribün, sıcak gün batımı ışığı |
| `lava` | Lav Çukuru | koyu bazalt, parlayan lav çatlakları, arka lav gölü, yükselen közler (`Embers`), turuncu point light'lar |
| `voxel` | Blok Dünyası | çim zemin + toprak kenar, blok ağaçlar, küp bulutlar, mavi gökyüzü (Minecraft temalı) |
| `ice` | Buz Tundrası | parlak buz, buz sütunları, sarkan buzlar, soğuk mavi sis |

Seçim: **Karakter Seç → ARENA** bölümünden (zustand `stage`, `localStorage`'a kaydedilir).

### 11.4 Yetenek sistemi (`data/skills.ts` + `game/Effects.tsx`)

5 davranış tipi: `projectile`, `strike`, `aoe`, `buff`, `dash`.

- Her elementin profili vardır (`PROFILES`): E/C/Q/Ult tipleri elemente göre değişir.
- Hasar formülleri: `E = 8 + atk`, `C = 12 + 1.3·atk`, `Q = 10 + atk` (buff ise 0), `Ult = 22 + 1.8·atk`.
- Menzil karakterin `range` statından türetilir → her karakterin menzili farklı.
- **Tüm cooldown'lar 10 sn** (`SKILL_CD = 10`).
- Sersemletme: `ice, lightning, sound, gravity, time, poison` elementlerinde 0.9 sn (Ult'te 1.26 sn) → rakip sersemler, girdisi kesilir.
- `buff` (Q) → 6 sn boyunca verilen hasar ×1.35 (`BUFF_MULT`), dövüşçünün etrafında aura.
- Ultimate R: sadece **HP < %50** iken açılır, HUD'da kilitli görünür.
- HUD: alt ortada 4 slot (E/C/Q/R) — hazır olan yeşil kenarlı, bekleme süresi saniye olarak, Ult kilitliyken `%50`.

### 11.5 Bot

Bot artık yetenek de kullanır: yaklaşır, yumruk/tekme atar, %30 ihtimalle rastgele E/C/Q, HP'si %50 altındayken %22 ihtimalle Ultimate.

### 11.6 Ücretsiz 3D Asset Kaynakları (Meshy/Tripo yerine)

| Site | Lisans | Ne var | Not |
|---|---|---|---|
| **quaternius.com** | CC0 | **Animasyonlu karakter paketleri** (GLB + animasyon gömülü) + Universal Animation Library | En iyi seçenek: model + animasyon tek dosyada, Blender gerekmez |
| **kenney.nl** | CC0 | Blocky Characters (rigged), voxel doğa/şehir kitleri | Blok dünyası arenası için birebir |
| **poly.pizza** | CC0 / CC-BY | Düşük poligon + voxel karakterler, Mixamo animasyonlu modeller | Model seçerken "animated" filtresi |
| **mixamo.com** | Ücretsiz (Adobe hesabı) | Animasyon kütüphanesi + otomatik rigleme (FBX) | Ortak iskelet → 20 karaktere tek set |
| **kaylousberg.itch.io** (KayKit) | CC0 | Karakter/dungeon paketleri, GLB | Temiz topoloji |
| **sketchfab.com** | CC0 / CC-BY filtresi | Her şey | Lisans filtresini mutlaka aç |
| **opengameart.org** | Karışık (CC0/CC-BY/GPL) | Retro + low-poly | Lisansı tek tek oku |
| **itch.io/game-assets/free** | Karışık | Binlerce paket | "Fighting" / "voxel" araması |

**Kritik:** İskeletli (rigged) + animasyonlu GLB al. Animasyon klibi adları şu sözleşmeye uyarsa kod tarafında otomatik eşleşir:
`idle · walk · jump · punch · kick · crouch · block · hit · ko · skill_e · skill_c · skill_q · ultimate`

### 11.7 Sıradaki adım

`data/models.ts` içine `id → GLB yolu` eşlemesi + `Fighter.tsx`'te `useGLTF` + `AnimationMixer` dalı (Suspense + hata yakalama ile: model yoksa yer tutucu çalışmaya devam eder). Bir GLB dosyası elde olduğunda ölçek/yön (Y-up, yaw) ayarı tek seferde yapılır.

