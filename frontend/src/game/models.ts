/**
 * GLB modelleri klasörden otomatik bulur.
 *
 * KURAL: `src/assets/models/` içine `<karakter-id>.glb` olarak bırak.
 *   frozman.glb · ghost.glb · kuroi.glb · zombie.glb · cx9.glb · titan.glb ...
 * Dosya adındaki büyük/küçük harf, boşluk, tire, alt çizgi fark etmez
 * (normalize edilir). Model yoksa dövüşçü primitif yer tutucuyla oynar.
 *
 * Modelleri optimize etmek için: `npm run models`
 */
const modules = import.meta.glob('../assets/models/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const weaponModules = import.meta.glob('../assets/weapons/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const mapModules = import.meta.glob('../assets/maps/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Giyilebilir eşyalar (sırt çantası vb.) — `src/assets/gear/*.glb`. */
const gearModules = import.meta.glob('../assets/gear/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Ortak animasyon kütüphanesi — `src/assets/anims/*.glb` (iskeletli karakterlerde kullanılır). */
const animModules = import.meta.glob('../assets/anims/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Mixamo FBX motion clips (downloaded without skin and retargeted to Mixamo rigs). */
const mixamoModules = import.meta.glob('../assets/anims/mixamo/*.fbx', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Sahne süsleri — `src/assets/decor/*.glb`. */
const decorModules = import.meta.glob('../assets/decor/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Kullanıcı avatarları — `src/assets/avatar/*.glb`. */
const avatarModules = import.meta.glob('../assets/avatar/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** 'FROZman-final.glb' -> 'frozman'. undefined/null'a karşı panzerli. */
export function normalizeId(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export const MODEL_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const file = path.split('/').pop() ?? path;
  MODEL_URLS[normalizeId(file)] = url;
}

export const MODEL_IDS = Object.keys(MODEL_URLS);

export const WEAPON_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(weaponModules)) {
  const file = path.split('/').pop() ?? path;
  WEAPON_URLS[normalizeId(file)] = url;
}

export const MAP_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(mapModules)) {
  const file = path.split('/').pop() ?? path;
  MAP_URLS[normalizeId(file)] = url;
}

export const GEAR_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(gearModules)) {
  const file = path.split('/').pop() ?? path;
  GEAR_URLS[normalizeId(file)] = url;
}

export const ANIM_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(animModules)) {
  const file = path.split('/').pop() ?? path;
  ANIM_URLS[normalizeId(file)] = url;
}

export const MIXAMO_ANIM_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(mixamoModules)) {
  const file = path.split('/').pop() ?? path;
  MIXAMO_ANIM_URLS[normalizeId(file)] = url;
}

export const DECOR_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(decorModules)) {
  const file = path.split('/').pop() ?? path;
  DECOR_URLS[normalizeId(file)] = url;
}

export const AVATAR_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(avatarModules)) {
  const file = path.split('/').pop() ?? path;
  AVATAR_URLS[normalizeId(file)] = url;
}

/** İlk animasyon kütüphanesi (ortalama tek dosya). */
export const ANIM_LIB_URL = Object.values(ANIM_URLS)[0];

/** İlk avatar modeli. */
export const AVATAR_URL = Object.values(AVATAR_URLS)[0];

/** Bir eşya id'sinin model url'si (önce el silahları, sonra giysiler). */
export function itemUrl(itemId: string): string | undefined {
  return WEAPON_URLS[normalizeId(itemId)] ?? GEAR_URLS[normalizeId(itemId)];
}

/** Bir sahne süsünün model url'si. */
export function decorUrl(decorId: string): string | undefined {
  return DECOR_URLS[normalizeId(decorId)];
}

/**
 * Karakter -> silah ismi. Silah dosyası `src/assets/weapons/<isim>.glb`.
 * Örnek: kuroi -> katana  demek, katana.glb kuroi'nin elinde görünür.
 * (Ekipman artık Çanta ekranından da değiştirilebiliyor — burada sadece ön tanımı.)
 */
export const CHARACTER_WEAPONS: Record<string, string> = {
  kuroi: 'katana',
};

export function modelFor(characterId: string): string | undefined {
  return MODEL_URLS[normalizeId(characterId)];
}

export function weaponFor(characterId: string): string | undefined {
  const name = CHARACTER_WEAPONS[normalizeId(characterId)];
  return name ? WEAPON_URLS[normalizeId(name)] : undefined;
}

/** Sahne haritası. `src/assets/maps/<id>.glb`. id bulunamazsa ilk haritayı döner. */
export function mapFor(stageId: string): string | undefined {
  return MAP_URLS[normalizeId(stageId)] ?? Object.values(MAP_URLS)[0];
}

export function overrideFor(characterId: string): ModelOverride | undefined {
  return MODEL_OVERRIDES[normalizeId(characterId)];
}

export interface ModelOverride {
  /** Modelin yönü yanlışsa buradan düzelt (radyan). Örn. Math.PI */
  yaw?: number;
  /** Otomatik ölçeği ezmek istersen (hedef boy 1.85 m). */
  scale?: number;
  /** Ayakları yere oturtma payı. */
  yOffset?: number;
}

/**
 * Otomatik yön tespiti yanılırsa karakteri buradan düzelt.
 * Örnek: `frozman: { yaw: Math.PI }`
 */
export const MODEL_OVERRIDES: Record<string, ModelOverride> = {};
