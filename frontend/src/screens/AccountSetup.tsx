import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NAME_CHANGE_COOLDOWN_MS, useGameStore } from '../store/useGameStore';
import type { Gender } from '../store/useGameStore';

/** Hesap oluşturma / isim değiştirme — maç sonunda veya menüden. */
export default function AccountSetup({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const profileName = useGameStore((s) => s.profileName);
  const gender = useGameStore((s) => s.gender);
  const nameChangedAt = useGameStore((s) => s.nameChangedAt);
  const setProfile = useGameStore((s) => s.setProfile);
  const renameProfile = useGameStore((s) => s.renameProfile);

  const isNew = !profileName;
  const [name, setName] = useState(profileName);
  const [pick, setPick] = useState<Gender>(gender === 'none' ? 'male' : gender);
  const [error, setError] = useState('');

  const since = Date.now() - (nameChangedAt || 0);
  const lockedDays = Math.ceil((NAME_CHANGE_COOLDOWN_MS - since) / 86400000);

  const submit = () => {
    const clean = name.trim();
    if (clean.length < 3) {
      setError(t('account.tooShort'));
      return;
    }
    if (isNew) {
      setProfile(clean, pick);
      onClose?.();
      return;
    }
    if (renameProfile(clean)) {
      onClose?.();
    } else {
      setError(t('account.weeklyLock', { days: lockedDays }));
    }
  };

  return (
    <div className="account-overlay">
      <div className="account-card">
        <h2>{isNew ? t('account.createTitle') : t('account.renameTitle')}</h2>
        <p className="account-desc">{t('account.desc')}</p>

        <label className="account-label">{t('account.gender')}</label>
        <div className="gender-row">
          <button
            className={`gender-btn${pick === 'male' ? ' active' : ''}`}
            onClick={() => setPick('male')}
          >
            ♂ {t('account.male')}
          </button>
          <button
            className={`gender-btn${pick === 'female' ? ' active' : ''}`}
            onClick={() => setPick('female')}
          >
            ♀ {t('account.female')}
          </button>
        </div>

        <label className="account-label">{t('account.name')}</label>
        <input
          className="account-input"
          value={name}
          maxLength={16}
          placeholder={t('account.namePlaceholder')}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {error && <p className="account-error">{error}</p>}
        {!isNew && (
          <p className="account-hint">
            {lockedDays > 0 ? t('account.lockedDays', { days: lockedDays }) : t('account.canChange')}
          </p>
        )}

        <div className="account-actions">
          {onClose && (
            <button className="btn btn-ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
          )}
          <button className="btn btn-primary" onClick={submit}>
            {isNew ? t('account.create') : t('account.rename')}
          </button>
        </div>
      </div>
    </div>
  );
}
