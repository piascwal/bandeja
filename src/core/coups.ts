import { gauss } from './aleatoire';
import { lance } from './balle';
import { HAUT_MAX, HAUT_SMASH, MIL, PORTEE } from './constants';
import { contreVitre } from './contre-vitre';
import { autre, xProf } from './terrain';
import type { Coup, Effet, Joueur, Mur, Partie } from './types';

/** Distance visée par rapport à la vitre adverse, selon le coup. */
export const PROF: Partial<Record<Coup, number>> = {
  plat: 2.8,
  coupe: 2.4,
  lobe: 2.0,
  smash: 5.5,
  bandeja: 2.5,
  vibora: 2.1,
  amorti: 8.4,
};

/** Le joueur peut-il frapper la balle maintenant ? (mul agrandit la portée) */
export function frappable(jeu: Partie, s: Joueur, mul = 1): boolean {
  const b = jeu.balle;
  if (jeu.phase !== 'jeu' || b.dehors || b.roule) return false;
  if (b.camp !== s.eq || b.sol >= 2 || s.cd > 0) return false;
  if (b.service && b.sol === 0) return false; // le service doit rebondir
  if (b.x < MIL !== (s.eq === 0)) return false;
  if (b.z > HAUT_MAX) return false;
  return Math.hypot(b.x - s.x, b.y - s.y) <= PORTEE * mul;
}

/** Vitesse, effet et marge au-dessus du filet d'un coup direct. */
function trajectoire(type: Coup, p: number, dist: number): { v: number; spin: Effet; marge: number } {
  switch (type) {
    case 'plat':
      return { v: 13 + 11 * p, spin: p > 0.75 ? 'lift' : 'plat', marge: 0.15 };
    case 'coupe':
      return { v: 12 + 7 * p, spin: 'coupe', marge: 0.15 };
    case 'lobe':
      return { v: dist / (1.45 + 0.3 * p + dist / 40), spin: 'lobe', marge: 0.6 };
    case 'amorti':
      return { v: 6.5 + 3 * p, spin: 'coupe', marge: 0.1 };
    case 'smash':
      return { v: 19 + 13 * p, spin: 'smash', marge: 0.15 };
    case 'bandeja':
      return { v: 12 + 5 * p, spin: 'coupe', marge: 0.15 };
    default:
      return { v: 15 + 7 * p, spin: 'vibora', marge: 0.15 };
  }
}

/**
 * Rebond vif d'un coup fort ou coupé (voir `Balle.vif`) : plus on charge, plus
 * la balle bondit, file à la vitre et en revient en hauteur ; à fond, elle
 * peut même sortir de la piste. Le coupé bondit à peine, juste de quoi ne pas
 * mourir au fond du court.
 */
function rebondVif(type: Coup, p: number, hasard: number): number {
  if (type === 'plat') {
    if (p < 0.5) return 0;
    const k = (p - 0.5) / 0.5;
    return p >= 0.92 && hasard < 0.35 ? 1.25 : k;
  }
  if (type === 'coupe') return 0.3;
  if (type === 'bandeja') return 0.35;
  return 0;
}

/**
 * Frappe la balle : type de coup, puissance p (0 → 1), point visé (tx, ty) et,
 * éventuellement, un rebond voulu contre sa propre vitre.
 */
export function executeCoup(
  jeu: Partie,
  s: Joueur,
  type: Coup,
  p: number,
  tx: number,
  ty: number,
  mur?: Mur | null,
  /** réglages d'un coup d'humain : `precision` (0 → 1) selon le timing, `risque` pour un coup forcé */
  humain?: { precision: number; risque: boolean },
): void {
  const b = jeu.balle;
  const eq = s.eq;
  const rng = jeu.rng;
  const vin = Math.hypot(b.vx, b.vy, b.vz);
  const haut = b.z > HAUT_SMASH;
  // rebond voulu contre sa propre vitre (du fond ou de côté) : sinon coup direct
  if (mur) {
    if (contreVitre(b, eq, ty, mur, rng)) type = mur === 'fond' ? 'vitre' : 'cote';
    else if (type === 'vitre') {
      type = 'lobe';
      tx = xProf(autre(eq), PROF.lobe!);
    }
  }
  if (type !== 'vitre' && type !== 'cote') {
    let e = s.err * (0.45 + 0.8 * p + vin / 34 + (b.mur ? 0.3 : 0));
    // arcade : un bon timing rend le coup net, un coup forcé reste risqué
    if (humain) e *= 1.2 - 0.6 * humain.precision + (humain.risque ? 0.35 : 0);
    if (type === 'bandeja' || type === 'lobe') e *= 0.7;
    if (type === 'amorti') e *= 0.45; // court et lent : l'erreur se joue sur le filet
    tx += gauss(rng) * e * 1.4;
    ty += gauss(rng) * e * 1.15;
    const t = trajectoire(type, p, Math.hypot(tx - b.x, ty - b.y));
    // quelques fautes directes dans le filet, surtout en forçant
    const risque = type === 'plat' || type === 'smash' ? 0.01 + 0.05 * p * e : 0.006 * e;
    const marge = rng() < risque ? -0.3 : t.marge;
    lance(b, tx, ty, t.v, t.spin, marge);
    b.spinDir = ty < 5 ? -1 : 1;
    b.portres = type === 'smash' && p >= 0.8 && b.z > 2.2;
    b.vif = rebondVif(type, p, rng());
  } else b.vif = 0;
  b.eqF = eq;
  b.camp = autre(eq);
  b.sol = 0;
  b.service = false;
  b.filet = false;
  b.mur = false;
  b.coup = type;
  b.trace.length = 0;
  s.poseCoup = haut ? 'smash2' : 'attente';
  // le joueur se tourne vers là où part la balle (y compris vers sa vitre)
  if (type === 'vitre' || type === 'cote') {
    s.faceCoup = b.vx >= 0 ? 1 : -1;
    s.tourne = 0.45;
  }
  s.swing = 1;
  s.haut = haut;
  s.cd = 0.35;
  s.intent = null;
  s.charge = 0;
  jeu.tFrappe = 0;
  jeu.plan = [null, null];
  jeu.pred = null;
  jeu.tPred = 0;
  replaceEquipe(jeu, s, type, p);
  jeu.evenements.push({
    type: 'frappe',
    coup: type,
    puissance: p,
    portres: b.portres,
    humain: s.humain,
    x: s.x,
    y: s.y,
  });
}

/** Positionnement des deux équipes (au filet ou au fond) après le coup. */
function replaceEquipe(jeu: Partie, s: Joueur, type: Coup, p: number): void {
  const eq = s.eq;
  const camp = autre(eq);
  if (type === 'lobe' || type === 'vitre' || type === 'cote') {
    jeu.posture[eq] = 'filet';
    jeu.posture[camp] = 'fond';
  } else if (type === 'smash' || type === 'bandeja' || type === 'vibora') {
    jeu.posture[eq] = 'filet';
    if (type === 'smash') jeu.posture[camp] = 'fond';
  } else if (Math.abs(s.x - MIL) < 5) jeu.posture[eq] = 'filet';
  else jeu.posture[eq] = p > 0.7 && jeu.rng() < 0.5 ? 'filet' : 'fond';
}
