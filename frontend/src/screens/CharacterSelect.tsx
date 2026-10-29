import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ELEMENT_LABELS,
  STARTING_UNLOCK_COUNT,
  getCharacter,
  sortedCharacters,
} from '../data/characters';
import { SKILL_KIND_LABEL, getSkills } from '../data/skills';
import type { SkillId } from '../data/skills';
import type { WeatherId } from '../game/types';
import { STAGES } from '../game/stages';
import { levelInfo, unlockedCountFor, useGameStore } from '../store/useGameStore';
import { MapIntro, MAP_INTRO } from './MapIntro';

export default function CharacterSelect() {
  const { t } = useTranslation();
  const language = useGameStore((s) => s.language);
  const xp = useGameStore((s) => s.xp);
  const stage = useGameStore((s) => s.stage);
  const setStage = useGameStore((s) => s.setStage);
  const weather = useGameStore((s) => s.weather);
  const setWeather = useGameStore((s) => s.setWeather);
  const selectedId = useGameStore((s) => s.selectedId);
  const selectCharacter = useGameStore((s) => s.selectCharacter);
  const setScreen = useGameStore((s) => s.setScreen);
  const addXp = useGameStore((s) => s.addXp);
  const facingFlips = useGameStore((s) => s.facingFlips);
  const toggleFacing = useGameStore((s) => s.toggleFacing);

  const info = levelInfo(xp);
  const unlocked = unlockedCountFor(info.level);
  const selected = getCharacter(selectedId) ?? sortedCharacters[0];
  const skillDefs = getSkills(selected);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="screen select-screen">
      <header className="select-header">
        <button className="btn btn-ghost" onClick={() => setScreen('menu')}>
          ← {t('common.back')}
        </button>
        <h2>{t('select.title')}</h2>
        <div className="level-box">
          <span>
            {t('select.level')} <b>{info.level}</b>
          </span>
          <div className="xp-track">
            <div
              className="xp-fill"
              style={{ width: info.needed ? `${(info.current / info.needed) * 100}%` : '100%' }}
            />
          </div>
          <small>
            {info.needed ? `${info.current} / ${info.needed} XP` : t('select.allUnlocked')}
          </small>
        </div>
      </header>

      <div className="select-body">
        <div className="char-grid">
          {sortedCharacters.map((c) => {
            const locked = c.unlockOrder > unlocked;
            const isSel = c.id === selected.id;
            return (
              <button
                key={c.id}
                className={`char-card${isSel ? ' selected' : ''}${locked ? ' locked' : ''}`}
                disabled={locked}
                onClick={() => !locked && selectCharacter(c.id)}
              >
                <div
                  className="char-avatar"
                  style={{ background: `linear-gradient(160deg, ${c.color}, ${c.accent})` }}
                >
                  {locked ? '🔒' : c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="char-name">{c.name}</div>
                <div className="char-elem">
                  {locked
                    ? t('select.unlockAt', { level: Math.max(1, c.unlockOrder - STARTING_UNLOCK_COUNT + 1) })
                    : ELEMENT_LABELS[c.element][language]}
                </div>
              </button>
            );
          })}
        </div>

        <aside className="detail">
          <div
            className="detail-hero"
            style={{ background: `linear-gradient(160deg, ${selected.color}, ${selected.accent})` }}
          >
            <span>{selected.name}</span>
          </div>
          <div className="detail-sub">
            {ELEMENT_LABELS[selected.element][language]} · {t('select.level')} {info.level}
          </div>

          <div className="stats">
            {(
              [
                ['hp', selected.stats.hp],
                ['atk', selected.stats.atk],
                ['spd', selected.stats.spd],
                ['range', selected.stats.range],
              ] as const
            ).map(([key, value]) => (
              <div className="stat-row" key={key}>
                <span>{t(`select.stats.${key}`)}</span>
                <div className="stat-bar">
                  <i style={{ width: `${value * 10}%`, background: selected.accent }} />
                </div>
              </div>
            ))}
          </div>

          <h3 className="skills-title">{t('select.skills')}</h3>
          <ul className="skills">
            {(
              [
                ['skillE', 'e', selected.skills.e],
                ['skillC', 'c', selected.skills.c],
                ['skillQ', 'q', selected.skills.q],
                ['skillUlt', 'ult', selected.skills.ult],
              ] as [string, SkillId, { tr: string; en: string }][]
            ).map(([key, id, text]) => (
              <li key={id}>
                <span className="skill-key">{t(`select.${key}`)}</span>
                <span className="skill-name">
                  {text[language]}
                  <em className="skill-kind">
                    {SKILL_KIND_LABEL[skillDefs[id].kind][language]}
                    {skillDefs[id].damage > 0 ? ` · ${skillDefs[id].damage}` : ''}
                  </em>
                </span>
              </li>
            ))}
          </ul>

          <h3 className="skills-title">{t('select.stage')}</h3>
          <div className="stage-picker">
            {STAGES.map((s) => (
              <button
                key={s.id}
                className={stage === s.id ? 'active' : ''}
                onClick={() => {
                  setStage(s.id);
                  if (MAP_INTRO[s.id]) setPreview(s.id);
                }}
              >
                {s.name[language]}
              </button>
            ))}
          </div>

          <h3 className="skills-title">{t('select.weather')}</h3>
          <div className="stage-picker weather-picker">
            {(
              [
                { id: 'none', key: 'weatherNone' },
                { id: 'rain', key: 'weatherRain' },
                { id: 'snow', key: 'weatherSnow' },
                { id: 'katana', key: 'weatherKatana' },
              ] as { id: WeatherId; key: string }[]
            ).map((w) => (
              <button
                key={w.id}
                className={weather === w.id ? 'active' : ''}
                onClick={() => setWeather(w.id)}
              >
                {t(`select.${w.key}`)}
              </button>
            ))}
          </div>

          <div className="detail-actions">
            <button className="btn btn-primary fight-btn" onClick={() => setScreen('game')}>
              {t('select.fight')}
            </button>
            <button
              className="btn btn-ghost flip-btn"
              onClick={() => toggleFacing(selected.id)}
              title={t('select.flip')}
            >
              {facingFlips[selected.id] ? '↩' : '↪'} {t('select.flip')}
            </button>
          </div>
          <button className="btn btn-ghost dev-xp" onClick={() => addXp(120)}>
            {t('select.devAddXp')}
          </button>
        </aside>
      </div>

      {preview && (
        <MapIntro
          stageId={preview}
          label={STAGES.find((s) => s.id === preview)?.name[language]}
          onDone={() => setPreview(null)}
        />
      )}
    </div>
  );
}
