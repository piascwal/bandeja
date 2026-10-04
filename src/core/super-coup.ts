import { gravite, lance } from './balle';
import { MIL } from './constants';
import { equipe } from './joueurs';
import { autre, filetH, xProf } from './terrain';
import type { Balle, Coup, Effet, Joueur, Partie } from './types';

/**
 * Les super coups : jauge pleine, le bouton SMASH déclenche une frappe
 * monstrueuse, qui gagne forcément le point (la balle est imparable : aucun
 * adversaire ne peut la toucher, et le point est compté à son premier rebond).
 * Quatre variantes, choisies selon la situation, et toujours spectaculaires :
 * la balle traîne le feu, puis sort de la piste en cassant quelque chose.
 */
export type VarianteSuper = 1 | 2 | 3 | 4;

export const NOMS_SUPER = ['', 'METEORE !', 'COMETE !', 'PHENIX !', 'ECLAIR !'] as const;

/**
 * Laquelle selon la situation :
 * - MÉTÉORE, une balle haute : un smash de feu qui s'écrase puis repart dans l'espace ;
 * - ÉCLAIR, au filet : un tir en zigzag qui fait voler l'écran en éclats ;
 * - PHÉNIX, depuis le fond : un oiseau de feu qui défonce la vitre de côté ;
 * - COMÈTE, sinon : un boulet qui défonce la vitre du fond.
 */
export function varianteSuper(b: Balle, loin: number): VarianteSuper {
  if (b.z > 1.9) return 1;
  if (loin < 3.5) return 4;
  if (loin > 6) return 3;
  return 2;
}

/** Où viser : le côté le plus loin des adversaires. */
function coinLibre(jeu: Partie, eq: 0 | 1): number {
  const adv = equipe(jeu, autre(eq));
  let meilleur = 5;
  let loin = -1;
  for (const c of [1.5, 3, 7, 8.5]) {
    const d = Math.min(...adv.map((o) => Math.abs(o.y - c))) + jeu.rng() * 0.8;
    if (d > loin) {
      loin = d;
      meilleur = c;
    }
  }
  return meilleur;
}

/**
 * Lance la balle le plus vite possible vers (tx, ty) : d'abord comme un coup ordinaire
 * (qui doit passer le filet), puis on raccourcit le temps de vol autant que le filet le
 * permet : la balle arrive au même endroit, bien plus vite et plus à plat.
 */
function lanceVite(b: Balle, tx: number, ty: number, v: number, spin: Effet, marge: number): void {
  lance(b, tx, ty, v, spin, marge);
  const dx = tx - b.x;
  const dy = ty - b.y;
  const T = dx / b.vx;
  const g = gravite(spin);
  for (const k of [2, 1.75, 1.5, 1.3, 1.15]) {
    const T2 = T / k;
    const vx = dx / T2;
    const vz = (-b.z + 0.5 * g * T2 * T2) / T2;
    const tn = (MIL - b.x) / vx;
    const yn = b.y + (dy / T2) * tn;
    if (b.z + vz * tn - 0.5 * g * tn * tn >= filetH(yn) + 0.15) {
      b.vx = vx;
      b.vy = dy / T2;
      b.vz = vz;
      return;
    }
  }
}

/** Lance la balle en super coup ; renvoie le coup (nom affiché). La balle est ensuite imparable. */
export function lanceSuper(jeu: Partie, s: Joueur, variante: VarianteSuper): Coup {
  const b = jeu.balle;
  const eq = s.eq;
  const ty = coinLibre(jeu, eq);
  switch (variante) {
    case 1: {
      lanceVite(b, xProf(autre(eq), 3.5 + jeu.rng() * 1.5), ty, 48, 'smash', 0.15);
      return 'smash';
    }
    case 2: {
      lanceVite(b, xProf(autre(eq), 2.2), ty, 46, 'plat', 0.12);
      return 'plat';
    }
    case 3: {
      // vers le coin le plus proche d'une vitre de côté
      lanceVite(b, xProf(autre(eq), 3), ty < 5 ? 1.6 : 8.4, 46, 'plat', 0.12);
      return 'plat';
    }
    default: {
      lanceVite(b, xProf(autre(eq), 3), ty, 50, 'smash', 0.12);
      return 'smash';
    }
  }
}
