import type { Bouton } from '@core/types';

/**
 * Le geste tactile : on tient ARMER, puis le même doigt trace un trait, qui choisit le coup.
 * Pas de trait (moins de `SEUIL_TRAIT` px) : FRAPPE ; un tout petit trait : AMORTI ; un trait
 * vers le haut : LOBE ; un trait normal dans une autre direction : frappe LOURDE.
 */
export const SEUIL_TRAIT = 6;
export const SEUIL_LONG = 26;

export type TypeGeste = Extract<Bouton, 'plat' | 'amorti' | 'lobe' | 'lourd'>;

/** Le coup que dessine un trait de (dx, dy) pixels depuis l'endroit où le doigt a touché ARMER (y vers le bas). */
export function classeGeste(dx: number, dy: number): TypeGeste {
  const l = Math.hypot(dx, dy);
  if (l < SEUIL_TRAIT) return 'plat';
  if (l < SEUIL_LONG) return 'amorti';
  // vers le haut : à moins de 45° de la verticale
  return dy < 0 && Math.abs(dx) < -dy ? 'lobe' : 'lourd';
}

export const NOMS_GESTE: Record<TypeGeste, string> = {
  plat: 'FRAPPE',
  amorti: 'AMORTI',
  lobe: 'LOB',
  lourd: 'FORT',
};
