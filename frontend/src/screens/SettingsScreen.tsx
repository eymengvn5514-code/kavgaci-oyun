import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/useGameStore';
import type { GraphicsPreset } from '../store/useGameStore';

const GRAPHICS: GraphicsPreset[] = ['low', 'medium', 'high'];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const setScreen = useGameStore((s) => s.setScreen);
  const language = useGameStore((s) => s.language);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const settings = useGameStore((s) => s.settings);
  const updateSetting = useGameStore((s) => s.updateSetting);

  const volumes = (
    [
      ['master', t('settings.master')],
      ['music', t('settings.music')],
      ['sfx', t('settings.sfx')],
    ] as const
  ).map(([key, label]) => (
    <div className="setting-row" key={key}>
      <label>{label}</label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={settings[key]}
        onChange={(e) => updateSetting(key, Number(e.target.value))}
      />
    </div>
  ));

  return (
    <div className="screen settings-screen">
      <header className="select-header">
        <button className="btn btn-ghost" onClick={() => setScreen('menu')}>
          ← {t('settings.back')}
        </button>
        <h2>{t('settings.title')}</h2>
        <span />
      </header>

      <div className="settings-panel">
        <div className="setting-row">
          <label>{t('settings.language')}</label>
          <div className="seg">
            <button className={language === 'tr' ? 'active' : ''} onClick={() => setLanguage('tr')}>
              Türkçe
            </button>
            <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
              English
            </button>
          </div>
        </div>

        <h3 className="settings-group">{t('settings.audio')}</h3>
        {volumes}

        <h3 className="settings-group">{t('settings.graphics')}</h3>
        <div className="setting-row">
          <label>{t('settings.graphics')}</label>
          <div className="seg">
            {GRAPHICS.map((g) => (
              <button
                key={g}
                className={settings.graphics === g ? 'active' : ''}
                onClick={() => updateSetting('graphics', g)}
              >
                {t(`settings.${g}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
