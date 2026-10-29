import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/useGameStore';
import { getCharacter, sortedCharacters } from '../data/characters';
import { net } from '../net/net';

interface Row {
  name: string;
  xp: number;
  you?: boolean;
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
  const profileName = useGameStore((s) => s.profileName);
  const snapshot = useSyncExternalStore(net.subscribe, net.getSnapshot);

  const selected = getCharacter(selectedId) ?? sortedCharacters[0];
  useEffect(() => {
    net.connect();
    net.setProfile(profileName || selected.name, xp);
  }, [profileName, selected.name, xp]);

  const rows: Row[] = snapshot.players.map((player) => ({
    name: player.name,
    xp: player.xp,
    you: player.name === (profileName || selected.name),
  }));

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
        {snapshot.status !== 'online' ? <p className="lb-empty">{t('leaderboard.offline')}</p> : rows.length === 0 ? <p className="lb-empty">{t('leaderboard.empty')}</p> : rows.map((row, i) => (
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
