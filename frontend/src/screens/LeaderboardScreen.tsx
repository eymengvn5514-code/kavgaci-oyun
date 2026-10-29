import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/useGameStore';
import { levelInfo } from '../store/useGameStore';
import { getCharacter, sortedCharacters } from '../data/characters';

interface Row {
  name: string;
  xp: number;
  you?: boolean;
}

/** Deterministik sözde-rastgele (sunucu yokken sabit sıralama). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TAGS = ['X', 'TR', 'PRO', '61', '07', '06', '34', '01', '35', '55', 'KİNG', 'GG', 'YT', 'OP', 'X1'];
const BASES = [
  'Kara', 'Gölge', 'Yıldız', 'Çelik', 'Kurt', 'Ejder', 'Şimşek', 'Buz', 'Alev', 'Fırtına',
  'Gece', 'Kan', 'Demir', 'Poyraz', 'Volkan', 'Sessiz', 'Gezgin', 'Kaya', 'Zehir', 'Hayalet',
  'Aslan', 'Şahin', 'Kartal', 'Bora', 'Çığ', 'Kılıç', 'Mızrak', 'Kalkan', 'Titan', 'Efsane',
  'Hayat', 'Rüzgar', 'Ay', 'Güneş', 'Yıldırım', 'Patron', 'Sensei', 'Usta', 'Çırak', 'Panter',
];
const SUFFIX = ['Bey', 'Han', 'Kaan', 'Yılmaz', 'Demir', 'Kaya', 'Sarı', 'Usta', 'Reis', 'Baba'];

function buildBoard(playerXp: number, playerName: string): Row[] {
  const rand = rng(4080);
  const rows: Row[] = [];
  for (let i = 0; i < 100; i++) {
    const base = BASES[Math.floor(rand() * BASES.length)];
    const suf = SUFFIX[Math.floor(rand() * SUFFIX.length)];
    const tag = TAGS[Math.floor(rand() * TAGS.length)];
    const name = `${base}${suf}${tag}`;
    // Yüksek XP eğilimli ama çeşitli: 3k–95k arası.
    const xp = Math.floor(3000 + Math.pow(rand(), 1.6) * 92000);
    rows.push({ name, xp });
  }
  rows.push({ name: playerName, xp: playerXp, you: true });
  rows.sort((a, b) => b.xp - a.xp);
  return rows;
}

/** iPhone mobil veri / borsa "yukarı artış" oku — tek renk beyaz. */
export function TrendUpIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 17.5 9.5 11l3.5 3.5L21 6.5"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 6.5H21V13"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };
const MEDAL_CLASS: Record<number, string> = { 0: 'gold', 1: 'silver', 2: 'bronze' };

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const setScreen = useGameStore((s) => s.setScreen);
  const xp = useGameStore((s) => s.xp);
  const selectedId = useGameStore((s) => s.selectedId);

  const selected = getCharacter(selectedId) ?? sortedCharacters[0];
  const rows = useMemo(() => buildBoard(xp, `${selected.name} (${levelInfo(xp).level}Lv)`), [xp, selected.name]);

  return (
    <div className="screen leaderboard-screen">
      <header className="select-header">
        <button className="btn btn-ghost" onClick={() => setScreen('menu')}>
          ← {t('common.back')}
        </button>
        <h2>{t('leaderboard.title')}</h2>
      </header>

      <p className="lb-subtitle">{t('leaderboard.subtitle', { count: rows.length })}</p>

      <div className="lb-list">
        {rows.map((row, i) => (
          <div key={`${row.name}-${i}`} className={`lb-row${row.you ? ' you' : ''}${MEDAL_CLASS[i] ? ` ${MEDAL_CLASS[i]}` : ''}`}>
            <span className="lb-rank">{MEDALS[i] ?? i + 1}</span>
            <span className="lb-name">
              {row.name}
              {row.you && <em className="lb-you">{t('leaderboard.you')}</em>}
            </span>
            <span className="lb-xp">{row.xp.toLocaleString()} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}
