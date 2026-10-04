import { alea, clamp } from './aleatoire';
import { HAUT_SMASH, LARG, MIL } from './constants';
import { contrainte, executeCoup, frappable, PROF } from './coups';
import { equipe } from './joueurs';
import { varianteSuper } from './super-coup';
import { autre, dir, fond, xProf } from './terrain';
import type { Coup, Joueur, Mur, Partie, Point2 } from './types';

/** Place de repli du joueur : au filet ou au fond selon la posture de l'équipe. */
export function formation(jeu: Partie, s: Joueur): Point2 {
  const prof = jeu.posture[s.eq] === 'filet' ? 7.1 : 1.9;
  return { x: xProf(s.eq, prof), y: clamp(s.home + (jeu.balle.y - 5) * 0.3, 0.8, LARG - 0.8) };
}

interface ChoixCoup {
  type: Coup;
  p: number;
  tx: number;
  ty: number;
  mur: Mur | null;
}

/** Le coup que joue l'ordinateur, selon la hauteur de balle, sa place et celle des adversaires. */
export function choixIA(jeu: Partie, s: Joueur): ChoixCoup {
  const b = jeu.balle;
  const eq = s.eq;
  const niv = s.niv;
  const rng = jeu.rng;
  const adv = equipe(jeu, autre(eq));
  const auFilet = adv.filter((o) => Math.abs(o.x - MIL) < 4.5).length;
  const loin = Math.abs(s.x - MIL);
  const recul = Math.abs(s.x - fond(eq));
  let type: Coup;
  let p: number;
  if (b.z > HAUT_SMASH) {
    if (loin < 5.5 && b.z > 2.3 && !contrainte(b, s) && rng() < 0.3 + niv.agress * 0.5) {
      type = 'smash';
      p = alea(rng, 0.5, 0.75) + niv.agress * 0.3 * rng();
    } else {
      type = rng() < 0.6 ? 'bandeja' : 'vibora';
      p = alea(rng, 0.3, 0.8);
    }
  } else if (recul < 0.9 && b.z < 0.9 && rng() < 0.35) {
    type = 'vitre';
    p = 0.5;
  } else if (recul < 2.5 && Math.min(s.y, LARG - s.y) < 1.2 && b.z < 1.2 && rng() < 0.3) {
    type = 'cote';
    p = 0.5;
  } else if (auFilet >= 1 && loin > 5 && rng() < 0.45) {
    type = 'lobe';
    p = alea(rng, 0.2, 0.7);
  } else if (auFilet === 0 && loin < 4.5 && b.z > 0.5 && rng() < 0.25) {
    type = 'amorti';
    p = alea(rng, 0.1, 0.4);
  } else if (rng() < 0.35) {
    type = 'coupe';
    p = alea(rng, 0.2, 0.7);
  } else {
    type = 'plat';
    p = alea(rng, 0.2, 0.6) + niv.agress * 0.35 * rng();
  }
  p = clamp(p, 0, 1);
  // viser le trou : loin du joueur adverse le plus proche
  let ty = 5;
  let meilleur = -1;
  for (const c of [0.9, 2.8, 5, 7.2, 9.1]) {
    const sc = Math.min(...adv.map((o) => Math.abs(o.y - c))) + rng() * 1.2;
    if (sc > meilleur) {
      meilleur = sc;
      ty = c;
    }
  }
  if (type === 'vibora') ty = ty < 5 ? 1.2 : 8.8;
  const m = (PROF[type] ?? 3) + alea(rng, -0.6, 0.6);
  const mur: Mur | null = type === 'vitre' ? 'fond' : type === 'cote' ? (s.y < 5 ? 'haut' : 'bas') : null;
  if (type === 'cote') type = 'plat';
  return { type, p, tx: xProf(autre(eq), m), ty, mur };
}

/** Déplacement et frappe d'un joueur de l'ordinateur (y compris votre partenaire). */
export function pilotageIA(jeu: Partie, s: Joueur): void {
  const b = jeu.balle;
  if (jeu.phase === 'service') {
    s.cible = s.posServ;
    return;
  }
  if (jeu.phase !== 'jeu') {
    s.cible = formation(jeu, s);
    return;
  }
  const plan = jeu.plan[s.eq];
  if (b.camp === s.eq && plan && plan.s === s) {
    if (jeu.tFrappe < s.niv.reac) return;
    s.cible = { x: plan.x - dir(s.eq) * 0.3, y: plan.y };
    const urgence = b.sol === 1 && b.z < 0.35 && b.vz < 0;
    if (frappable(jeu, s) && (b.sol >= plan.sol || urgence)) {
      const c = choixIA(jeu, s);
      // jauge pleine : le CPU lâche parfois son super coup
      const sv = jeu.jaugeSmash[s.eq] >= 1 && jeu.rng() < 0.12 ? varianteSuper(b, Math.abs(s.x - MIL)) : 0;
      executeCoup(jeu, s, c.type, c.p, c.tx, c.ty, c.mur, sv ? { super: sv } : undefined);
    }
  } else if (jeu.tFrappe > s.niv.reac * 0.5) s.cible = formation(jeu, s);
}
