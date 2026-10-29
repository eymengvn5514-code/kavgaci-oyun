import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MainMenu from './screens/MainMenu';
import CharacterSelect from './screens/CharacterSelect';
import SettingsScreen from './screens/SettingsScreen';
import BagScreen from './screens/BagScreen';
import OnlineLobby from './screens/OnlineLobby';
import LeaderboardScreen from './screens/LeaderboardScreen';
import GameScreen from './game/GameScreen';
import SplashScreen from './screens/SplashScreen';
import TutorialOverlay from './screens/TutorialOverlay';
import AccountSetup from './screens/AccountSetup';
import { useGameStore } from './store/useGameStore';
import { audio, TRACK } from './audio/audio';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const language = useGameStore((s) => s.language);
  const profileName = useGameStore((s) => s.profileName);
  const tutorialSeen = useGameStore((s) => s.tutorialSeen);
  const { i18n } = useTranslation();
  const [booted, setBooted] = useState(false);
  const [accountPrompt, setAccountPrompt] = useState(true);

  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language, i18n]);

  // menü müziği: menü ekranlarında çalar, maça girince susar
  useEffect(() => {
    if (!booted) return;
    if (screen === 'game') audio.stopMusic();
    else audio.playMusic(TRACK.menu);
  }, [booted, screen]);

  return (
    <div className="app-shell">
      {screen === 'menu' && <MainMenu />}
      {screen === 'characters' && <CharacterSelect />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'bag' && <BagScreen />}
      {screen === 'online' && <OnlineLobby />}
      {screen === 'leaderboard' && <LeaderboardScreen />}
      {screen === 'game' && <GameScreen />}

      {booted && !tutorialSeen && <TutorialOverlay />}
      {booted && screen === 'menu' && !profileName && tutorialSeen && accountPrompt && (
        <AccountSetup onClose={() => setAccountPrompt(false)} />
      )}
      {!booted && <SplashScreen onDone={() => setBooted(true)} />}
    </div>
  );
}
