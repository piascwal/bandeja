import { lance } from './balle';
import { equipe } from './joueurs';
import { autre, xProf } from './terrain';
import type { Balle, Coup, Joueur, Partie } from './types';

/**
 * Les super coups : jauge pleine, le bouton SMASH déclenche une frappe
 * monstrueuse, qui gagne forcément le point (la balle est imparable : aucun
 * adversaire ne peut la toucher, et le point est compté à son premier rebond).
 * Quatre variantes, choisies selon la situation, pour que le joueur ait envie
 * de toutes les découvrir.
 */
export type VarianteSuper = 1 | 2 | 3 | 4;

export const NOMS_SUPER = ['', 'METEORE !', 'COMETE !', 'PHENIX !', 'FANTOME !'] as const;

/**
 * Laquelle selon la situation : une balle haute, c'est la MÉTÉORE (un smash de
 * feu) ; une balle basse et lente au filet, le FANTÔME (un amorti qui meurt) ;
 * une balle lente depuis le fond, le PHÉNIX (un lob qui monte très haut et
 * retombe comme une pierre) ; sinon la COMÈTE (un boulet à plat).
 */
export function varianteSuper(b: Balle, loin: number): VarianteSuper {
  const vitesse = Math.hypot(b.vx, b.vy, b.vz);
  if (b.z > 1.9) return 1;
  if (loin < 3.5 && vitesse < 14) return 4;
  if (loin > 6 && vitesse < 16) return 3;
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

/** Lance la balle en super coup ; renvoie le coup (nom affiché). La balle est ensuite imparable. */
export function lanceSuper(jeu: Partie, s: Joueur, variante: VarianteSuper): Coup {
  const b = jeu.balle;
  const eq = s.eq;
  const ty = coinLibre(jeu, eq);
  const dist = (tx: number, y: number) => Math.hypot(tx - b.x, y - b.y);
  switch (variante) {
    case 1: {
      const tx = xProf(autre(eq), 3.2 + jeu.rng() * 1.6);
      lance(b, tx, ty, 44, 'smash', 0.15);
      return 'smash';
    }
    case 2: {
      const tx = xProf(autre(eq), 1.8);
      lance(b, tx, ty, 40, 'plat', 0.12);
      return 'plat';
    }
    case 3: {
      const tx = xProf(autre(eq), 1.6);
      const y = 3.5 + jeu.rng() * 3;
      lance(b, tx, y, dist(tx, y) / 2.4, 'lobe', 3.5);
      return 'lobe';
    }
    default: {
      const tx = xProf(autre(eq), 9.3);
      lance(b, tx, ty, 6.5, 'coupe', 0.05);
      return 'amorti';
    }
  }
}
