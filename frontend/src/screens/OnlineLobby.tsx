import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { STAGES } from '../game/stages';
import {
  ELEMENT_LABELS,
  getCharacter,
  sortedCharacters,
} from '../data/characters';
import { levelInfo, unlockedCountFor, useGameStore } from '../store/useGameStore';
import { net } from '../net/net';
import type { StageId } from '../game/types';

/** Geri sayım (ms) — 250ms'de bir tazelenir. */
function useCountdown(deadline: number) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!deadline) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);
  return Math.ceil(remaining / 1000);
}

export default function OnlineLobby() {
  const { t } = useTranslation();
  const language = useGameStore((s) => s.language);
  const xp = useGameStore((s) => s.xp);
  const setScreen = useGameStore((s) => s.setScreen);
  const setStage = useGameStore((s) => s.setStage);
  const setWeather = useGameStore((s) => s.setWeather);
  const weather = useGameStore((s) => s.weather);
  const selectedId = useGameStore((s) => s.selectedId);
  const selectCharacter = useGameStore((s) => s.selectCharacter);
  const profileName = useGameStore((s) => s.profileName);
  const gender = useGameStore((s) => s.gender);

  const snap = useSyncExternalStore(net.subscribe, net.getSnapshot);
  const seconds = useCountdown(snap.deadline);

  const selected = getCharacter(selectedId) ?? sortedCharacters[0];
  const unlocked = unlockedCountFor(levelInfo(xp).level);
  const navigating = useRef(false);

  // lobiye girince bağlan
  useEffect(() => {
    net.connect();
    net.setProfile(profileName || selected.name, xp);
  }, [profileName, selected.name, xp]);

  // avuç içi (arama) sırasında ekrandan çıkılırsa kuyruktan düş
  useEffect(() => {
    return () => {
      if (net.getSnapshot().phase === 'queue') net.cancel();
    };
  }, []);

  // maç başladı → oyuna geç
  useEffect(() => {
    if (snap.phase === 'starting' || snap.phase === 'fight') {
      if (navigating.current) return;
      navigating.current = true;
      if (snap.stage) setStage(snap.stage as StageId);
      setScreen('game');
    }
  }, [snap.phase, snap.stage, setScreen, setStage]);

  const statusText = (() => {
    if (snap.status === 'connecting') return t('online.connecting');
    if (snap.status === 'error') return t('online.error');
    return null;
  })();

  const showPicker = snap.phase === 'pick';
  const showVote = snap.phase === 'vote';

  return (
    <div className="screen online-screen">
      <header className="online-header">
        <button className="btn btn-ghost" onClick={() => setScreen('menu')}>
          ← {t('common.back')}
        </button>
        <h2>{t('online.title')}</h2>
        <div className="active-count" title={t('online.active')}>
          <span className="dot" />
          {t('online.active')}: <b>{snap.count}</b>
        </div>
      </header>

      <div className="online-body">
        <div className="online-vs">
          <div className="vs-card me">
            <span className="vs-role">{t('online.you')}</span>
            <div className="vs-avatar" style={{ background: `linear-gradient(160deg, ${selected.color}, ${selected.accent})` }}>
              {selected.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="vs-name">
              {gender === 'female' ? '♀ ' : gender === 'male' ? '♂ ' : ''}
              {profileName || selected.name}
            </span>
            {snap.myPick && <span className="vs-pick">{getCharacter(snap.myPick)?.name}</span>}
          </div>

          <div className="vs-mid">
            <span className="vs">VS</span>
            {snap.phase === 'queue' && (
              <span className="countdown">{seconds}s</span>
            )}
          </div>

          <div className={`vs-card opp${snap.opponentName ? '' : ' empty'}`}>
            <span className="vs-role">{t('online.opponent')}</span>
            <div className="vs-avatar placeholder">?</div>
            <span className="vs-name">{snap.opponentName || '—'}</span>
            {snap.opponentPick && <span className="vs-pick">{getCharacter(snap.opponentPick)?.name}</span>}
          </div>
        </div>

        <p className="online-status">
          {statusText}
          {snap.phase === 'idle' && t('online.idle')}
          {snap.phase === 'queue' && `${t('online.searching')}…`}
          {snap.phase === 'pick' && t('online.pickTitle')}
          {snap.phase === 'vote' && t('online.voteHint')}
          {snap.phase === 'starting' && t('online.starting')}
          {snap.phase === 'canceled' && (snap.reason ? t(snap.reason) : t('online.canceled'))}
          {snap.status === 'simulated' && <span className="sim-note">{t('online.simulated')}</span>}
        </p>

        {(snap.phase === 'pick' || showVote) && snap.deadline > 0 && (
          <div className="deadline-bar">
            <i style={{ width: `${Math.min(100, (seconds / 30) * 100)}%` }} />
          </div>
        )}

        {showPicker && (
          <div className="online-picker">
            {sortedCharacters.map((c) => {
              const locked = c.unlockOrder > unlocked;
              const isSel = c.id === (snap.myPick ?? selectedId);
              return (
                <button
                  key={c.id}
                  className={`char-card${isSel ? ' selected' : ''}${locked ? ' locked' : ''}`}
                  disabled={locked}
                  onClick={() => {
                    selectCharacter(c.id);
                    net.pickCharacter(c.id);
                  }}
                >
                  <div className="char-avatar" style={{ background: `linear-gradient(160deg, ${c.color}, ${c.accent})` }}>
                    {locked ? '🔒' : c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="char-name">{c.name}</div>
                  <div className="char-elem">{ELEMENT_LABELS[c.element][language]}</div>
                </button>
              );
            })}
          </div>
        )}

        {showVote && (
          <>
            <div className="online-vote">
              {STAGES.map((s) => {
                const mine = snap.role ? snap.votes[snap.role] === s.id : false;
                const opp = snap.role ? snap.votes[snap.role === 'p1' ? 'p2' : 'p1'] === s.id : false;
                return (
                  <button
                    key={s.id}
                    className={`vote-card${mine ? ' mine' : ''}${opp ? ' opp' : ''}`}
                    onClick={() => net.vote(s.id)}
                  >
                    <span>{s.name[language]}</span>
                    {mine && <em>{t('online.you')}</em>}
                    {opp && <em className="opp">{t('online.opponent')}</em>}
                  </button>
                );
              })}
            </div>

            <h4 className="skills-title" style={{ marginTop: 12 }}>{t('select.weather')}</h4>
            <div className="stage-picker weather-picker">
              {(
                [
                  { id: 'none', key: 'weatherNone' },
                  { id: 'rain', key: 'weatherRain' },
                  { id: 'snow', key: 'weatherSnow' },
                  { id: 'katana', key: 'weatherKatana' },
                ] as { id: any; key: string }[]
              ).map((w) => (
                <button
                  key={w.id}
                  className={weather === w.id ? 'active' : ''}
                  onClick={() => setWeather(w.id as any)}
                >
                  {t(`select.${w.key}`)}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="online-actions">
          {(snap.phase === 'idle' || snap.phase === 'canceled') && (
            <button
              className="btn btn-primary"
              onClick={() => net.queue(profileName || selected.name, selected.id)}
            >
              {t('online.find')}
            </button>
          )}
          {snap.phase === 'queue' && (
            <button className="btn btn-ghost" onClick={() => net.cancel()}>
              {t('online.cancel')}
            </button>
          )}
          {(snap.phase === 'pick' || snap.phase === 'vote') && (
            <button className="btn btn-ghost" onClick={() => net.cancel()}>
              {t('online.cancel')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setScreen('characters')}>
            {t('online.changeFighter')}
          </button>
        </div>
      </div>
    </div>
  );
}
