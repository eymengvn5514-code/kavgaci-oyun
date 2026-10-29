import type { DismemberKind } from './types';

/**
 * Karakter başına finisher tarifi.
 *
 * `fatality` → R (ult) ile öldürünce: uzuv kopar (kafa / kol / ikisi).
 * `labality` → E ile öldürünce: kemik kırılır (kollar / bacaklar çöker).
 *
 * Koparma işi gerçek iskelette yapılır (GLBModel `dismember`), buradaki tarif
 * yalnızca hangi kemiğin gideceğini ve kan rengini söyler.
 */
export interface FinisherDef {
  fatality: DismemberKind;
  labality: DismemberKind;
}

/** Element → kan rengi. Egzotik canlılarda kan da egzotik. */
const BLOOD_BY_ELEMENT: Record<string, string> = {
  ice: '#bdefff',
  lightning: '#ffe9a3',
  fire: '#ff8a3d',
  ghost: '#7b3fd4',
  zombie: '#5f8f1e',
  shadow: '#2b1c3f',
  earth: '#8a5a2b',
  wind: '#cfe9f5',
  water: '#5fb3e8',
  steel: '#c9d3dc',
  beast: '#b8131f',
  cyber: '#12c7e8',
  poison: '#7ecb2a',
  sound: '#ff8fc7',
  light: '#ffe9a8',
  blood: '#5e0207',
  bone: '#c8a878',
  gravity: '#5b3fc8',
  time: '#57e0d6',
  nature: '#7bc043',
};

const DEFAULT_BLOOD = '#8d0b12';

export function bloodFor(element: string): string {
  return BLOOD_BY_ELEMENT[element] ?? DEFAULT_BLOOD;
}

/**
 * Yirmi dövüşçünün finisher tablosu. Her karakter farklı bir şey yapar:
 * kimisi kafa koparır, kimisi kolu söker ve fırlatır, kimisi eklemleri kırar.
 */
export const FINISHERS: Record<string, FinisherDef> = {
  frozman: { fatality: 'head', labality: 'legs' }, // statik kafes: kafa kesme
  kuroi: { fatality: 'arm', labality: 'arms' }, // çelik kol sökme
  gaia: { fatality: 'headArm', labality: 'legs' },
  volt: { fatality: 'head', labality: 'arms' }, // aşırı yük → kafa patlar
  blaze: { fatality: 'headArm', labality: 'legs' },
  riptide: { fatality: 'arm', labality: 'arms' },
  zephyr: { fatality: 'headArm', labality: 'legs' },
  titan: { fatality: 'head', labality: 'arms' }, // statik kafes: kafa kesme
  crimson: { fatality: 'head', labality: 'legs' }, // kafa koparma + kan emme
  ghost: { fatality: 'head', labality: 'arms' },
  fang: { fatality: 'arm', labality: 'legs' },
  venom: { fatality: 'headArm', labality: 'arms' },
  banshee: { fatality: 'head', labality: 'arms' },
  zombie: { fatality: 'arm', labality: 'legs' },
  cx9: { fatality: 'head', labality: 'arms' }, // statik kafes: kafa kesme
  wraith: { fatality: 'head', labality: 'arms' },
  ossuary: { fatality: 'arm', labality: 'legs' },
  singularity: { fatality: 'head', labality: 'arms' },
  chronos: { fatality: 'headArm', labality: 'legs' },
  seraph: { fatality: 'head', labality: 'arms' },
};

const FALLBACK: FinisherDef = { fatality: 'head', labality: 'legs' };

export function finisherFor(charId: string): FinisherDef {
  return FINISHERS[charId] ?? FALLBACK;
}

export function dismemberFor(charId: string, kind: 'fatality' | 'labality'): DismemberKind {
  return finisherFor(charId)[kind];
}

/** Kopan uzuv var mı (kol/kafa fırlatılacak mı). */
export function limbOf(d: DismemberKind): 'head' | 'arm' | 'both' | null {
  if (d === 'head') return 'head';
  if (d === 'arm') return 'arm';
  if (d === 'headArm') return 'both';
  return null;
}
