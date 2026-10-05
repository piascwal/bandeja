import { G, HAUT_GRILLE_FOND, HAUT_VITRE, LARG, LONG, MIL, RESTIT, VITRE_COTE } from './constants';
import { filetH } from './terrain';
import type { Balle, CorpsBalle, Effet, Equipe, Surface } from './types';

/** Signale un contact pendant le pas : surface, côté du filet, force de l'impact. */
export type SurContact = (surface: Surface, cote: Equipe, force?: number) => void;

export function nouvelleBalle(): Balle {
  return {
    x: 3,
    y: 5,
    z: 1,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 'plat',
    spinDir: 0,
    roule: false,
    dehors: false,
    portres: false,
    vif: 0,
    super: 0,
    eqF: 0,
    camp: 1,
    sol: 0,
    service: false,
    filet: false,
    coup: null,
    mur: false,
    trace: [],
  };
}

/** Le lift et le smash plongent plus vite. */
export const gravite = (spin: Effet): number => (spin === 'lift' || spin === 'smash' ? G * 1.18 : G);

/** Un peu de hasard reproductible : la prévision de l'IA et le vrai rebond tombent pareil. */
export function bruit(b: CorpsBalle): number {
  const h = Math.sin(b.x * 12.9898 + b.y * 78.233 + b.z * 37.719) * 43758.5453;
  return (h - Math.floor(h)) * 2 - 1;
}

const coteDe = (x: number): Equipe => (x < MIL ? 0 : 1);

/** Arcade : la vitre relance la balle vers le haut (m/s), pour qu'elle revienne à hauteur de jeu. */
const COUP_VITRE = 2.0;

function rebondVitre(b: CorpsBalle, axe: 'x' | 'y'): void {
  const e = b.spin === 'vibora' ? 0.62 : b.spin === 'coupe' ? 0.8 : 0.8;
  if (axe === 'x') b.vx = -b.vx * e;
  else b.vy = -b.vy * e;
  // le coupé revient mollement vers le filet, la víbora « meurt » contre la vitre : la balle redescend aussitôt
  if (b.spin === 'coupe') b.vz = Math.max(b.vz * 0.9, 0) + COUP_VITRE * 0.8;
  else if (b.spin === 'vibora') {
    b.vz = Math.min(b.vz, 0) * 0.5 - 1.1;
    if (axe === 'x') b.vy += (b.spinDir || 0) * 1.2;
  } else b.vz = Math.max(b.vz * 0.9, 0) + COUP_VITRE;
}

function passageFilet(b: CorpsBalle, x0: number, y0: number, z0: number, ev?: SurContact): void {
  if (b.dehors || x0 < MIL === b.x < MIL) return;
  const f = (MIL - x0) / (b.x - x0);
  const zc = z0 + (b.z - z0) * f;
  const yc = y0 + (b.y - y0) * f;
  if (yc >= 0 && yc <= LARG && zc < filetH(yc)) {
    b.x = x0 < MIL ? MIL - 0.04 : MIL + 0.04;
    b.vx = -b.vx * 0.12;
    b.vy *= 0.35;
    b.vz = Math.min(b.vz, 0) * 0.3;
    ev?.('filet', coteDe(x0));
  }
}

/**
 * Le premier rebond d'un super coup : la météore et l'éclair s'écrasent et repartent
 * dans l'espace ; la comète file vers la vitre du fond, le phénix vers celle de côté
 * (qu'ils défoncent : voir `mursDuFond` et `mursLateraux`).
 */
function superRebond(b: CorpsBalle): void {
  if (b.super === 1 || b.super === 4) {
    b.vz = 45;
    b.vx *= 0.12;
    b.vy *= 0.12;
  } else if (b.super === 2) {
    const k = 48 / Math.max(1, Math.hypot(b.vx, b.vy));
    b.vx *= k;
    b.vy *= k;
    b.vz = 3;
  } else {
    b.vy = (b.y < 5 ? -1 : 1) * 40;
    b.vx *= 0.3;
    b.vz = 3;
  }
}

function rebondSol(b: CorpsBalle, ev?: SurContact): void {
  if (b.z >= 0 || b.roule) return;
  b.z = 0;
  if (b.vz >= 0) return;
  const [rz, rh] = RESTIT[b.spin] ?? RESTIT.plat;
  const vImpact = -b.vz; // vitesse d'arrivée, avant le rebond : c'est elle qui donne la force du choc
  b.vz = vImpact * rz;
  b.vx *= rh;
  b.vy *= rh;
  if (b.spin === 'vibora') b.vy += (b.spinDir || 0) * 1.6;
  if (b.super > 0 && b.vif > 0) {
    superRebond(b);
    b.vif = 0;
  } else if (b.vif > 0) {
    // coup fort : la balle bondit haut et garde sa vitesse, elle file vers la vitre et en revient en hauteur
    const k = Math.min(1, b.vif);
    b.vz += 1.2 + 3.3 * k + (b.vif > 1 ? 11 : 0);
    const garde = rh + (1 - rh) * 0.7 * k;
    b.vx *= garde / rh;
    b.vy *= garde / rh;
    b.vif = 0;
  }
  if (b.portres) {
    // le smash « por tres » : rebond énorme, la balle s'envole hors de la piste
    b.portres = false;
    b.vz = 12.5;
    b.vx *= 0.42;
    b.vy = (b.y < 5 ? -1 : 1) * 2.8;
  }
  const cote = coteDe(b.x);
  ev?.('sol', cote, vImpact);
  if (b.vz < 0.7) {
    b.vz = 0;
    b.roule = true;
    ev?.('sol', cote, 0);
  }
}

