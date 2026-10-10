import { alea, clamp, gauss, type Aleatoire } from './aleatoire';
import { physique, type SurContact } from './balle';
import { LARG, MIL, PAS, VITESSE, VITRE_COTE } from './constants';
import { dir, fond } from './terrain';
import type { Balle, CorpsBalle, Equipe, Joueur, Mur } from './types';

/**
 * Contre-vitre : on renvoie la balle dans sa propre vitre (celle du fond, ou
 * celle de côté : mur = 'haut' / 'bas' à l'écran) pour qu'elle reparte
 * au-dessus du filet. On cherche par simulation un élan qui retombe chez
 * l'adversaire ; s'il n'y en a aucun, la balle n'est pas touchée et on
 * renvoie false.
 */
export function contreVitre(
  b: CorpsBalle,
  eq: Equipe,
  ty: number,
  mur: Mur,
  rng: Aleatoire,
  erreur = 0,
): boolean {
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
  // un renvoi moyen n'est pas millimétré : l'élan trouvé est faussé (la balle peut retomber chez soi ou filer dehors)
  const f = (): number => 1 + gauss(rng) * erreur;
  b.z = z0;
  b.vx = best.vx * f();
  b.vy = best.vy * f();
  b.vz = best.vz * f();
  b.spin = 'plat';
  b.roule = false;
  b.portres = false;
  b.por = 0;
  return true;
}

/** Le joystick doit être poussé presque à fond (norme) vers une vitre, dans un cône d'environ 40° autour d'elle. */
export const SEUIL_VITRE = 0.8;
const COS_CONE = 0.75;

/**
 * La vitre que le joueur veut jouer, d'après son joystick au moment du coup : poussé vers
 * l'arrière, la vitre du fond ; vers un côté, la vitre de ce côté ; sinon rien (coup ordinaire).
 * Aucune autre condition : on peut viser sa vitre dans toutes les situations, la qualité du
 * renvoi (voir `placementVitre`) dit ce qu'il donne.
 */
export function murVise(v: { x: number; y: number }, eq: Equipe): Mur | null {
  const n = Math.hypot(v.x, v.y);
  if (n < SEUIL_VITRE) return null;
  if ((v.x / n) * dir(eq) < -COS_CONE) return 'fond';
  if (v.y / n < -COS_CONE) return 'haut';
  return v.y / n > COS_CONE ? 'bas' : null;
}

/**
 * Le joueur est-il bien placé pour renvoyer la balle dans cette vitre ? De 0 à 1 : la balle est
 * entre lui et la vitre (il est « en dessous », elle lui passe dans le dos), elle en est proche, et
 * c'est bien de la vitre (pas du grillage).
 */
export function placementVitre(b: Balle, s: Joueur, mur: Mur): number {
  const dist = (x: number, y: number): number =>
    mur === 'fond' ? Math.abs(x - fond(s.eq)) : mur === 'haut' ? y : LARG - y;
  const balle = dist(b.x, b.y);
  const joueur = dist(s.x, s.y);
  // large tolérance : même une balle un peu devant le joueur ou à quelques mètres de la vitre reste jouable
  const derriere = clamp((joueur - balle + 1.5) / 1.8, 0, 1);
  const proche = clamp(1 - (balle - 1.5) / 6, 0, 1);
  // la vitre de côté ne couvre que le bout de la piste : plus loin, c'est le grillage, qui ne rend rien
  const vitre = mur === 'fond' || Math.abs(b.x - fond(s.eq)) < VITRE_COTE ? 1 : 0.3;
  return (0.5 * derriere + 0.5 * proche) * vitre;
}

/** Un renvoi raté : la balle part droit sur la vitre sans être dirigée, et revient comme elle peut (souvent chez soi). */
export function vitreBrute(b: CorpsBalle, eq: Equipe, mur: Mur, rng: Aleatoire): void {
  const d = dir(eq);
  const v = alea(rng, 6, 12);
  b.z = Math.max(0.3, b.z);
  if (mur === 'fond') {
    b.vx = -d * v;
    b.vy = gauss(rng) * 2.5;
  } else {
    b.vx = d * alea(rng, -2, 3);
    b.vy = (mur === 'haut' ? -1 : 1) * v;
  }
  b.vz = alea(rng, 1.5, 5);
  b.spin = 'plat';
  b.roule = false;
  b.portres = false;
  b.por = 0;
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
  // exactement le pas du jeu (deux demi-pas par pas, voir `pas`) : le rebond de vitre dépend de la position précise de la balle
  for (let i = 0; i < 1000 && !res; i++) physique(c, (PAS * VITESSE) / 2, ev);
  const r = res as { ok: boolean; x: number; y: number } | null;
  return r && r.ok ? r : null;
}
