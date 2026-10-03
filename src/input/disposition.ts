import type { Bouton } from '@core/types';

/**
 * Disposition des commandes tactiles, en pixels logiques : partagée par la
 * lecture des appuis (input) et leur dessin (render).
 */

export const RAYON_JOY = 22;
/** Le joystick occupe la partie gauche de l'écran. */
export const PART_JOYSTICK = 0.45;

export interface Rond {
  x: number;
  y: number;
  r: number;
}

export type ToucheEcran = Bouton;

/**
 * Les coups en losange, petits pour ne pas cacher la piste : FRAPPE en bas,
 * AMORTI à gauche, LOBE à droite, SMASH en haut (il choisit seul entre
 * smash, víbora et bandeja).
 */
export function zonesBoutons(W: number, H: number): Record<ToucheEcran, Rond> {
  const cx = W - 48;
  const cy = H - 46;
  const d = 27;
  const r = 13;
  return {
    plat: { x: cx, y: cy + d, r },
    amorti: { x: cx - d, y: cy, r },
    lobe: { x: cx + d, y: cy, r },
    smash: { x: cx, y: cy - d, r },
  };
}

export const zonePause = (W: number) => ({ x: W - 22, y: 4, w: 16, h: 14 });

/** Le bouton le plus proche de l'appui : pas besoin de viser juste. */
export function boutonProche(W: number, H: number, x: number, y: number): ToucheEcran | null {
  const z = zonesBoutons(W, H);
  let best: ToucheEcran | null = null;
  let dmin = Infinity;
  for (const k of Object.keys(z) as ToucheEcran[]) {
    const d = Math.hypot(x - z[k].x, y - z[k].y) - z[k].r;
    if (d < dmin) {
      dmin = d;
      best = k;
    }
  }
  return best && dmin < 30 ? best : null;
}
