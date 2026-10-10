import type { Aleatoire } from './aleatoire';
import { gravite, lance } from './balle';
import { MIL, PARADE_DUREE_MAX, PERIODE_PARADE, ZONE_PARADE } from './constants';
import { equipe } from './joueurs';
import { autre, filetH, xProf } from './terrain';
import type { Balle, Coup, Effet, Equipe, Joueur, Partie } from './types';

/**
 * Les super coups : jauge pleine, le bouton SMASH déclenche une frappe
 * monstrueuse, qui gagne forcément le point (la balle est imparable : aucun
 * adversaire ne peut la toucher, et le point est compté à son premier rebond).
 * Trois animations, tirées au hasard à chances égales :
 * - MÉTÉORE : un smash de feu qui s'écrase puis repart dans l'espace et finit sur la lune ;
 * - VOLCAN : il perfore le court (pas de rebond), traverse la Terre par son centre et ressort de
 *   l'autre côté en geyser de lave ;
 * - ORBITE : la balle rebondit en orbite et fait exploser un satellite (petit ralenti).
 */
export type VarianteSuper = 1 | 2 | 3;

export const NOMS_SUPER = ['', 'METEORE !', 'VOLCAN !', 'ORBITE !'] as const;

/** Les trois animations du super coup : l'impact sur la lune (météore), le volcan, le satellite (orbite). */
export const VARIANTES_SUPER: readonly VarianteSuper[] = [1, 2, 3];

export function varianteSuper(b: Balle, loin: number, rng?: Aleatoire): VarianteSuper {
  if (!rng) return loin < 3.5 ? 2 : loin > 6 ? 3 : 1;
  // dans le jeu, le choix est au hasard : chacune des trois animations a la même chance, quelle que soit la situation
  return VARIANTES_SUPER[Math.floor(rng() * VARIANTES_SUPER.length)]!;
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
    case 2: {
      // un smash qui plonge : il perfore le sol sans rebondir
      lanceVite(b, xProf(autre(eq), 3.5), ty, 50, 'plat', 0.12);
      return 'plat';
    }
    case 3: {
      lanceVite(b, xProf(autre(eq), 4 + jeu.rng()), ty, 48, 'smash', 0.15);
      return 'smash';
    }
    default: {
      lanceVite(b, xProf(autre(eq), 3.5 + jeu.rng() * 1.5), ty, 48, 'smash', 0.15);
      return 'smash';
    }
  }
}

/** Position du curseur de parade (0 → 1 → 0...) à la phase t. */
export const curseurParade = (t: number): number => 1 - Math.abs(((t / PERIODE_PARADE) % 2) - 1);

/** Le curseur est-il dans la zone verte ? */
export const dansZoneParade = (valeur: number): boolean =>
  valeur >= ZONE_PARADE.min && valeur <= ZONE_PARADE.max;

/**
 * Un super coup vient de partir : le jeu se fige et le camp adverse doit arrêter le
 * curseur dans le vert. S'il n'a aucun humain, le CPU l'arrête tout seul, au hasard.
 */
export function ouvreParade(jeu: Partie, defenseur: Equipe): void {
  const humains = jeu.humains.some((h) => h.eq === defenseur);
  jeu.parade = {
    eq: defenseur,
    t: jeu.rng() * PERIODE_PARADE * 2,
    ecoule: 0,
    tCpu: humains ? null : 0.5 + jeu.rng() * 1.2,
  };
}

/** Fin de la parade : réussie, le super coup est arrêté (la balle revient comme un gros coup ordinaire) ; ratée, il file. */
function resoudParade(jeu: Partie, ok: boolean): void {
  const p = jeu.parade;
  if (!p) return;
  jeu.parade = null;
  jeu.evenements.push({ type: 'parade', ok });
  if (!ok) return;
  const b = jeu.balle;
  b.super = 0;
  b.vif = 0;
  // un gros coup, mais jouable : on ramène sa vitesse à celle d'un smash ordinaire
  const v = Math.hypot(b.vx, b.vy, b.vz);
  const k = Math.min(1, 24 / Math.max(1, v));
  b.vx *= k;
  b.vy *= k;
  b.vz *= k;
  // parer un super coup remplit un peu la jauge de celui qui le subit
  jeu.jaugeSmash[p.eq] = Math.min(1, jeu.jaugeSmash[p.eq] + 0.2);
}

/** Un humain du camp qui subit arrête le curseur : réussi s'il est dans le vert. */
export function arreteParade(jeu: Partie): void {
  const p = jeu.parade;
  if (p) resoudParade(jeu, dansZoneParade(curseurParade(p.t)));
}

/** Fait avancer le curseur ; le CPU l'arrête (au hasard, plus souvent à haut niveau), faute de quoi il finit par expirer. */
export function avanceParade(jeu: Partie, dt: number): void {
  const p = jeu.parade;
  if (!p) return;
  p.t += dt;
  p.ecoule += dt;
  if (p.tCpu !== null && p.ecoule >= p.tCpu) resoudParade(jeu, jeu.rng() < 0.15 + 0.3 * jeu.niv.agress);
  else if (p.ecoule >= PARADE_DUREE_MAX) resoudParade(jeu, false);
}
