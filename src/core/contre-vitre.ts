import type { Aleatoire } from './aleatoire';
import { physique, type SurContact } from './balle';
import { HAUT_SMASH, LARG, MIL, PAS } from './constants';
import { dir, fond } from './terrain';
import type { Balle, CorpsBalle, Equipe, Joueur, Mur } from './types';

/**
 * Contre-vitre : on renvoie la balle dans sa propre vitre (celle du fond, ou
 * celle de côté : mur = 'haut' / 'bas' à l'écran) pour qu'elle reparte
 * au-dessus du filet. On cherche par simulation un élan qui retombe chez
 * l'adversaire ; s'il n'y en a aucun, la balle n'est pas touchée et on
 * renvoie false.
 */
export function contreVitre(b: CorpsBalle, eq: Equipe, ty: number, mur: Mur, rng: Aleatoire): boolean {
  const z0 = Math.max(0.3, b.z);
  let best: { sc: number; vx: number; vy: number; vz: number } | null = null;
  for (const [vx, vy, vz] of essais(b, eq, ty, mur)) {
    const res = simule(b.x, b.y, z0, vx, vy, vz, eq);
    if (!res || res.y <= 0.3 || res.y >= LARG - 0.3) continue;
    // on vise ~6 m derrière le filet, et pour la vitre du fond, la profondeur demandée
    const sc =
      Math.abs(Math.abs(res.x - MIL) - 6) + (mur === 'fond' ? Math.abs(res.y - ty) * 0.3 : 0) + rng() * 0.4;
    if (!best || sc < best.sc) best = { sc, vx, vy, vz };
  }
  if (!best) return false;
  b.z = z0;
  b.vx = best.vx;
  b.vy = best.vy;
  b.vz = best.vz;
  b.spin = 'plat';
  b.roule = false;
  b.portres = false;
  b.por = 0;
  return true;
}

/**
 * Le joueur est-il dans une situation de contre-vitre ? Deux cas, balle rebondie et sous la hauteur de smash :
 * le lob profond (la balle est passée derrière lui, près de la vitre du fond, il lui fait face) ;
 * le manque de recul (il est collé à la vitre et la balle monte tout près).
 */
export function vitreJouable(b: Balle, s: Joueur): boolean {
  if (b.sol < 1 || b.z > HAUT_SMASH) return false;
  const balle = Math.abs(b.x - fond(s.eq));
  const joueur = Math.abs(s.x - fond(s.eq));
  const derriere = balle < joueur - 0.2;
  return (derriere && balle < 2.2) || (balle < 1.3 && joueur < 1.8);
}

/** Les élans essayés : vers le fond, ou vers la vitre de côté. */
function essais(b: CorpsBalle, eq: Equipe, ty: number, mur: Mur): [number, number, number][] {
  const d = dir(eq);
  const liste: [number, number, number][] = [];
  if (mur === 'fond') {
    for (let vb = 5; vb <= 15; vb += 1) {
      for (let vz = 2; vz <= 10.5; vz += 0.75) liste.push([-d * vb, (ty - b.y) / 2.2, vz]);
    }
  } else {
    const sy = mur === 'haut' ? -1 : 1;
    for (let vl = 4; vl <= 14; vl += 1.25) {
      for (let vf = -6; vf <= 10; vf += 2) {
        for (let vz = 2; vz <= 9.5; vz += 1.25) liste.push([d * vf, sy * vl, vz]);
      }
    }
  }
  return liste;
}

/** Où retombe la balle si elle touche d'abord sa propre vitre puis le sol adverse ; null sinon. */
function simule(x: number, y: number, z: number, vx: number, vy: number, vz: number, eq: Equipe) {
  const c: CorpsBalle = {
    x,
    y,
    z,
    vx,
    vy,
    vz,
    spin: 'plat',
    spinDir: 0,
    roule: false,
    dehors: false,
    portres: false,
    por: 0,
    vif: 0,
    super: 0,
  };
  let res: { ok: boolean; x: number; y: number } | null = null;
  let touche = false;
  const ev: SurContact = (t, cote) => {
    if (res) return;
    if (t === 'vitre' && cote === eq) touche = true;
    else if (t === 'sol') res = { ok: cote !== eq && touche, x: c.x, y: c.y };
    else res = { ok: false, x: c.x, y: c.y };
  };
  for (let i = 0; i < 500 && !res; i++) physique(c, PAS, ev);
  const r = res as { ok: boolean; x: number; y: number } | null;
  return r && r.ok ? r : null;
}
