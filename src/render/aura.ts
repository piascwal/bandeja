import type { Joueur, Partie } from '@core/types';
import { C } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/** Un anneau au sol qui grandit pendant la charge d'un coup. */
function anneauCharge(v: Vue, jeu: Partie, s: Joueur): void {
  if (!s.intent || s.charge < 0.4) return;
  const { g } = v;
  const [sx, sy] = v.K.proj(s.x, s.y, 0);
  const n = 18;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + jeu.temps * 2;
    const r = 6 + 6 * s.charge;
    g.globalAlpha = 0.5;
    px(g, sx + Math.cos(a) * r * 1.4, sy + Math.sin(a) * r * 0.45, 1, 1, C.blanc);
  }
  g.globalAlpha = 1;
}

/**
 * Jauge du super coup pleine : toute l'équipe est entourée de flammes dorées
 * qui montent et d'un anneau qui tourne au sol : l'adversaire voit qu'un coup
 * énorme se prépare.
 */
function auraSuper(v: Vue, jeu: Partie, s: Joueur): void {
  if (jeu.jaugeSmash[s.eq] < 1) return;
  const { g } = v;
  const [sx, sy] = v.K.proj(s.x, s.y, 0);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2 + jeu.temps * 6;
    g.globalAlpha = 0.95;
    px(g, sx + Math.cos(a) * 12, sy + Math.sin(a) * 4, 2, 1, k % 2 ? C.or : '#ffffff');
  }
  for (let k = 0; k < 14; k++) {
    const t = (jeu.temps * 3 + k * 0.29) % 1;
    const dx = Math.sin(k * 7.3) * 8;
    g.globalAlpha = 1 - t;
    px(g, sx + dx, sy - t * 26, 2, 3, k % 3 === 0 ? '#ffffff' : k % 3 === 1 ? C.or : '#ff7a3c');
  }
  g.globalAlpha = 1;
}

/** Les auras d'un joueur, dessinées derrière lui. */
export function auraJoueur(v: Vue, jeu: Partie, s: Joueur): void {
  anneauCharge(v, jeu, s);
  auraSuper(v, jeu, s);
}
