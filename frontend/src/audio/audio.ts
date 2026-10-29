/**
 * Ses yöneticisi — arka plan müziği + efektler.
 * Ses seviyeleri mağazadaki `settings` (master/music/sfx) ile canlı senkron.
 * Tarayıcı autoplay kilidi: ilk kullanıcı hareketine kadar bekler.
 */
import { useGameStore } from '../store/useGameStore';

const BASE = import.meta.env.BASE_URL || '/';
const fx = (p: string) => `${BASE}audio/${p}`;

export const TRACK = {
  menu: fx('menu.mp3'),
  intro: fx('intro.wav'),
};

/** Efekt kütüphanesi — dosyalar `frontend/public/audio/`. */
export const SFX = {
  intro: fx('intro.wav'),
  transition: fx('transition-07.wav'),
  bone1: fx('bone-01.wav'),
  bone2: fx('bone-02.wav'),
  spell: [
    fx('spell-01.wav'),
    fx('spell-03.wav'),
    fx('spell-04.wav'),
    fx('spell-05.wav'),
    fx('spell-06.wav'),
    fx('spell-08.wav'),
    fx('spell-09.wav'),
    fx('spell-10.wav'),
    fx('spell-ai.wav'),
  ],
} as const;

/** Element -> efekt indeksi (her karakter kendi sesini alır). */
const ELEMENT_SFX: Record<string, number> = {
  ice: 0,
  lightning: 6,
  fire: 3,
  ghost: 4,
  zombie: 7,
  shadow: 5,
  earth: 2,
  wind: 8,
  water: 1,
  steel: 5,
  beast: 7,
  cyber: 6,
  poison: 2,
  sound: 4,
  light: 8,
  blood: 3,
  bone: 1,
  gravity: 5,
  time: 0,
  nature: 2,
};

class AudioManager {
  private music: HTMLAudioElement | null = null;
  private musicSrc: string | null = null;
  private pool = new Map<string, HTMLAudioElement>();
  private unlocked = false;
  private pending: (() => void)[] = [];
  private lastSfx = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    const arm = () => {
      this.unlocked = true;
      const q = this.pending;
      this.pending = [];
      for (const fn of q) {
        try {
          fn();
        } catch {
          /* yoksay */
        }
      }
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(ev, arm, { once: true, passive: true });
    }
    // ayar değişince ses seviyelerini güncelle
    useGameStore.subscribe(() => this.applyVolumes());
    this.applyVolumes();
  }

  private levels() {
    const s = useGameStore.getState().settings;
    return { master: s.master, music: s.music, sfx: s.sfx };
  }

  private applyVolumes() {
    const { master, music } = this.levels();
    if (this.music) this.music.volume = clamp01(master * music * 0.9);
  }

  /** Müziği başlat (aynı parça zaten çalıyorsa dokunmaz). */
  playMusic(src: string) {
    if (typeof window === 'undefined') return;
    if (this.musicSrc === src && this.music && !this.music.paused) {
      this.applyVolumes();
      return;
    }
    this.stopMusic();
    const el = new Audio(src);
    el.loop = true;
    el.preload = 'auto';
    this.music = el;
    this.musicSrc = src;
    this.applyVolumes();
    const start = () => void el.play().catch(() => this.queueRetry(start));
    start();
  }

  stopMusic() {
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
      this.music = null;
      this.musicSrc = null;
    }
  }

  /** Tek seferlik efekt. `gain` 0-1 arası ek çarpan. */
  playSfx(src: string, gain = 1) {
    if (typeof window === 'undefined') return;
    const now = performance.now();
    if (now - this.lastSfx < 18) return; // aynı karede taşma koruması
    this.lastSfx = now;
    const { master, sfx } = this.levels();
    const vol = clamp01(master * sfx * gain);
    if (vol <= 0.001) return;
    let el = this.pool.get(src);
    if (!el) {
      el = new Audio(src);
      el.preload = 'auto';
      this.pool.set(src, el);
    }
    const play = () => {
      try {
        el!.currentTime = 0;
      } catch {
        /* yoksay */
      }
      el!.volume = vol;
      void el!.play().catch(() => {});
    };
    if (this.unlocked) play();
    else this.queueRetry(play);
  }

  /** Karakter elementine göre yetenek sesi. */
  spell(element: string, gain = 0.9) {
    const idx = ELEMENT_SFX[element] ?? 0;
    this.playSfx(SFX.spell[idx], gain);
  }

  /** Kemik kırılma sesi (KO / fatality). */
  bone(gain = 1) {
    this.playSfx(Math.random() < 0.5 ? SFX.bone1 : SFX.bone2, gain);
  }

  hit(gain = 0.7) {
    this.playSfx(SFX.bone2, gain);
  }

  private queueRetry(fn: () => void) {
    this.pending.push(fn);
    if (this.pending.length > 8) this.pending.shift();
  }

  /** Test/kapatma için. */
  get isUnlocked() {
    return this.unlocked;
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export const audio = new AudioManager();
