/**
 * Dokunmatik (mobil) girdi — UI butonları yazar, `Fighter` her frame okur.
 * Klavye/fare ile aynı kanaldan beslenir; ayrı bir React state gerekmez.
 */
export type TouchAttack = 'punch' | 'kick';

export interface TouchState {
  left: boolean;
  right: boolean;
  crouch: boolean;
  /** Tek seferlik: Fighter tüketince sıfırlar. */
  jump: boolean;
  /** Tek seferlik: Fighter tüketince sıfırlar. */
  attack: TouchAttack | null;
}

export const touchInput: TouchState = {
  left: false,
  right: false,
  crouch: false,
  jump: false,
  attack: null,
};

/** Basılı tutulan tuşları bırakır (ekran değişince takılı kalmasın). */
export function releaseTouchHolds() {
  touchInput.left = false;
  touchInput.right = false;
  touchInput.crouch = false;
}
