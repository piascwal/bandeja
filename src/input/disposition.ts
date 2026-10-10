import { changePossible } from '@core/humain';
import type { Bouton, Partie } from '@core/types';

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

/** Ce qui change la disposition des boutons : CHANGE n'existe qu'à un seul humain, et le service n'a que deux boutons. */
export interface OptionsBoutons {
  change: boolean;
  service: boolean;
}

/** La disposition qui convient à cette partie, pour cet écran. */
export const optionsBoutons = (jeu: Partie): OptionsBoutons => ({
  change: changePossible(jeu),
  service: jeu.phase === 'service' && !!jeu.humain && jeu.serveur === jeu.humain,
});

/**
 * Les boutons, dans le coin en bas à droite. ARMER (le bouton `plat`, plus gros) est dans le coin : on
 * le tient et on trace un trait pour choisir le coup (voir `geste.ts`). CHANGE est à sa gauche (seul
 * humain face au CPU), SUPER au-dessus (jauge pleine). Sans CHANGE (deux humains), il n'y a rien à
 * sa place. Au service il ne reste que PLAT (dans le coin) et COUPE (au-dessus).
 */
export function zonesBoutons(W: number, H: number, o: OptionsBoutons): Partial<Record<ToucheEcran, Rond>> {
  const droite = W - 34;
  const bas = H - 34;
  const z: Partial<Record<ToucheEcran, Rond>> = { plat: { x: droite, y: bas, r: o.service ? 13 : 19 } };
  if (o.service) {
    z.amorti = { x: droite, y: bas - 30, r: 13 };
    return z;
  }
  if (o.change) z.change = { x: droite - 40, y: bas + 2, r: 13 };
  z.smash = { x: droite, y: bas - 40, r: 13 };
  return z;
}

export const zonePause = (W: number) => ({ x: W - 22, y: 4, w: 16, h: 14 });

/** Le bouton le plus proche de l'appui : pas besoin de viser juste. */
export function boutonProche(
  W: number,
  H: number,
  x: number,
  y: number,
  o: OptionsBoutons,
): ToucheEcran | null {
  const z = zonesBoutons(W, H, o);
  let best: ToucheEcran | null = null;
  let dmin = Infinity;
  for (const k of Object.keys(z) as ToucheEcran[]) {
    const rond = z[k]!;
    const d = Math.hypot(x - rond.x, y - rond.y) - rond.r;
    if (d < dmin) {
      dmin = d;
      best = k;
    }
  }
  return best && dmin < 30 ? best : null;
}
