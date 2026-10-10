import { JAUGE_PARFAITE, LIB_PTS, ZONE_ACE } from '@core/constants';
import { jaugeVal } from '@core/service';
import type { Partie } from '@core/types';
import { zonePause } from '@input/disposition';
import type { Banniere } from './effets';
import { C, EQUIPES } from './palette';
import { largeurTexte, texte } from './police';
import { px } from './primitives';
import { dessineCurseur } from './curseur';
import type { Vue } from './vue';

/** Tableau des scores, avec la même disposition que la piste, la même pour tous : équipe 0 à droite, équipe 1 à gauche. */
export function dessineTableau(v: Vue, jeu: Partie, boutonPause: boolean): void {
  const { g, W } = v;
  const cx = Math.round(W / 2);
  const lw = 168;
  const x = cx - lw / 2;
  const y = 2;
  px(g, x - 1, y - 1, lw + 2, 21, C.contour);
  px(g, x, y, lw, 19, C.panneau);
  px(g, x, y, lw, 1, '#2a3160');
  px(g, x, y + 18, lw, 1, '#0f1328');
  const droite = 0;
  const gauche = 1;
  const moi = jeu.humain?.eq;
  const nom = (eq: 0 | 1): string => {
    if (jeu.mode !== 'match') return eq === 0 ? 'BLEUS' : 'ROUGES';
    if (eq === moi) return 'VOUS';
    return jeu.humains.some((h) => h.eq === eq) ? 'ADV' : 'CPU';
  };
  const nomG = nom(gauche);
  const nomD = nom(droite);
  px(g, x + 3, y + 3, 3, 13, EQUIPES[gauche].maillot);
  px(g, x + lw - 6, y + 3, 3, 13, EQUIPES[droite].maillot);
  texte(g, nomG, x + 9, y + 6, EQUIPES[gauche].clair, 1, 'g');
  texte(g, nomD, x + lw - 9, y + 6, EQUIPES[droite].clair, 1, 'd');
  // jeux
  texte(g, jeu.jeux[gauche], cx - 38, y + 3, C.blanc, 2, 'c');
  texte(g, jeu.jeux[droite], cx + 38, y + 3, C.blanc, 2, 'c');
  // points (OR à 40-40 : point en or)
  const or = jeu.pts[0] === 3 && jeu.pts[1] === 3;
  px(g, cx - 25, y + 4, 50, 11, '#05060f');
  texte(g, or ? 'OR' : LIB_PTS[jeu.pts[gauche]]!, cx - 12, y + 6, C.or, 1, 'c', null);
  texte(g, '-', cx, y + 6, C.gris, 1, 'c', null);
  texte(g, or ? 'OR' : LIB_PTS[jeu.pts[droite]]!, cx + 12, y + 6, C.or, 1, 'c', null);
  // qui sert
  const sxv =
    jeu.serveur.eq === gauche ? x + 7 + largeurTexte(nomG) + 5 : x + lw - 9 - largeurTexte(nomD) - 6;
  px(g, sxv, y + 7, 3, 3, C.balle);
  px(g, sxv - 1, y + 8, 5, 1, C.balle);
  px(g, sxv + 1, y + 6, 1, 5, C.balle);
  if (boutonPause) {
    const zp = zonePause(W);
    px(g, zp.x - 1, zp.y - 1, zp.w + 2, zp.h + 2, C.contour);
    px(g, zp.x, zp.y, zp.w, zp.h, C.panneau);
    px(g, zp.x + 5, zp.y + 3, 2, 8, C.blanc);
    px(g, zp.x + 9, zp.y + 3, 2, 8, C.blanc);
  }
}

/** Segments de la jauge de service : rouge (filet / long), jaune, vert (parfait). */
const SEGMENTS: [number, number, string][] = [
  [0, 0.25, '#c8344a'],
  [0.25, JAUGE_PARFAITE.min, '#d9a52b'],
  [JAUGE_PARFAITE.min, JAUGE_PARFAITE.max, '#35c47a'],
  [JAUGE_PARFAITE.max, 0.93, '#d9a52b'],
  [0.93, 1, '#c8344a'],
];

export function dessineJauge(v: Vue, jeu: Partie): void {
  const hum = jeu.humain;
  if (!hum || jeu.phase !== 'service' || jeu.serveur !== hum || !jeu.pret || !jeu.jauge) return;
  const jt = jeu.jauge.t;
  const w = 150;
  dessineCurseur(v.g, {
    x: Math.round(v.W / 2 - w / 2),
    y: v.H - 30,
    w,
    h: 11,
    valeur: jaugeVal(jt),
    ancienne: (dt) => jaugeVal(jt - dt),
    segments: SEGMENTS.map(([a, b, c]) => ({ a, b, c })),
    zone: [JAUGE_PARFAITE.min, JAUGE_PARFAITE.max],
    or: [ZONE_ACE.min, ZONE_ACE.max],
    temps: jeu.temps,
    titre: 'SERVICE',
  });
}

/** L'annonce qui traverse l'écran au-dessus de la piste (point, jeu, faute...). */
export function dessineBanniere(v: Vue, b: Banniere): void {
  const { g, W } = v;
  const age = b.max - b.vie;
  const e = b.txt.length > 9 ? 2 : 3;
  const entree = Math.min(1, age * 6);
  const cx = Math.round(W / 2);
  const cy = Math.round(v.K.yF - 10);
  const bandeH = 7 * e + (b.sous ? 18 : 10);
  g.globalAlpha = Math.min(1, b.vie * 3) * 0.75;
  g.fillStyle = C.nuit;
  const bw = Math.round(W * entree);
  g.fillRect(cx - bw / 2, cy - 6, bw, bandeH);
  g.fillStyle = b.c;
  g.fillRect(cx - bw / 2, cy - 6, bw, 1);
  g.fillRect(cx - bw / 2, cy - 7 + bandeH, bw, 1);
  g.globalAlpha = Math.min(1, b.vie * 3);
  const dx = Math.round((1 - entree) * 60);
  texte(g, b.txt, cx - dx, cy, b.c, e, 'c');
  if (b.sous) texte(g, b.sous, cx + dx, cy + 7 * e + 4, C.blanc, 1, 'c');
  g.globalAlpha = 1;
}
