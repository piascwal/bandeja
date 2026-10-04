import { HAUT_SMASH } from '@core/constants';
import { contrainte } from '@core/coups';
import { TYPES_SERV } from '@core/humain';
import type { Bouton, Joueur, Partie } from '@core/types';
import { RAYON_JOY, zonesBoutons, type Rond } from '@input/disposition';
import { C } from './palette';
import { micro, texte } from './police';
import { anneau, disque } from './primitives';
import type { Vue } from './vue';

/** Ce que l'affichage doit savoir des doigts posés sur l'écran. */
export interface EtatTactile {
  tactile: boolean;
  joy: { bx: number; by: number; x: number; y: number } | null;
  actifs: Set<string>;
}

const LOSANGE: Bouton[] = ['plat', 'amorti', 'lobe', 'smash'];
const COUL: Record<Bouton, [string, string]> = {
  plat: ['#ff5470', '#e03a58'],
  amorti: ['#2fd0c6', '#1a9d96'],
  lobe: ['#3fb4e8', '#2a8fc4'],
  smash: ['#ffa24a', '#d9741c'],
};
const LIB_JEU: Record<Bouton, string> = { plat: 'FRAPPE', amorti: 'AMORTI', lobe: 'LOBE', smash: 'SMASH' };
const LIB_SERVICE: Record<Bouton, string> = { plat: 'PLAT', amorti: 'COUPE', lobe: '', smash: '' };

function rond(v: Vue, z: Rond, app: boolean, haut: string, bas: string, nom: string, clair = false): void {
  const { g } = v;
  disque(g, z.x, z.y, z.r, C.contour);
  disque(g, z.x, z.y + (app ? 1 : 0), z.r - 1, bas);
  if (!app) disque(g, z.x, z.y + 1, z.r - 3, haut);
  // texte sombre sur les boutons clairs (jaune, orange)
  if (clair) micro(g, nom, z.x, z.y - 2 + (app ? 1 : 0), '#2a1700', 'rgba(255,240,180,0.7)');
  else micro(g, nom, z.x, z.y - 2 + (app ? 1 : 0), C.blanc);
}

export function dessineCommandes(v: Vue, jeu: Partie, t: EtatTactile): void {
  const s = jeu.humain;
  if (!s || !t.tactile) return;
  dessineJoystick(v, jeu, t);
  const z = zonesBoutons(v.W, v.H);
  const service = jeu.phase === 'service' && jeu.serveur === s;
  // balle haute à jouer : le SMASH pulse, c'est lui qui choisit smash, víbora ou bandeja
  const haute = jeu.phase === 'jeu' && jeu.balle.camp === s.eq && jeu.balle.z > HAUT_SMASH;
  for (const k of LOSANGE) {
    const lib = service ? LIB_SERVICE[k] : LIB_JEU[k];
    const app = t.actifs.has(k);
    const choisi = estChoisi(jeu, s, k);
    // lob subi : le SMASH ne répond pas
    const bloque = k === 'smash' && contrainte(jeu.balle, s);
    v.g.globalAlpha = (service && !lib) || bloque ? 0.25 : app || choisi ? 0.95 : 0.7;
    rond(v, z[k], app, COUL[k][0], COUL[k][1], lib || ' ');
    if (choisi && s.intent) anneau(v.g, z[k].x, z[k].y, z[k].r + 2, C.or, s.charge, 2);
    else if (choisi) anneau(v.g, z[k].x, z[k].y, z[k].r + 2, C.blanc, 1, 1);
    v.g.globalAlpha = 1;
  }
  if (haute && !service) {
    v.g.globalAlpha = 0.4 + 0.4 * Math.sin(jeu.temps * 10);
    anneau(v.g, z.smash.x, z.smash.y, z.smash.r + 3, C.or, 1, 1);
    v.g.globalAlpha = 1;
  }
}

/** Le coup armé (ou le service choisi) est entouré. */
function estChoisi(jeu: Partie, s: Joueur, k: Bouton): boolean {
  if (s.intent && s.intent.type === k) return true;
  return !!jeu.jauge && jeu.serveur === s && TYPES_SERV[k] === jeu.jauge.type;
}

function dessineJoystick(v: Vue, jeu: Partie, t: EtatTactile): void {
  const { g, H } = v;
  if (t.joy) {
    const j = t.joy;
    g.globalAlpha = 0.5;
    anneau(g, j.bx, j.by, RAYON_JOY, C.blanc, 1, 2);
    g.globalAlpha = 0.85;
    let dx = j.x - j.bx;
    let dy = j.y - j.by;
    const d = Math.hypot(dx, dy);
    if (d > RAYON_JOY) {
      dx *= RAYON_JOY / d;
      dy *= RAYON_JOY / d;
    }
    disque(g, j.bx + dx, j.by + dy, 9, C.contour);
    disque(g, j.bx + dx, j.by + dy, 8, '#dfe8ff');
    disque(g, j.bx + dx - 2, j.by + dy - 2, 3, C.blanc);
    g.globalAlpha = 1;
  } else if (jeu.temps < 20) {
    // rappel au début du match : où poser le pouce
    g.globalAlpha = 0.28 + 0.12 * Math.sin(jeu.temps * 3);
    anneau(g, 40, H - 40, RAYON_JOY, C.blanc, 1, 2);
    disque(g, 40, H - 40, 8, C.blanc);
    g.globalAlpha = 1;
    texte(g, 'BOUGER', 40, H - 13, C.blanc, 1, 'c');
  }
}
