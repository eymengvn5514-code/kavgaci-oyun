import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/useGameStore';
import { getCharacter, sortedCharacters } from '../data/characters';
import ProfileBadge from '../components/ProfileBadge';
import { TrendUpIcon } from './LeaderboardScreen';
import AccountSetup from './AccountSetup';

export default function MainMenu() {
  const { t } = useTranslation();
  const setScreen = useGameStore((s) => s.setScreen);
  const setMode = useGameStore((s) => s.setMode);
  const selectedId = useGameStore((s) => s.selectedId);
  const xp = useGameStore((s) => s.xp);
  const profileName = useGameStore((s) => s.profileName);
  const [account, setAccount] = useState(false);

  const selected = getCharacter(selectedId) ?? sortedCharacters[0];

  const start = (mode: 'single' | 'online') => {
    setMode(mode);
    setScreen('characters');
  };

  return (
    <div className="screen menu-screen">
      <button className="gear" title={t('menu.settings')} onClick={() => setScreen('settings')}>
        ⚙
      </button>

      <button
        className="leaderboard-btn"
        title={t('menu.leaderboard')}
        onClick={() => setScreen('leaderboard')}
      >
        <TrendUpIcon />
      </button>

      <button className="account-btn" title={t('menu.account')} onClick={() => setAccount(true)}>
        👤
      </button>

      <div className="menu-top-profile">
        <ProfileBadge name={profileName || selected.name} color={selected.accent} xp={xp} />
      </div>

      <div className="brand">
        <h1>{t('app.title')}</h1>
        <p>{t('app.subtitle')}</p>
      </div>

      <nav className="menu-buttons">
        <button
          className="menu-btn"
          onClick={() => {
            setMode('online');
            setScreen('online');
          }}
        >
          <span className="label">{t('menu.online')}</span>
          <span className="desc">{t('menu.onlineDesc')}</span>
        </button>
        <button className="menu-btn" onClick={() => start('single')}>
          <span className="label">{t('menu.single')}</span>
          <span className="desc">{t('menu.singleDesc')}</span>
        </button>
        <button className="menu-btn" onClick={() => setScreen('characters')}>
          <span className="label">{t('menu.characters')}</span>
          <span className="desc">{t('menu.charactersDesc')}</span>
        </button>
        <button className="menu-btn" onClick={() => setScreen('bag')}>
          <span className="label">{t('menu.bag')}</span>
          <span className="desc">{t('menu.bagDesc')}</span>
        </button>
        <button className="menu-btn" onClick={() => setScreen('leaderboard')}>
          <span className="label">{t('menu.leaderboard')}</span>
          <span className="desc">{t('menu.leaderboardDesc')}</span>
        </button>
      </nav>

      {account && <AccountSetup onClose={() => setAccount(false)} />}
    </div>
  );
}