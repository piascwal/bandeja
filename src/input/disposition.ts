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

/** Ce qui change la disposition des boutons : CHANGE n'existe qu'à un seul humain, SUPER que jauge pleine, et le service n'a que deux boutons. */
export interface OptionsBoutons {
  change: boolean;
  service: boolean;
  /** la jauge du super coup est pleine : le bouton SUPER existe */
  super: boolean;
}

/** La disposition qui convient à cette partie, pour cet écran. */
export const optionsBoutons = (jeu: Partie): OptionsBoutons => {
  const s = jeu.humain;
  const service = jeu.phase === 'service' && !!s && jeu.serveur === s;
  return { change: changePossible(jeu), service, super: !!s && !service && jeu.jaugeSmash[s.eq] >= 1 };
};

/**
 * Les boutons, dans le coin en bas à droite. Il n'y a plus de bouton pour armer ni pour choisir le
 * coup : un doigt posé sur la piste arme, le trait qu'il trace choisit (voir `geste.ts`). Restent
 * CHANGE dans le coin (seul humain face au CPU), et SUPER au-dessus (jauge pleine). Au service :
 * PLAT dans le coin et COUPE au-dessus.
 */
export function zonesBoutons(W: number, H: number, o: OptionsBoutons): Partial<Record<ToucheEcran, Rond>> {
  const x = W - 34;
  const bas = H - 34;
  const r = 13;
  if (o.service) return { plat: { x, y: bas, r }, amorti: { x, y: bas - 30, r } };
  const z: Partial<Record<ToucheEcran, Rond>> = {};
  if (o.change) z.change = { x, y: bas, r };
  if (o.super) z.smash = { x, y: bas - (o.change ? 36 : 0), r };
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
  // sur la piste, un doigt qui se pose trace un trait : il faut viser juste les boutons (grande tolérance au service seulement)
  return best && dmin < (o.service ? 30 : 8) ? best : null;
}
