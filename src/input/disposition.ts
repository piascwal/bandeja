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
 * Les boutons dans le coin en bas à droite, sur deux colonnes. FRAPPE est dans le coin, CHANGE à sa
 * gauche (seul humain face au CPU), LOBE au-dessus de FRAPPE, AMORTI au-dessus de CHANGE, et SUPER
 * (le SMASH choisit seul entre smash, víbora et bandeja) tout en haut, au-dessus de LOBE. Sans CHANGE
 * (deux humains), AMORTI descend prendre sa place à gauche de FRAPPE. Au service il ne reste que
 * PLAT (dans le coin) et COUPE (au-dessus), CHANGE restant à gauche.
 */
export function zonesBoutons(W: number, H: number, o: OptionsBoutons): Partial<Record<ToucheEcran, Rond>> {
  const r = 13;
  const d = 28;
  const droite = W - 30;
  const gauche = droite - d;
  const bas = H - 32;
  const case_ = (x: number, rang: number): Rond => ({ x, y: bas - rang * d, r });
  const z: Partial<Record<ToucheEcran, Rond>> = { plat: case_(droite, 0) };
  if (o.change) z.change = case_(gauche, 0);
  if (o.service) {
    z.amorti = case_(droite, 1);
    return z;
  }
  z.lobe = case_(droite, 1);
  z.amorti = o.change ? case_(gauche, 1) : case_(gauche, 0);
  z.smash = case_(droite, 2);
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
