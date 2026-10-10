import { physique, type SurContact } from './balle';
import { BONUS_HUMAIN, HAUT_MAX, HAUT_SMASH, LARG, LONG, MIL, PORTEE, VMAX } from './constants';
import { equipe } from './joueurs';
import { autre } from './terrain';
import type { Balle, Equipe, Joueur, Partie, Plan, PointPredit, Prediction } from './types';

/** Simule la suite de la trajectoire pour savoir où et quand la balle sera jouable par eq. */
export function predit(b0: Balle, eq: Equipe): Prediction {
  const b = {
    x: b0.x,
    y: b0.y,
    z: b0.z,
    vx: b0.vx,
    vy: b0.vy,
    vz: b0.vz,
    spin: b0.spin,
    spinDir: b0.spinDir,
    roule: b0.roule,
    dehors: b0.dehors,
    portres: b0.portres,
    por: b0.por,
    vif: b0.vif,
    super: b0.super,
    rebonds: b0.rebonds,
  };
  let sol = b0.sol;
  let fin = false;
  let faute = false;
  let vitre = false;
  let rebond: { x: number; y: number } | null = null;
  const ev: SurContact = (t, cote) => {
    if (t === 'sol') {
      if (cote === eq) {
        sol++;
        if (sol === 1 && !rebond) rebond = { x: b.x, y: b.y };
        if (sol >= 2) fin = true;
      } else {
        if (sol === 0) faute = true;
        fin = true;
      }
    } else if ((t === 'vitre' || t === 'grille') && cote === eq && sol === 0) {
      faute = true;
      fin = true;
    } else if (t === 'vitre' || t === 'grille') vitre = true;
    else if (t === 'sortie') {
      if (sol === 0) faute = true;
      fin = true;
    }
  };
  const pts: PointPredit[] = [];
  const dt = 1 / 60;
  for (let i = 1; i <= 220; i++) {
    physique(b, dt / 2, ev);
    if (!fin) physique(b, dt / 2, ev);
    if (fin) break;
    const cote = eq === 0 ? b.x > 0.15 && b.x < MIL - 0.3 : b.x > MIL + 0.3 && b.x < LONG - 0.15;
    const ok =
      cote && b.y > 0.2 && b.y < LARG - 0.2 && b.z >= 0.1 && b.z <= HAUT_MAX && !(b0.service && sol === 0);
    pts.push({ t: i * dt, x: b.x, y: b.y, z: b.z, sol, ok, vitre });
  }
  return { pts, faute, rebond, eq };
}

/** Le meilleur point de frappe atteignable par s ; à défaut, celui qu'il rate de moins. */
export function meilleurPoint(
  jeu: Partie,
  s: Joueur,
  P: Prediction,
): (PointPredit & { score: number }) | null {
  const reac = s.humain ? 0.05 : s.niv.reac;
  const v = VMAX * (s.humain ? BONUS_HUMAIN : s.niv.vit);
  const attente = Math.max(0, reac - jeu.tFrappe);
  let best: (PointPredit & { score: number }) | null = null;
  let secours: (PointPredit & { score: number; marge: number }) | null = null;
  for (const q of P.pts) {
    if (!q.ok) continue;
    const dist = Math.max(0, Math.hypot(q.x - s.x, q.y - s.y) - PORTEE * 0.75);
    const marge = q.t - (dist / v + attente);
    const loin = Math.abs(q.x - MIL);
    let sc = q.t * 0.25;
    if (q.z < 0.3) sc += 0.8;
    if (q.sol === 0 && loin > 5.5 && q.z < HAUT_SMASH) sc += 0.6; // au fond, on laisse rebondir
    if (q.z > HAUT_SMASH && loin > 7) sc += 0.4;
    if (marge >= 0) {
      if (!best || sc < best.score) best = { ...q, score: sc };
    } else if (!secours || marge > secours.marge) secours = { ...q, score: 5 - marge, marge };
  }
  return best ?? secours;
}

/** Recalcule la trajectoire prévue et choisit qui, dans l'équipe qui reçoit, va la jouer. */
export function prevoir(jeu: Partie): void {
  const eq = jeu.balle.camp;
  const P = predit(jeu.balle, eq);
  jeu.pred = P;
  jeu.plan[autre(eq)] = null;
  if (P.faute) {
    // elle sort ou tape la vitre directement : on la laisse
    jeu.plan[eq] = null;
    return;
  }
  const avant = jeu.plan[eq];
  let best: Plan | null = null;
  for (const s of equipe(jeu, eq)) {
    const r = meilleurPoint(jeu, s, P);
    if (!r) continue;
    let sc = r.score + (r.y > 5 !== s.home > 5 ? 0.35 : 0);
    if (avant && avant.s === s) sc -= 0.2; // on ne change pas d'avis pour rien
    if (s.humain) sc -= 0.1;
    if (!best || sc < best.sc) best = { ...r, s, sc };
  }
  jeu.plan[eq] = best;
}
