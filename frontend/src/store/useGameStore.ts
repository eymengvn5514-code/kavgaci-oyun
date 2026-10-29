import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MAX_UNLOCK_COUNT, STARTING_UNLOCK_COUNT } from '../data/characters';
import type { ItemSlot } from '../data/items';
import { DEFAULT_EQUIP } from '../data/items';
import type { StageId, WeatherId } from '../game/types';

export type Screen = 'menu' | 'characters' | 'settings' | 'game' | 'bag' | 'online' | 'leaderboard';
export type Language = 'tr' | 'en';
export type GraphicsPreset = 'low' | 'medium' | 'high';
export type MatchMode = 'single' | 'online';
export type Gender = 'none' | 'male' | 'female';

/** İsim değiştirme kilidi: haftada 1. */
export const NAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export interface GameSettings {
  master: number;
  music: number;
  sfx: number;
  graphics: GraphicsPreset;
}

/** Seviye 18'de 20 karakter de açılır. */
export const MAX_LEVEL = MAX_UNLOCK_COUNT - STARTING_UNLOCK_COUNT + 1;

export interface LevelInfo {
  level: number;
  current: number;
  needed: number;
}

/** XP -> seviye. Level N'den N+1'e geçmek için 100*N XP gerekir. */
export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (level < MAX_LEVEL && remaining >= 100 * level) {
    remaining -= 100 * level;
    level += 1;
  }
  const needed = level < MAX_LEVEL ? 100 * level : 0;
  return { level, current: remaining, needed };
}

/** Verilen seviyede açık karakter sayısı (başlangıç 3, her seviye +1). */
export function unlockedCountFor(level: number): number {
  return Math.min(MAX_UNLOCK_COUNT, STARTING_UNLOCK_COUNT + (level - 1));
}

export interface EquippedSlots {
  hand?: string;
  back?: string;
}

interface GameStore {
  screen: Screen;
  language: Language;
  mode: MatchMode;
  stage: StageId;
  xp: number;
  selectedId: string;
  settings: GameSettings;
  /** Maç öncesi seçilen hava modu (görsel). */
  weather: WeatherId;
  /** Karakter -> kuşanılan eşyalar. */
  equipment: Record<string, EquippedSlots>;
  /** Karakter -> 180° ters çevir (yön düzeltmesi). */
  facingFlips: Record<string, boolean>;
  /** Dokunmatik kontrolleri zorla aç/kapat (mobilde otomatik). */
  touchControls: boolean;
  /** Oyuncu profili — maç sonunda oluşturulur, online'da görünür. */
  profileName: string;
  gender: Gender;
  /** Son isim değişikliği zamanı (epoch ms). */
  nameChangedAt: number;
  /** Tanıtım (Efe/Recep) bir kez gösterildi mi. */
  tutorialSeen: boolean;
  setProfile: (name: string, gender: Gender) => void;
  /** Haftalık kilitli isim değişimi. Başarılıysa true döner. */
  renameProfile: (name: string) => boolean;
  setTutorialSeen: (seen: boolean) => void;
  setScreen: (screen: Screen) => void;
  setLanguage: (language: Language) => void;
  setMode: (mode: MatchMode) => void;
  setStage: (stage: StageId) => void;
  setWeather: (weather: WeatherId) => void;
  addXp: (amount: number) => void;
  selectCharacter: (id: string) => void;
  updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  setItem: (characterId: string, slot: ItemSlot, itemId: string | null) => void;
  toggleFacing: (characterId: string) => void;
  setTouchControls: (on: boolean) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      screen: 'menu',
      language: 'tr',
      mode: 'single',
      stage: 'colosseum',
      xp: 0,
      selectedId: 'frozman',
      settings: { master: 0.8, music: 0.6, sfx: 0.8, graphics: 'high' },
      weather: 'none',
      equipment: { ...DEFAULT_EQUIP },
      facingFlips: {},
      touchControls: false,
      profileName: '',
      gender: 'none',
      nameChangedAt: 0,
      tutorialSeen: false,
      setProfile: (profileName, gender) =>
        set({ profileName: profileName.trim().slice(0, 16), gender, nameChangedAt: Date.now() }),
      renameProfile: (name) => {
        const s = get();
        const since = Date.now() - (s.nameChangedAt || 0);
        if (s.profileName && since < NAME_CHANGE_COOLDOWN_MS) return false;
        set({ profileName: name.trim().slice(0, 16), nameChangedAt: Date.now() });
        return true;
      },
      setTutorialSeen: (tutorialSeen) => set({ tutorialSeen }),
      setScreen: (screen) => set({ screen }),
      setLanguage: (language) => set({ language }),
      setMode: (mode) => set({ mode }),
      setStage: (stage) => set({ stage }),
      setWeather: (weather) => set({ weather }),
      addXp: (amount) => set((s) => ({ xp: s.xp + Math.max(0, amount) })),
      selectCharacter: (id) => set({ selectedId: id }),
      updateSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } as GameSettings })),
      setItem: (characterId, slot, itemId) =>
        set((s) => ({
          equipment: {
            ...s.equipment,
            [characterId]: {
              ...(s.equipment[characterId] ?? {}),
              [slot]: itemId ?? undefined,
            },
          },
        })),
      toggleFacing: (characterId) =>
        set((s) => ({
          facingFlips: {
            ...s.facingFlips,
            [characterId]: !s.facingFlips[characterId],
          },
        })),
      setTouchControls: (on) => set({ touchControls: on }),
    }),
    {
      name: 'kavgaci-save',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.screen = 'menu';
        if (!state.equipment) state.equipment = { ...DEFAULT_EQUIP };
        if (!state.facingFlips) state.facingFlips = {};
        if (typeof state.touchControls !== 'boolean') state.touchControls = false;
        if (!state.weather) state.weather = 'none';
        if (typeof state.profileName !== 'string') state.profileName = '';
        if (!state.gender) state.gender = 'none';
        if (typeof state.nameChangedAt !== 'number') state.nameChangedAt = 0;
        if (typeof state.tutorialSeen !== 'boolean') state.tutorialSeen = false;
      },
    },
  ),
);