/** Un super coup traverse la vitre (qui vole en éclats) : la balle est dehors, elle continue sa course. */
function perceVitre(b: CorpsBalle, cote: Equipe, ev?: SurContact): boolean {
  ev?.('vitre', cote, 99);
  b.dehors = true;
  // la balle part comme une fusée : elle file vers le ciel
  b.vz = Math.max(b.vz, 30);
  ev?.('sortie', cote);
  return true;
}

/** Murs des bouts (x = 0 et x = 20) : vitre jusqu'à 3 m, grillage jusqu'à 4 m. */
function mursDuFond(b: CorpsBalle, ev?: SurContact): boolean {
  if (b.x >= 0 && b.x <= LONG) return false;
  const cote: Equipe = b.x < 0 ? 0 : 1;
  if (b.z > HAUT_GRILLE_FOND) {
    b.dehors = true;
    ev?.('sortie', cote);
    return true;
  }
  // la comète défonce la vitre du fond et sort de la piste
  if (b.super === 2 && b.vif === 0) return perceVitre(b, cote, ev);
  b.x = cote ? 2 * LONG - b.x : -b.x;
  const v = Math.abs(b.vx);
  if (b.z <= HAUT_VITRE) {
    rebondVitre(b, 'x');
    ev?.('vitre', cote, v);
  } else {
    b.vx = -b.vx * 0.25;
    b.vz *= 0.4;
    b.vy += bruit(b) * 1.2;
    ev?.('grille', cote, v);
  }
  return false;
}

/** Murs latéraux (y = 0 et y = 10) : vitre près des fonds, grillage au milieu. */
function mursLateraux(b: CorpsBalle, ev?: SurContact): void {
  if (b.y >= 0 && b.y <= LARG) return;
  const cote = coteDe(b.x);
  if (b.z > HAUT_VITRE) {
    b.dehors = true;
    ev?.('sortie', cote);
    return;
  }
  // le phénix défonce la vitre de côté et sort de la piste
  if (b.super === 3 && b.vif === 0 && (b.x < VITRE_COTE || b.x > LONG - VITRE_COTE)) {
    perceVitre(b, cote, ev);
    return;
  }
  b.y = b.y < 0 ? -b.y : 2 * LARG - b.y;
  const v = Math.abs(b.vy);
  if (b.x < VITRE_COTE || b.x > LONG - VITRE_COTE) {
    rebondVitre(b, 'y');
    ev?.('vitre', cote, v);
  } else {
    b.vy = -b.vy * 0.25;
    b.vz *= 0.4;
    b.vx += bruit(b) * 1.2;
    ev?.('grille', cote, v);
  }
}

/** Avance la balle de dt, en signalant filet, sol, vitre, grille et sortie. */
export function physique(b: CorpsBalle, dt: number, ev?: SurContact): void {
  const x0 = b.x;
  const y0 = b.y;
  const z0 = b.z;
  if (b.roule) {
    const f = Math.max(0, 1 - 1.4 * dt);
    b.vx *= f;
    b.vy *= f;
    b.vz = 0;
    b.z = 0;
  } else b.vz -= gravite(b.spin) * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;

  passageFilet(b, x0, y0, z0, ev);
  rebondSol(b, ev);
  if (b.dehors) return;
  if (mursDuFond(b, ev)) return;
  mursLateraux(b, ev);
}

/** Lance la balle vers (tx, ty) à la vitesse v, en passant le filet avec la marge demandée. */
export function lance(b: CorpsBalle, tx: number, ty: number, v: number, spin: Effet, marge: number): void {
  b.spin = spin;
  b.roule = false;
  b.dehors = false;
  const gg = gravite(spin);
  const dist = Math.hypot(tx - b.x, ty - b.y);
  let T = Math.max(0.12, dist / v);
  for (let k = 0; k < 80; k++) {
    const vx = (tx - b.x) / T;
    const vz = (-b.z + 0.5 * gg * T * T) / T;
    const tn = (MIL - b.x) / vx;
    if (!(tn > 0 && tn < T)) break;
    const zn = b.z + vz * tn - 0.5 * gg * tn * tn;
    if (zn >= filetH(b.y + ((ty - b.y) * tn) / T) + marge) break;
    T += 0.03;
  }
  b.vx = (tx - b.x) / T;
  b.vy = (ty - b.y) / T;
  b.vz = (-b.z + 0.5 * gg * T * T) / T;
}
