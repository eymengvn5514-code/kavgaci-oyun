export type ElementId =
  | 'ice'
  | 'lightning'
  | 'fire'
  | 'ghost'
  | 'zombie'
  | 'shadow'
  | 'earth'
  | 'wind'
  | 'water'
  | 'steel'
  | 'beast'
  | 'cyber'
  | 'poison'
  | 'sound'
  | 'light'
  | 'blood'
  | 'bone'
  | 'gravity'
  | 'time'
  | 'nature';

export interface LocalizedText {
  tr: string;
  en: string;
}

export interface CharacterStats {
  hp: number;
  atk: number;
  spd: number;
  range: number;
}

export interface CharacterSkills {
  e: LocalizedText;
  c: LocalizedText;
  q: LocalizedText;
  ult: LocalizedText;
}

export interface Character {
  id: string;
  name: string;
  element: ElementId;
  color: string;
  accent: string;
  /** 1 = ilk açılan, 20 = en son açılan */
  unlockOrder: number;
  stats: CharacterStats;
  skills: CharacterSkills;
}

export const ELEMENT_LABELS: Record<ElementId, LocalizedText> = {
  ice: { tr: 'Buz', en: 'Ice' },
  lightning: { tr: 'Yıldırım', en: 'Lightning' },
  fire: { tr: 'Ateş', en: 'Fire' },
  ghost: { tr: 'Hayalet', en: 'Ghost' },
  zombie: { tr: 'Zombi', en: 'Zombie' },
  shadow: { tr: 'Gölge', en: 'Shadow' },
  earth: { tr: 'Toprak', en: 'Earth' },
  wind: { tr: 'Rüzgar', en: 'Wind' },
  water: { tr: 'Su', en: 'Water' },
  steel: { tr: 'Çelik', en: 'Steel' },
  beast: { tr: 'Vahşi', en: 'Beast' },
  cyber: { tr: 'Siber', en: 'Cyber' },
  poison: { tr: 'Zehir', en: 'Poison' },
  sound: { tr: 'Ses', en: 'Sound' },
  light: { tr: 'Işık', en: 'Light' },
  blood: { tr: 'Kan', en: 'Blood' },
  bone: { tr: 'Kemik', en: 'Bone' },
  gravity: { tr: 'Yerçekimi', en: 'Gravity' },
  time: { tr: 'Zaman', en: 'Time' },
  nature: { tr: 'Doğa', en: 'Nature' },
};

