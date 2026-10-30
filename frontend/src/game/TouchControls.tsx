import { useTranslation } from 'react-i18next';
import { SKILL_IDS, SKILL_KEY_LABEL } from '../data/skills';
import type { SkillId } from '../data/skills';
import { touchInput } from './touchInput';

interface TouchControlsProps {
  /** Oyuncunun yetenek cooldown'ları (saniye). */
  cd: Record<SkillId, number>;
  /** Ultimate açık mı (can %50 altı). */
  ultReady: boolean;
  /** Yetenek adları (dil). */
  skillNames: Record<SkillId, string>;
  onCast: (id: SkillId) => void;
  /** 50. seviye katana yeteneği (varsa yumruğun üstünde görünür). */
  katana?: { cd: number; onCast: () => void };
}

/**
 * Mobil dokunmatik kontroller:
 *  - Sol: WASD düzeninde hareket ve iki yetenek
 *  - Sağ: iki yetenek, yumruk ve tekme
 * Cooldown'u olan yetenek tuşu basılamaz.
 */
export default function TouchControls({ cd, ultReady, skillNames, onCast, katana }: TouchControlsProps) {
  const { t } = useTranslation();

  const hold = (key: 'left' | 'right' | 'crouch') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      touchInput[key] = true;
    },
    onPointerUp: () => {
      touchInput[key] = false;
    },
    onPointerCancel: () => {
      touchInput[key] = false;
    },
    onLostPointerCapture: () => {
      touchInput[key] = false;
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const tap = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      fn();
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const skillButton = (id: (typeof SKILL_IDS)[number]) => {
    const remaining = cd[id];
    const locked = id === 'ult' && !ultReady;
    const disabled = remaining > 0 || locked;
    return (
      <button
        key={id}
        className={`touch-skill${disabled ? ' cooling' : ''}${id === 'ult' ? ' ult' : ''}`}
        disabled={disabled}
        aria-label={skillNames[id]}
        {...tap(() => onCast(id))}
      >
        <span className="touch-skill-key">{SKILL_KEY_LABEL[id]}</span>
        <span className="touch-skill-name">{skillNames[id]}</span>
        <span className="touch-skill-meta">{remaining > 0 ? `${Math.ceil(remaining)}` : locked ? '%50' : ''}</span>
      </button>
    );
  };

  return (
    <div className="touch-controls">
      <div className="touch-left">
        <div className="touch-pad wasd-pad">
          <span />
          <button className="touch-btn" aria-label={t('touch.jump')} {...tap(() => (touchInput.jump = true))}>W</button>
          <span />
          <button className="touch-btn move" aria-label={t('touch.left')} {...hold('left')}>A</button>
          <button className="touch-btn move" aria-label={t('touch.crouch')} {...hold('crouch')}>S</button>
          <button className="touch-btn move" aria-label={t('touch.right')} {...hold('right')}>D</button>
        </div>
        <div className="touch-skills touch-skills-left">{skillButton(SKILL_IDS[0])}{skillButton(SKILL_IDS[1])}</div>
      </div>

      <div className="touch-right">
        <div className="touch-skills touch-skills-right">{skillButton(SKILL_IDS[2])}{skillButton(SKILL_IDS[3])}</div>
        {katana && (
          <button
            className={`touch-attack katana${katana.cd > 0 ? ' cooling' : ''}`}
            disabled={katana.cd > 0}
            aria-label={t('game.katana')}
            {...tap(katana.onCast)}
          >
            <span className="touch-skill-key">T</span>
            <span>{t('game.katana')}</span>
            {katana.cd > 0 && <span className="touch-skill-meta">{Math.ceil(katana.cd)}</span>}
          </button>
        )}
        <button
          className="touch-attack punch"
          aria-label={t('touch.punch')}
          {...tap(() => (touchInput.attack = 'punch'))}
        >
          <span>{t('touch.punch')}</span>
        </button>
        <button
          className="touch-attack kick"
          aria-label={t('touch.kick')}
          {...tap(() => (touchInput.attack = 'kick'))}
        >
          <span>{t('touch.kick')}</span>
        </button>
      </div>
    </div>
  );
}
