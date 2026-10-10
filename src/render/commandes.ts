import { TYPES_SERV } from '@core/humain';
import type { Bouton, Joueur, Partie } from '@core/types';
import { clamp } from '@core/aleatoire';
import { optionsBoutons, RAYON_JOY, zonesBoutons, type Rond } from '@input/disposition';
import { NOMS_GESTE, SEUIL_LONG, SEUIL_TRAIT, type TypeGeste } from '@input/geste';
import { C } from './palette';
import { micro, texte } from './police';
import { anneau, disque, px } from './primitives';
import type { Vue } from './vue';

/** Ce que l'affichage doit savoir des doigts posés sur l'écran. */
export interface EtatTactile {
  tactile: boolean;
  joy: { bx: number; by: number; x: number; y: number } | null;
  actifs: Set<string>;
  /** le doigt qui tient ARMER et son trait en cours */
  trait: { x0: number; y0: number; type: TypeGeste } | null;
}

/** Les boutons absents de la disposition (voir `zonesBoutons`) ne sont pas dessinés. */
const ORDRE: Bouton[] = ['change', 'plat', 'lobe', 'amorti', 'smash'];
/** Une balle plus proche d'un bouton que cette distance (px) le rend transparent : il gêne moins, on le voit encore. */
const DISTANCE_VOILE = 70;
const ALPHA_VOILE = 0.22;
const COUL: Record<Bouton, [string, string]> = {
  plat: ['#ff5470', '#e03a58'],
  amorti: ['#2fd0c6', '#1a9d96'],
  lobe: ['#3fb4e8', '#2a8fc4'],
  smash: ['#ffa24a', '#d9741c'],
  change: ['#9b7bff', '#6f4fd8'],
  lourd: ['#ff5470', '#e03a58'],
};
const LIB_JEU: Record<Bouton, string> = {
  plat: 'ARMER',
  amorti: 'AMORTI',
  lobe: 'LOBE',
  smash: 'SMASH',
  change: 'CHANGE',
  lourd: 'FORT',
};
const LIB_SERVICE: Record<Bouton, string> = {
  plat: 'PLAT',
  amorti: 'COUPE',
  lobe: '',
  smash: '',
  change: 'CHANGE',
  lourd: 'FORT',
};

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
  const z = zonesBoutons(v.W, v.H, optionsBoutons(jeu));
  const service = jeu.phase === 'service' && jeu.serveur === s;
  const superPret = !service && jeu.jaugeSmash[s.eq] >= 1;
  // la balle, à l'écran : les boutons près d'elle s'effacent (sans disparaître) pour ne pas cacher le jeu
  const [bx, by] = v.K.proj(jeu.balle.x, jeu.balle.y, jeu.balle.z);
  let kSuper = 1;
  for (const k of ORDRE) {
    const rd = z[k];
    // le bouton du haut n'existe que pour le super coup : absent tant que la jauge n'est pas pleine
    if (!rd || (k === 'smash' && !superPret)) continue;
    const or = k === 'smash';
    // pendant le trait, le guide donne le coup choisi ; CHANGE s'efface pour lui laisser la place
    if (t.trait && k === 'change') continue;
    const lib = or ? 'SUPER' : service ? LIB_SERVICE[k] : k === 'plat' && t.trait ? ' ' : LIB_JEU[k];
    const app = t.actifs.has(k);
    const choisi = estChoisi(jeu, s, k);
    const voile =
      ALPHA_VOILE +
      (1 - ALPHA_VOILE) * clamp((Math.hypot(bx - rd.x, by - rd.y) - rd.r) / DISTANCE_VOILE, 0, 1);
    // CHANGE ne sert qu'en cours de point
    const inactif = k === 'change' && jeu.phase !== 'jeu';
    v.g.globalAlpha = (inactif ? 0.25 : or || app || choisi ? 1 : 0.7) * voile;
    if (or) kSuper = voile;
    // jauge pleine : le bouton SUPER apparaît, doré et animé, c'est lui qui lance le super coup
    if (or) rond(v, rd, app, '#fff2b0', '#e0a41c', lib, true);
    else rond(v, rd, app, COUL[k][0], COUL[k][1], lib || ' ');
    if (choisi && s.intent) anneau(v.g, rd.x, rd.y, rd.r + 2, C.or, s.charge, 2);
    else if (choisi) anneau(v.g, rd.x, rd.y, rd.r + 2, C.blanc, 1, 1);
    v.g.globalAlpha = 1;
  }
  if (superPret && z.smash) animeSuper(v, z.smash, jeu.temps, kSuper);
  if (!service) {
    if (t.trait) guideTrait(v, t.trait);
    else if (jeu.temps < 25)
      texte(
        v.g,
        'ARMER PUIS TRAIT : HAUT LOB - COURT AMORTI - AUTRE FORT',
        v.W - 6,
        v.H - 9,
        C.blanc,
        1,
        'd',
      );
  }
}

/** Le guide du trait, autour de là où le doigt a touché ARMER : le coup que dessine le trait en cours est en or. */
function guideTrait(v: Vue, tr: { x0: number; y0: number; type: TypeGeste }): void {
  const { g } = v;
  g.globalAlpha = 0.55;
  anneau(g, tr.x0, tr.y0, SEUIL_TRAIT, C.blanc, 1, 1);
  anneau(g, tr.x0, tr.y0, SEUIL_LONG, C.blanc, 1, 1);
  g.globalAlpha = 1;
  const lib = (type: TypeGeste, x: number, y: number) =>
    texte(g, NOMS_GESTE[type], x, y, tr.type === type ? C.or : C.grisBleu, 1, 'c');
  lib('lobe', tr.x0, tr.y0 - SEUIL_LONG - 10);
  lib('lourd', tr.x0 - SEUIL_LONG - 22, tr.y0 - 3);
  lib('amorti', tr.x0 - SEUIL_LONG - 22, tr.y0 + 14);
}

/** Le bouton SUPER : halo qui bat, ondes qui s'en échappent, étincelles qui tournent autour. */
function animeSuper(v: Vue, z: Rond, t: number, voile: number): void {
  const { g } = v;
  const pouls = 0.5 + 0.5 * Math.sin(t * 12);
  g.globalAlpha = (0.5 + 0.5 * pouls) * voile;
  anneau(g, z.x, z.y, z.r + 3 + pouls * 2, '#ffffff', 1, 2);
  for (let k = 0; k < 2; k++) {
    const onde = (t * 1.6 + k * 0.5) % 1;
    g.globalAlpha = (1 - onde) * voile;
    anneau(g, z.x, z.y, z.r + 2 + onde * 14, C.or, 1, 1);
  }
  for (let k = 0; k < 8; k++) {
    const a = t * 4 + (k / 8) * Math.PI * 2;
    g.globalAlpha = (0.6 + 0.4 * Math.sin(t * 20 + k)) * voile;
    px(g, z.x + Math.cos(a) * (z.r + 6), z.y + Math.sin(a) * (z.r + 6), 2, 2, k % 2 ? '#ffffff' : C.or);
  }
  g.globalAlpha = 1;
}

/** Le coup armé (ou le service choisi) est entouré. */
function estChoisi(jeu: Partie, s: Joueur, k: Bouton): boolean {
  // ARMER est entouré dès qu'un coup est armé, quel que soit le coup que dessine le trait
  if (s.intent && (s.intent.type === k || (k === 'plat' && jeu.phase !== 'service'))) return true;
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
