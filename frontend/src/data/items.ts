/** Ekipman kataloğu — Çanta ekranında kuşanılabilen eşyalar. */

export type ItemSlot = 'hand' | 'back';

export interface ItemDef {
  id: string;
  slot: ItemSlot;
  name: { tr: string; en: string };
  desc: { tr: string; en: string };
  /** Dövüşte tamamen görseldir; hasar/özellik veren eşyalar ileride. */
}

export const ITEMS: ItemDef[] = [
  {
    id: 'katana',
    slot: 'hand',
    name: { tr: 'Katana', en: 'Katana' },
    desc: { tr: 'Keskin çelik kılıç', en: 'Sharp steel blade' },
  },
  {
    id: 'pack',
    slot: 'back',
    name: { tr: 'Gezgin Çantası', en: 'Adventurer Pack' },
    desc: { tr: 'Sırtına takılan çanta', en: 'A pack for your back' },
  },
  {
    id: 'shield',
    slot: 'hand',
    name: { tr: 'Kalkan', en: 'Shield' },
    desc: { tr: 'Zırhlı kalkan — dövüşte görsel olarak kullanılır', en: 'Reinforced shield — cosmetic' },
  },
  {
    id: 'staff',
    slot: 'hand',
    name: { tr: 'Asa', en: 'Staff' },
    desc: { tr: 'Uzun asa — dövüşte görsel olarak kullanılır', en: 'Long staff — cosmetic' },
  },
  {
    id: 'wings',
    slot: 'back',
    name: { tr: 'Kanatlar', en: 'Wings' },
    desc: { tr: 'Işıltılı kanatlar — dövüşte görsel olarak kullanılır', en: 'Glowing wings — cosmetic' },
  },
];

export const SLOT_ORDER: ItemSlot[] = ['hand', 'back'];

export const SLOT_LABEL: Record<ItemSlot, { tr: string; en: string }> = {
  hand: { tr: 'El', en: 'Hand' },
  back: { tr: 'Sırt', en: 'Back' },
};

/** Başlangıç kurgusu. */
export const DEFAULT_EQUIP: Record<string, { hand?: string; back?: string }> = {
  kuroi: { hand: 'katana' },
};

export function itemById(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}