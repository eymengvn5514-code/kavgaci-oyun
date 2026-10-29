import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/useGameStore';
import { getCharacter, sortedCharacters } from '../data/characters';
import { ITEMS, SLOT_LABEL, SLOT_ORDER, itemById } from '../data/items';

/** Çanta — karaktere eşya kuşan (el/sırt). Dövüşte görsel olarak takılır. */
export default function BagScreen() {
  const { t } = useTranslation();
  const language = useGameStore((s) => s.language);
  const selectedId = useGameStore((s) => s.selectedId);
  const selectCharacter = useGameStore((s) => s.selectCharacter);
  const setScreen = useGameStore((s) => s.setScreen);
  const equipment = useGameStore((s) => s.equipment);
  const setItem = useGameStore((s) => s.setItem);

  const selected = getCharacter(selectedId) ?? sortedCharacters[0];
  const equipped = equipment[selected.id] ?? {};

  return (
    <div className="screen bag-screen">
      <header className="select-header">
        <button className="btn btn-ghost" onClick={() => setScreen('menu')}>
          ← {t('common.back')}
        </button>
        <h2>{t('bag.title')}</h2>
      </header>

      <p className="bag-desc">{t('bag.desc')}</p>

      <div className="bag-body">
        <div className="bag-chars">
          {sortedCharacters.map((c) => (
            <button
              key={c.id}
              className={c.id === selected.id ? 'active' : ''}
              onClick={() => selectCharacter(c.id)}
              style={{ background: `linear-gradient(160deg, ${c.color}, ${c.accent})` }}
              title={c.name}
            >
              {c.name.slice(0, 2).toUpperCase()}
            </button>
          ))}
        </div>

        <div className="bag-cols">
          {SLOT_ORDER.map((slot) => {
            const current = equipped[slot];
            const currentDef = current ? itemById(current) : undefined;
            return (
              <section key={slot} className="bag-slot-col">
                <h3>{SLOT_LABEL[slot][language]}</h3>
                <div className="bag-equipped">
                  {currentDef ? (
                    <>
                      <b>{currentDef.name[language]}</b>
                      <button className="btn btn-ghost" onClick={() => setItem(selected.id, slot, null)}>
                        {t('bag.remove')}
                      </button>
                    </>
                  ) : (
                    <em className="bag-empty">—</em>
                  )}
                </div>
                <ul className="bag-items">
                  {ITEMS.filter((i) => i.slot === slot).map((i) => {
                    const active = current === i.id;
                    return (
                      <li key={i.id}>
                        <button
                          className={active ? 'active' : ''}
                          onClick={() => setItem(selected.id, slot, active ? null : i.id)}
                        >
                          <b>{i.name[language]}</b>
                          <small>{i.desc[language]}</small>
                          <span className="bag-state">{active ? t('bag.equipped') : t('bag.equip')}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}