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

export type ToucheEcran = Bouton | 'sprint';

/**
 * Les coups en losange : frappe en bas, coupé à gauche, lobe à droite,
 * amorti en haut. Au centre, le bouton aérien (bandeja / víbora), allumé
 * quand la balle est haute. COURIR en bas à gauche du losange.
 */
export function zonesBoutons(W: number, H: number): Record<ToucheEcran, Rond> {
  const cx = W - 58;
  const cy = H - 56;
  const d = 36;
  const r = 16;
  return {
    plat: { x: cx, y: cy + d, r },
    coupe: { x: cx - d, y: cy, r },
    lobe: { x: cx + d, y: cy, r },
    amorti: { x: cx, y: cy - d, r },
    aerien: { x: cx, y: cy, r },
    sprint: { x: cx - d - 8, y: cy + d - 4, r: 13 },
  };
}

export const zonePause = (W: number) => ({ x: W - 22, y: 4, w: 16, h: 14 });

/** Le bouton le plus proche de l'appui : pas besoin de viser juste. */
export function boutonProche(
  W: number,
  H: number,
  x: number,
  y: number,
  aerienActif: boolean,
): ToucheEcran | null {
  const z = zonesBoutons(W, H);
  let best: ToucheEcran | null = null;
  let dmin = Infinity;
  for (const k of Object.keys(z) as ToucheEcran[]) {
    if (k === 'aerien' && !aerienActif) continue; // le centre ne sert qu'aux balles hautes
    const d = Math.hypot(x - z[k].x, y - z[k].y) - z[k].r;
    if (d < dmin) {
      dmin = d;
      best = k;
    }
  }
  return best && dmin < 30 ? best : null;
}
