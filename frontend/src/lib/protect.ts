/**
 * Site koruması — devtools kısayollarını ve sağ tık menüsünü kapatır.
 * (Mutlak koruma değil; yaygın "hack" denemelerini engeller.)
 */
const BLOCKED_COMBOS: [boolean, boolean, string[]][] = [
  // [ctrl, shift, keys]
  [false, false, ['f12']],
  [true, true, ['i', 'j', 'c', 'k']],
  [true, false, ['u', 's']],
];

export function installProtection() {
  if (typeof window === 'undefined') return;

  window.addEventListener(
    'keydown',
    (e) => {
      const key = (e.key || '').toLowerCase();
      for (const [ctrl, shift, keys] of BLOCKED_COMBOS) {
        if (!keys.includes(key)) continue;
        if (ctrl !== (e.ctrlKey || e.metaKey)) continue;
        if (shift !== e.shiftKey) continue;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    },
    { capture: true },
  );

  // sağ tık menüsü kapalı (dövüşte sağ tık = tekme zaten preventDefault ediyor)
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // dev teşhis katmanı asla üretimde görünmez
  document.getElementById('kavgaci-debug')?.remove();
}
