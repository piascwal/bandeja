import { balleHaute, coupAerien, TYPES_SERV } from '@core/humain';
import type { Bouton, Joueur, Partie } from '@core/types';
import { RAYON_JOY, zonesBoutons, type Rond } from '@input/disposition';
import { C, TRAINEES } from './palette';
import { micro, texte } from './police';
import { anneau, disque, px } from './primitives';
import type { Vue } from './vue';

/** Ce que l'affichage doit savoir des doigts posés sur l'écran. */
export interface EtatTactile {
  tactile: boolean;
  joy: { bx: number; by: number; x: number; y: number } | null;
  actifs: Set<string>;
  sprint: boolean;
}

type Losange = 'plat' | 'coupe' | 'lobe' | 'amorti';
const LOSANGE: Losange[] = ['plat', 'coupe', 'lobe', 'amorti'];
const COUL: Record<Losange, [string, string]> = {
  plat: ['#ff5470', '#e03a58'],
  coupe: ['#35c47a', '#24995c'],
  lobe: ['#3fb4e8', '#2a8fc4'],
  amorti: ['#2fd0c6', '#1a9d96'],
};
const LIB_JEU: Record<Losange, string> = { plat: 'FRAPPE', coupe: 'COUPE', lobe: 'LOBE', amorti: 'AMORTI' };
const LIB_SERVICE: Record<Losange, string> = { plat: 'PLAT', coupe: 'COUPE', lobe: '', amorti: '' };

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
  if (!s) return;
  const haut = balleHaute(jeu);
  const aerien = coupAerien(s) === 'vibora' ? 'VIBORA' : 'BANDEJA';
  if (!t.tactile) {
    if (haut)
      texte(v.g, `ESPACE : ${aerien}   (JOYSTICK HAUT OU BAS : VIBORA)`, v.W / 2, v.H - 10, C.or, 1, 'c');
    return;
  }
  dessineJoystick(v, jeu, t);
  const z = zonesBoutons(v.W, v.H);
  const service = jeu.phase === 'service' && jeu.serveur === s;
  for (const k of LOSANGE) {
    const lib = service ? LIB_SERVICE[k] : LIB_JEU[k];
    const app = t.actifs.has(k);
    const choisi = estChoisi(jeu, s, k);
    v.g.globalAlpha = service && !lib ? 0.25 : app || choisi ? 0.95 : 0.78;
    rond(v, z[k], app, COUL[k][0], COUL[k][1], lib || ' ');
    if (choisi && s.intent) anneau(v.g, z[k].x, z[k].y, z[k].r + 2, C.or, s.charge, 2);
    else if (choisi) anneau(v.g, z[k].x, z[k].y, z[k].r + 2, C.blanc, 1, 1);
    v.g.globalAlpha = 1;
  }
  // le bouton aérien, au centre : n'apparaît qu'avec une balle haute
  if (haut) {
    const vib = aerien === 'VIBORA';
    rond(
      v,
      z.aerien,
      t.actifs.has('aerien'),
      vib ? '#b46cff' : C.or,
      vib ? '#8a46d6' : '#d9a52b',
      aerien,
      !vib,
    );
    effetBouton(v, jeu.temps, vib ? 'vibora' : 'bandeja', z.aerien);
  }
  v.g.globalAlpha = t.sprint ? 0.95 : 0.7;
  rond(v, z.sprint, t.sprint, t.sprint ? '#ffb02e' : '#5a6082', t.sprint ? '#d98a10' : '#3a4166', 'COURIR');
  v.g.globalAlpha = 1;
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

/**
 * Balle haute : le bouton a sa traînée, la même que celle du coup. Víbora : un
 * serpent violet qui ondule ; bandeja : deux plateaux dorés qui tournent à plat.
 */
function effetBouton(v: Vue, t: number, k: 'vibora' | 'bandeja', z: Rond): void {
  const { g } = v;
  const pulse = 0.5 + 0.5 * Math.sin(t * 10);
  g.globalAlpha = 0.35 + 0.4 * pulse;
  anneau(g, z.x, z.y, z.r + 1, TRAINEES[k]!, 1, 1);
  if (k === 'vibora') {
    for (let i = 0; i < 14; i++) {
      const a = t * 5 - i * 0.16;
      const r = z.r + 4 + Math.sin(i * 0.9 + t * 14) * 2;
      g.globalAlpha = (1 - i / 14) * 0.95;
      px(g, z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, 2, 2, i < 2 ? '#f0d8ff' : TRAINEES.vibora!);
    }
  } else {
    for (const dep of [0, Math.PI]) {
      for (let i = 0; i < 10; i++) {
        const a = t * 3.2 + dep - i * 0.13;
        g.globalAlpha = (1 - i / 10) * 0.95;
        px(
          g,
          z.x + Math.cos(a) * (z.r + 5) - 1,
          z.y + Math.sin(a) * (z.r + 3),
          3,
          1,
          i < 2 ? '#fff2b0' : TRAINEES.bandeja!,
        );
      }
    }
  }
  g.globalAlpha = 1;
}