export const characters: Character[] = [
  {
    id: 'frozman',
    name: 'FROZman',
    element: 'ice',
    color: '#3d8bff',
    accent: '#cfeaff',
    unlockOrder: 1,
    stats: { hp: 7, atk: 5, spd: 4, range: 6 },
    skills: {
      e: { tr: 'Buz Püskürtme', en: 'Frost Breath' },
      c: { tr: 'Buz Kılıcı', en: 'Ice Sword' },
      q: { tr: 'Buz Zırhı', en: 'Ice Armor' },
      ult: { tr: 'Absolute Zero', en: 'Absolute Zero' },
    },
  },
  {
    id: 'kuroi',
    name: 'Kuroi',
    element: 'steel',
    color: '#2a2a33',
    accent: '#c9ccd6',
    unlockOrder: 2,
    stats: { hp: 6, atk: 7, spd: 6, range: 5 },
    skills: {
      e: { tr: 'Iai Kesimi', en: 'Iai Slash' },
      c: { tr: 'Kılıç Fırtınası', en: 'Blade Storm' },
      q: { tr: 'Çelik Duruşu', en: 'Steel Stance' },
      ult: { tr: 'Tek Kesik', en: 'Single Slash' },
    },
  },
  {
    id: 'gaia',
    name: 'Gaia',
    element: 'nature',
    color: '#4faa54',
    accent: '#bff08a',
    unlockOrder: 3,
    stats: { hp: 7, atk: 5, spd: 5, range: 5 },
    skills: {
      e: { tr: 'Kök Salma', en: 'Root Bind' },
      c: { tr: 'Dikenli Sarmaşık', en: 'Thorn Vine' },
      q: { tr: 'Yenilenme', en: 'Regrowth' },
      ult: { tr: 'Orman Öfkesi', en: 'Forest Wrath' },
    },
  },
  {
    id: 'volt',
    name: 'Volt',
    element: 'lightning',
    color: '#ffe14d',
    accent: '#4da6ff',
    unlockOrder: 4,
    stats: { hp: 6, atk: 7, spd: 7, range: 7 },
    skills: {
      e: { tr: 'Gökten Yıldırım', en: 'Sky Lightning' },
      c: { tr: 'Elektrikli Şapka', en: 'Charged Hat' },
      q: { tr: 'Yıldırım Şeridi', en: 'Lightning Lane' },
      ult: { tr: 'Fırtına', en: 'Storm' },
    },
  },
  {
    id: 'blaze',
    name: 'Blaze',
    element: 'fire',
    color: '#ff5a1f',
    accent: '#ffcf3f',
    unlockOrder: 5,
    stats: { hp: 6, atk: 8, spd: 5, range: 5 },
    skills: {
      e: { tr: 'Alev Püskürtme', en: 'Flame Breath' },
      c: { tr: 'Ateş Kılıcı', en: 'Fire Sword' },
      q: { tr: 'Ateş Zırhı', en: 'Flame Armor' },
      ult: { tr: 'Meteor Yağmuru', en: 'Meteor Rain' },
    },
  },
  {
    id: 'riptide',
    name: 'Riptide',
    element: 'water',
    color: '#2fb6d8',
    accent: '#a8f0ff',
    unlockOrder: 6,
    stats: { hp: 6, atk: 5, spd: 6, range: 7 },
    skills: {
      e: { tr: 'Su Bıçağı', en: 'Water Blade' },
      c: { tr: 'Gelgit Dalgası', en: 'Tidal Wave' },
      q: { tr: 'Su Kubbesi', en: 'Water Dome' },
      ult: { tr: 'Tsunami', en: 'Tsunami' },
    },
  },
  {
    id: 'zephyr',
    name: 'Zephyr',
    element: 'wind',
    color: '#7ee0b8',
    accent: '#dffbf0',
    unlockOrder: 7,
    stats: { hp: 5, atk: 5, spd: 10, range: 5 },
    skills: {
      e: { tr: 'Rüzgar İtişi', en: 'Gust Push' },
      c: { tr: 'Hava Akımı', en: 'Air Current' },
      q: { tr: 'Kasırga', en: 'Cyclone' },
      ult: { tr: 'Rüzgar Bıçağı', en: 'Wind Blade' },
    },
  },
  {
    id: 'titan',
    name: 'Titan',
    element: 'earth',
    color: '#8a6b4a',
    accent: '#ff8a2b',
    unlockOrder: 8,
    stats: { hp: 10, atk: 6, spd: 3, range: 3 },
    skills: {
      e: { tr: 'Taş Yumruk', en: 'Stone Fist' },
      c: { tr: 'Taş Zırh', en: 'Stone Armor' },
      q: { tr: 'Kayadan Mezar', en: 'Rock Tomb' },
      ult: { tr: 'Deprem', en: 'Quake' },
    },
  },
  {
    id: 'crimson',
    name: 'Crimson',
    element: 'blood',
    color: '#b3143b',
    accent: '#ff5a7a',
    unlockOrder: 9,
    stats: { hp: 5, atk: 6, spd: 6, range: 4 },
    skills: {
      e: { tr: 'Kan Emme', en: 'Blood Drain' },
      c: { tr: 'Kan Mızrakları', en: 'Blood Spears' },
      q: { tr: 'Kan Bağı', en: 'Blood Link' },
      ult: { tr: 'Kan Ayı', en: 'Blood Moon' },
    },
  },
  {
    id: 'ghost',
    name: 'Ghost',
    element: 'ghost',
    color: '#8fd6ff',
    accent: '#dff3ff',
    unlockOrder: 10,
    stats: { hp: 5, atk: 7, spd: 8, range: 6 },
    skills: {
      e: { tr: 'Ölüm Işınlanması', en: 'Death Warp' },
      c: { tr: 'Kabin Ghost\u2019u', en: 'Cabin Ghost' },
      q: { tr: 'Dört Yönlü Klon', en: 'Four-Way Clone' },
      ult: { tr: 'True Phantom', en: 'True Phantom' },
    },
  },
  {
    id: 'fang',
    name: 'Fang',
    element: 'beast',
    color: '#9a6b3f',
    accent: '#ffd24d',
    unlockOrder: 11,
    stats: { hp: 7, atk: 8, spd: 6, range: 4 },
    skills: {
      e: { tr: 'Vahşi Pençe', en: 'Wild Claw' },
      c: { tr: 'Yırtıcı Atılış', en: 'Predator Pounce' },
      q: { tr: 'Kan Kokusu', en: 'Blood Scent' },
      ult: { tr: 'Dolunay', en: 'Full Moon' },
    },
  },
  {
    id: 'venom',
    name: 'Venom',
    element: 'poison',
    color: '#7dbf3f',
    accent: '#b6ff5a',
    unlockOrder: 12,
    stats: { hp: 5, atk: 5, spd: 5, range: 6 },
    skills: {
      e: { tr: 'Asit Tükürük', en: 'Acid Spit' },
      c: { tr: 'Zehir Sisi', en: 'Poison Mist' },
      q: { tr: 'Toksin Enjeksiyonu', en: 'Toxin Inject' },
      ult: { tr: 'Veba', en: 'Plague' },
    },
  },
  {
    id: 'banshee',
    name: 'Banshee',
    element: 'sound',
    color: '#cfd6e6',
    accent: '#6b5bff',
    unlockOrder: 13,
    stats: { hp: 5, atk: 5, spd: 5, range: 7 },
    skills: {
      e: { tr: 'Çığlık', en: 'Scream' },
      c: { tr: 'Yankı Patlaması', en: 'Echo Burst' },
      q: { tr: 'Sağır Edici Vızıltı', en: 'Deafening Buzz' },
      ult: { tr: 'Ölüm Sessizliği', en: 'Silence of Death' },
    },
  },
  {
    id: 'zombie',
    name: 'Zombie Combie',
    element: 'zombie',
    color: '#6eae4a',
    accent: '#a8c26b',
    unlockOrder: 14,
    stats: { hp: 8, atk: 5, spd: 4, range: 4 },
    skills: {
      e: { tr: 'Enfekte Isırık', en: 'Infected Bite' },
      c: { tr: 'Sapan Fırlatma', en: 'Slingshot Toss' },
      q: { tr: 'Duvara Tırmanış + Asit', en: 'Wall Climb + Acid' },
      ult: { tr: 'Horde', en: 'Horde' },
    },
  },
  {
    id: 'cx9',
    name: 'CX-9',
    element: 'cyber',
    color: '#9aa4b0',
    accent: '#ff3b3b',
    unlockOrder: 15,
    stats: { hp: 5, atk: 5, spd: 6, range: 9 },
    skills: {
      e: { tr: 'Lazer Taraması', en: 'Laser Scan' },
      c: { tr: 'Drone Deploy', en: 'Drone Deploy' },
      q: { tr: 'Elektro-Şok Ağı', en: 'Shock Net' },
      ult: { tr: 'Orbital Strike', en: 'Orbital Strike' },
    },
  },
  {
    id: 'wraith',
    name: 'Wraith',
    element: 'shadow',
    color: '#7b3fbf',
    accent: '#2a1440',
    unlockOrder: 16,
    stats: { hp: 5, atk: 8, spd: 9, range: 4 },
    skills: {
      e: { tr: 'Gölge Sıçraması', en: 'Shadow Dash' },
      c: { tr: 'Kara Kement', en: 'Dark Lash' },
      q: { tr: 'Karanlık Örtüsü', en: 'Dark Shroud' },
      ult: { tr: 'Kara Delik', en: 'Black Hole' },
    },
  },
  {
    id: 'ossuary',
    name: 'Ossuary',
    element: 'bone',
    color: '#d8d2c0',
    accent: '#6b6b5a',
    unlockOrder: 17,
    stats: { hp: 5, atk: 5, spd: 4, range: 7 },
    skills: {
      e: { tr: 'Kemik Mızrağı', en: 'Bone Spear' },
      c: { tr: 'İskelet Çağırma', en: 'Summon Skeleton' },
      q: { tr: 'Kemik Kafesi', en: 'Bone Cage' },
      ult: { tr: 'Ölülerin Ordusu', en: 'Army of Dead' },
    },
  },
  {
    id: 'singularity',
    name: 'Singularity',
    element: 'gravity',
    color: '#8a4dff',
    accent: '#c9a6ff',
    unlockOrder: 18,
    stats: { hp: 6, atk: 7, spd: 4, range: 6 },
    skills: {
      e: { tr: 'Ağırlaştırma', en: 'Heavy Pull' },
      c: { tr: 'Çekim Alanı', en: 'Gravity Field' },
      q: { tr: 'Yerçekimi Kubbesi', en: 'Gravity Dome' },
      ult: { tr: 'Kara Delik', en: 'Singularity' },
    },
  },
  {
    id: 'chronos',
    name: 'Chronos',
    element: 'time',
    color: '#3f7cff',
    accent: '#ffd84d',
    unlockOrder: 19,
    stats: { hp: 5, atk: 5, spd: 6, range: 5 },
    skills: {
      e: { tr: 'Zaman Kilidi', en: 'Time Lock' },
      c: { tr: 'Hızlandırma', en: 'Hasten' },
      q: { tr: 'Geri Sarma', en: 'Rewind' },
      ult: { tr: 'Zaman Durması', en: 'Time Stop' },
    },
  },
  {
    id: 'seraph',
    name: 'Seraph',
    element: 'light',
    color: '#ffd86b',
    accent: '#fff3c4',
    unlockOrder: 20,
    stats: { hp: 7, atk: 6, spd: 5, range: 5 },
    skills: {
      e: { tr: 'Kutsal Mızrak', en: 'Holy Spear' },
      c: { tr: 'Kutsama', en: 'Blessing' },
      q: { tr: 'Işık Kalkanı', en: 'Light Shield' },
      ult: { tr: 'Yargı', en: 'Judgment' },
    },
  },
];

export const sortedCharacters: Character[] = [...characters].sort(
  (a, b) => a.unlockOrder - b.unlockOrder,
);

export function getCharacter(id: string): Character | undefined {
  return characters.find((c) => c.id === id);
}

/** Oyuna başlarken açık karakter sayısı. */
export const STARTING_UNLOCK_COUNT = 3;
/** Toplam karakter sayısı (dolu roster). */
export const MAX_UNLOCK_COUNT = sortedCharacters.length;
