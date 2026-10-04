import { clamp } from './aleatoire';
import { HAUT_SMASH, MIL } from './constants';
import type { Balle, Coup, Joueur } from './types';

/**
 * Le moteur de qualité des coups : un coup n'est jamais « juste réussi ou
 * raté », il vaut plus ou moins selon la situation de jeu : la hauteur et la
 * vitesse de la balle qu'on reçoit, ce qui vient de se passer (un lob, un
 * amorti, un renvoi de vitre...), où l'on se trouve, le timing (la balle est-
 * elle bien au contact ?) et la charge. Cinq niveaux, du rouge (très médiocre)
 * au vert (parfait). Cette qualité règle la trajectoire (voir `coups.ts`) et
 * remplit plus ou moins vite la jauge du super coup.
 */
export type NiveauQualite = 1 | 2 | 3 | 4 | 5;

/** Ce que le moteur regarde au moment du coup. */
export interface Situation {
  /** hauteur de la balle reçue (m) */
  z: number;
  /** vitesse de la balle reçue (m/s) */
  vitesse: number;
  /** distance du joueur au filet (m) */
  loin: number;
  /** le coup qui vient d'être joué (par l'adversaire) */
  prev: Coup | null;
  /** la balle revient d'une vitre de notre côté */
  mur: boolean;
  /** 0 → 1 : 1 quand la balle est pile sur la raquette */
  precision: number;
  /** 0 → 1 : charge de l'appui */
  charge: number;
}

export function situationDe(b: Balle, s: Joueur, precision: number, charge: number): Situation {
  return {
    z: b.z,
    vitesse: Math.hypot(b.vx, b.vy, b.vz),
    loin: Math.abs(s.x - MIL),
    prev: b.coup,
    mur: b.mur,
    precision,
    charge,
  };
}

/** Aisance d'un coup selon la hauteur de la balle : [bas, mi-hauteur, haute, très haute]. */
const HAUTEURS: Record<Coup, [number, number, number, number]> = {
  smash: [0.05, 0.2, 0.55, 1],
  bandeja: [0.15, 0.35, 0.8, 0.95],
  vibora: [0.1, 0.3, 0.7, 0.85],
  plat: [0.7, 1, 0.55, 0.3],
  coupe: [1, 0.75, 0.4, 0.15],
  lobe: [0.9, 1, 0.6, 0.3],
  amorti: [1, 0.8, 0.4, 0.1],
  vitre: [0.6, 0.6, 0.4, 0.2],
  cote: [0.6, 0.6, 0.4, 0.2],
};

const classeHauteur = (z: number): 0 | 1 | 2 | 3 => (z < 0.6 ? 0 : z < 1.5 ? 1 : z < HAUT_SMASH ? 2 : 3);

/** Les coups qui demandent de la puissance : la charge compte pour eux, pas pour les coups de finesse. */
const COUPS_PUISSANTS: ReadonlySet<Coup> = new Set(['plat', 'smash', 'bandeja', 'vibora', 'coupe']);

/**
 * Ce que vaut ce coup dans cette situation, de 0 (absurde) à 1 (le coup
 * idéal) : hauteur, vitesse de la balle reçue, place sur le terrain et
 * réception de ce qui précède.
 */
export function affinite(type: Coup, sit: Situation): number {
  const facile = clamp(1 - (sit.vitesse - 8) / 20, 0.1, 1); // une balle lente est plus facile à jouer
  let a = HAUTEURS[type][classeHauteur(sit.z)] * (0.45 + 0.55 * facile);
  // où l'on se trouve
  if (type === 'smash' && sit.loin < 4) a += 0.12;
  else if (type === 'amorti') a += sit.loin < 5 ? 0.12 : -0.3;
  else if ((type === 'lobe' || type === 'bandeja') && sit.loin > 5) a += 0.1;
  else if (type === 'vibora' && sit.loin > 3 && sit.loin < 7) a += 0.08;
  // ce qui vient de se passer
  switch (sit.prev) {
    case 'amorti': // une balle courte, très basse : le smash n'a aucun sens, la finesse oui
      if (type === 'smash') a *= 0.3;
      else if (type === 'lobe' || type === 'amorti') a *= 1.1;
      break;
    case 'lobe': // une balle haute et lente : de quoi finir
      if (type === 'smash' || type === 'bandeja') a *= 1.15;
      break;
    case 'smash': // une balle rapide : on se défend, un lob la remet en jeu
      a *= type === 'lobe' ? 0.9 : 0.6;
      break;
    case 'vibora':
      if (type !== 'lobe') a *= 0.8;
      break;
    default:
      break;
  }
  // un lob est bien plus facile à réussir après une balle lente revenue de la vitre à mi-hauteur
  if (type === 'lobe' && sit.mur && sit.vitesse < 12 && sit.z > 0.6 && sit.z < 1.6) a += 0.25;
  if (type === 'lobe' && sit.vitesse > 22) a *= 0.6;
  return clamp(a, 0, 1);
}

export interface Qualite {
  /** 0 → 1 */
  score: number;
  niveau: NiveauQualite;
}

export function niveauDe(score: number): NiveauQualite {
  if (score < 0.2) return 1;
  if (score < 0.4) return 2;
  if (score < 0.6) return 3;
  if (score < 0.8) return 4;
  return 5;
}

/** La qualité d'un coup : l'aisance de la situation, tempérée par le timing et la charge. */
export function qualite(type: Coup, sit: Situation): Qualite {
  const a = affinite(type, sit);
  const charge = COUPS_PUISSANTS.has(type) ? sit.charge : 1;
  const score = clamp(a * (0.6 + 0.4 * sit.precision) * (0.75 + 0.25 * charge), 0, 1);
  return { score, niveau: niveauDe(score) };
}

/** Ce que chaque niveau de qualité (1 → 5) ajoute à la jauge du super coup : les plus beaux coups la remplissent vite. */
export const GAIN_JAUGE: readonly number[] = [0, 0.01, 0.02, 0.035, 0.06, 0.1];
/** Un renvoi de vitre bien joué vaut un petit bonus. */
export const GAIN_VITRE = 0.025;

/** La couleur du nom du coup selon sa qualité : rouge (très médiocre) → vert (parfait). */
export const COULEURS_QUALITE: readonly string[] = [
  '',
  '#ff3b3b',
  '#ff9a3c',
  '#ffd84a',
  '#9be64a',
  '#3dff8a',
];
