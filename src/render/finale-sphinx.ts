import { FINALE_FIN_S, LUNE_FIN_S, VOYAGE_FIN_S, type FinaleSuper } from './finale-super';
import { clamp01, h, melange } from './finale-outils';
import { type Attitude, chameau, personnage, surpris } from './finale-foule';
import { texte } from './police';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/**
 * SPHINX : deux plans. D'abord le désert de Gizeh, les pyramides, le Sphinx couché
 * avec son nez ; une lueur file dans le ciel. Puis le gros plan sur son visage : il
 * écarquille les yeux en voyant la balle grossir droit sur lui... et elle lui casse
 * le nez, qui part en tournoyant.
 */
const GROS_PLAN = 0.55; // le passage au gros plan (temps depuis le début du plan)
const ETONNE = 0.75; // il ouvre grand les yeux
const IMPACT = 1.0; // la balle casse le nez

export function sphinx(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const tau = f.t - VOYAGE_FIN_S;
  const fondu = f.t > LUNE_FIN_S ? clamp01(1 - (f.t - LUNE_FIN_S) / (FINALE_FIN_S - LUNE_FIN_S)) : 1;
  g.globalAlpha = fondu;
  if (tau < GROS_PLAN) desert(v, f, tau);
  else visage(v, f, tau, fondu);
  // le blanc de l'arrivée, puis la coupe vers le gros plan
  const blanc = tau < 0.2 ? 1 - tau / 0.2 : Math.abs(tau - GROS_PLAN) < 0.06 ? 0.6 : 0;
  if (blanc > 0) {
    g.globalAlpha = blanc;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;
}

/** Le plan large : ciel chaud, pyramides, dunes, le Sphinx couché de profil ; la balle, encore loin, file dans le ciel. */
function desert(v: Vue, f: FinaleSuper, tau: number): void {
  const { g, W, H } = v;
  for (let y = 0; y < H; y += 4) {
    g.fillStyle = melange('#3a7ad8', '#ffd9a0', y / H);
    g.fillRect(0, y, W, 4);
  }
  px(g, W * 0.82, H * 0.14, 14, 14, '#fff2b0');
  const sol = Math.round(H * 0.74);
  // les pyramides, au fond à droite
  for (const [x, s] of [
    [W * 0.62, H * 0.3],
    [W * 0.8, H * 0.24],
    [W * 0.93, H * 0.15],
  ] as [number, number][]) {
    for (let i = 0; i < s; i += 2) {
      const l = i * 1.3;
      px(g, x - l, sol - s + i, l, 2, '#e8c070');
      px(g, x, sol - s + i, l, 2, '#c99a48');
    }
  }
  px(g, 0, sol, W, H - sol, '#e2b866');
  for (let i = 0; i < 6; i++) px(g, h(i) * W, sol + 6 + h(i + 3) * (H - sol - 10), 30, 2, '#cfa04e');
  // le Sphinx, couché de profil au premier plan, il regarde vers la droite (d'où vient la balle)
  const e = (H / 200) * 1.5;
  const sx = W * 0.3;
  const sy = sol + 10;
  g.save();
  g.translate(sx, sy);
  g.scale(e, e);
  profil(g);
  g.restore();
  const visX = sx + 30 * e;
  const visY = sy - 48 * e;
  visiteurs(g, W, sol, tau, f.t, (H / 200) * 1.3);
  // la balle, encore loin : une lueur qui file dans le ciel vers le Sphinx
  const k = clamp01(tau / GROS_PLAN);
  const bx = W + 10 - (W + 10 - visX) * k * 0.6;
  const by = H * 0.05 + (visY - H * 0.05) * k * 0.6;
  const couleur = COULEURS_SUPER[5]!;
  for (let i = 10; i >= 0; i--) {
    g.globalAlpha = 0.25 + 0.06 * (10 - i);
    px(g, bx + i * 4, by - i * 2, i === 0 ? 4 : 2, i === 0 ? 4 : 2, i < 3 ? '#ffffff' : couleur);
  }
  g.globalAlpha = 1;
  if (Math.floor(f.t * 8) % 2 === 0) px(g, bx - 3, by + 1, 10, 1, '#ffffff');
}

/** Le Sphinx de profil (repère local : le pied du poitrail en 0, 0) : corps de lion, pattes, némès rayé, nez intact. */
function profil(g: CanvasRenderingContext2D): void {
  px(g, -86, -26, 24, 26, '#cfa458'); // l'arrière-train
  px(g, -80, -20, 90, 20, '#d8ae62'); // le corps
  px(g, -80, -20, 90, 2, '#ecc77e');
  px(g, 10, -7, 40, 7, '#d8ae62'); // les pattes de devant
  px(g, 46, -7, 4, 7, '#cfa458');
  px(g, 0, -36, 22, 36, '#d0a65a'); // le poitrail
  px(g, -6, -64, 26, 32, '#c99a48'); // le némès
  for (let i = 0; i < 6; i++) px(g, -6, -62 + i * 5, 20, 2, '#a87a34');
  px(g, 14, -62, 14, 26, '#e0b86c'); // le visage
  px(g, 14, -62, 14, 3, '#a87a34'); // le bandeau du front
  px(g, 21, -54, 4, 2, '#4a3418'); // l'œil
  px(g, 28, -52, 4, 7, '#d0a65a'); // le nez, encore là
  px(g, 23, -42, 5, 1, '#8a6428'); // la bouche
  px(g, 16, -36, 10, 3, '#cfa458'); // le menton
}

/** Le plan large : un chameau, un guide et son drapeau, son groupe qui photographie ; vers la fin, ils voient la lueur. */
function visiteurs(
  g: CanvasRenderingContext2D,
  W: number,
  sol: number,
  tau: number,
  t: number,
  e: number,
): void {
  chameau(g, W * 0.78 - tau * 14, sol + 16, t, -1, e);
  const voit = tau > 0.32;
  // le guide, son drapeau levé
  const gx = W * 0.5;
  px(g, gx + 5 * e, sol + 20 - 18 * e, e, 14 * e, '#5a4a3a');
  px(g, gx + 6 * e, sol + 20 - 18 * e, 6 * e, 4 * e, Math.floor(t * 6) % 2 ? '#ff5a5a' : '#ff7a5a');
  personnage(g, gx, sol + 20, 21, voit ? 'pointe' : 'debout', t, voit ? 1 : -1, e);
  for (const [n, fx, dy, attitude] of [
    [22, 0.54, 22, 'photo'],
    [23, 0.57, 19, 'debout'],
    [24, 0.6, 24, 'photo'],
    [25, 0.64, 21, 'debout'],
    [26, 0.9, 14, 'marche'],
    [27, 0.16, 26, 'photo'],
  ] as [number, number, number, Attitude][]) {
    const x = W * fx - (attitude === 'marche' ? tau * 12 : 0);
    const leve = voit && h(n) < 0.7;
    personnage(g, x, sol + dy, n, leve ? 'pointe' : attitude, t, leve ? 1 : -1, e);
    if (leve) surpris(g, x, sol + dy, t, n, e);
  }
}

/** Les touristes minuscules au pied du gros plan : ils photographient, montrent la balle, puis fuient le nez qui tombe. */
function badauds(g: CanvasRenderingContext2D, W: number, H: number, tau: number, t: number): void {
  const age = tau - IMPACT;
  for (const [n, fx] of [
    [31, 0.14],
    [32, 0.2],
    [33, 0.27],
    [34, 0.72],
    [35, 0.79],
    [36, 0.86],
  ]) {
    const gauche = fx! < 0.5;
    const vers: 1 | -1 = gauche ? 1 : -1;
    const fuite: 1 | -1 = gauche ? -1 : 1;
    const x = W * fx! + (age > 0 ? fuite * age * (50 + h(n!) * 30) : 0);
    const attitude: Attitude = age > 0.05 ? 'court' : tau > ETONNE ? 'pointe' : 'photo';
    personnage(g, x, H - 8, n!, attitude, t, attitude === 'court' ? fuite : vers);
    if (tau > ETONNE) surpris(g, x, H - 8, t, n!);
  }
}

/** Le gros plan : le visage de face, les yeux qui s'écarquillent, la balle qui arrive et le nez qui saute. */
function visage(v: Vue, f: FinaleSuper, tau: number, fondu: number): void {
  const { g, W, H } = v;
  const age = tau - IMPACT;
  const secousse = age >= 0 ? 6 * (1 - clamp01(age / 0.45)) : 0;
  for (let y = 0; y < H; y += 4) {
    g.fillStyle = melange('#5a9ae8', '#ffd9a0', y / H);
    g.fillRect(0, y, W, 4);
  }
  g.save();
  g.translate(
    Math.round((h(Math.floor(f.t * 50)) - 0.5) * secousse * 2),
    Math.round((h(Math.floor(f.t * 50) + 5) - 0.5) * secousse * 2),
  );
  // un lent travelling avant sur le visage
  const cx = W / 2;
  const cy = H * 0.58;
  const e = (H / 200) * (1 + 0.12 * clamp01((tau - GROS_PLAN) / 0.6));
  g.translate(cx, cy);
  g.scale(e, e);
  // le némès : la coiffe rayée, arrondie sur le crâne, qui s'évase jusqu'aux épaules
  g.save();
  g.beginPath();
  g.moveTo(-46, -66);
  g.quadraticCurveTo(0, -96, 46, -66);
  g.lineTo(84, 56);
  g.lineTo(-84, 56);
  g.closePath();
  g.fillStyle = '#c99a48';
  g.fill();
  g.clip();
  for (let y = -96; y < 56; y += 10) px(g, -90, y, 180, 4, '#a87a34');
  g.restore();
  px(g, -3, -78, 6, 12, '#d0a65a'); // le cobra du front
  px(g, -2, -80, 4, 3, '#e0b86c');
  // le visage
  px(g, -34, -58, 68, 92, '#e0b86c');
  px(g, 24, -58, 10, 92, '#c99a48'); // l'ombre de la joue
  px(g, -34, -58, 68, 6, '#a87a34'); // le bandeau du front
  const surpris = clamp01((tau - ETONNE) / 0.08);
  // les sourcils qui montent, les yeux qui s'ouvrent grand
  for (const d of [-1, 1]) {
    const ox = d * 17;
    px(g, ox - 10, -40 - surpris * 7, 20, 3, '#8a6428');
    const ouvert = 3 + surpris * 11;
    px(g, ox - 8, -30 - ouvert / 2, 16, ouvert, '#fff6e0');
    const pupille = surpris > 0 ? 3 : 4;
    px(g, ox - pupille / 2, -30 - pupille / 2, pupille, pupille, '#2a1a08');
  }
  // le nez, puis la cassure ; la bouche qui s'ouvre en « o »
  if (age < 0) {
    px(g, -6, -22, 12, 26, '#d0a65a');
    px(g, -8, 0, 16, 5, '#b88a40');
  } else nezCasse(g);
  const bouche = surpris * 8;
  px(g, -12, 14, 24, 3 + bouche, '#6a4418');
  // la sueur de la peur
  if (surpris > 0 && age < 0) px(g, 32, -48 + ((tau * 40) % 12), 3, 4, '#bfe6ff');
  g.restore();
  badauds(g, W, H, tau, f.t);
  // le « ! » de la surprise
  if (surpris > 0 && age < 0.3) texte(g, '!', cx + 46 * e, cy - 92 * e, '#ff3b3b', 3, 'c');
  const couleur = COULEURS_SUPER[5]!;
  // la balle : un point au loin qui grossit droit sur le nez, puis elle repart en haut à droite
  const nx = cx;
  const ny = cy - 10 * e;
  if (age < 0) {
    const k = clamp01((tau - GROS_PLAN) / (IMPACT - GROS_PLAN));
    const r = 1 + 12 * k * k * k;
    g.globalAlpha = fondu * 0.5;
    px(g, nx - r * 1.6, ny - r * 1.6, r * 3.2, r * 3.2, couleur);
    g.globalAlpha = fondu;
    px(g, nx - r, ny - r, r * 2, r * 2, C.contour);
    px(g, nx - r + 1, ny - r + 1, r * 2 - 2, r * 2 - 2, C.balle);
  } else {
    const bx = nx + age * 300;
    const by = ny - age * 260;
    px(g, bx - 4, by - 4, 8, 8, C.contour);
    px(g, bx - 3, by - 3, 6, 6, C.balle);
    nez(g, nx, ny, age, e, fondu);
  }
  if (age >= 0 && age < 0.14) {
    g.globalAlpha = (1 - age / 0.14) * fondu;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = fondu;
}

/** Ce qui reste du nez : une cassure en dents de scie, la pierre claire à vif, des fissures. */
function nezCasse(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#b88a40';
  g.beginPath();
  g.moveTo(-8, 5);
  for (const [x, y] of [
    [-7, -6],
    [-4, -11],
    [-1, -6],
    [2, -13],
    [5, -7],
    [7, -9],
    [8, 5],
  ])
    g.lineTo(x!, y!);
  g.closePath();
  g.fill();
  px(g, -3, -5, 7, 6, '#ecc77e');
  g.strokeStyle = '#8a6428';
  g.lineWidth = 1;
  g.beginPath();
  for (const [x, y] of [
    [-16, -18],
    [12, -22],
    [16, 0],
  ]) {
    g.moveTo(0, -6);
    g.lineTo(x!, y!);
  }
  g.stroke();
}

/** Le nez arraché qui tournoie en tombant, avec la poussière de pierre et les éclats. */
function nez(g: CanvasRenderingContext2D, x: number, y: number, age: number, e: number, fondu: number): void {
  for (let i = 0; i < 40; i++) {
    const a = h(i + 500) * Math.PI * 2;
    const d = age * (40 + h(i + 510) * 160);
    g.globalAlpha = fondu * clamp01(1 - age * 1.4);
    const s = i < 10 ? 3 : 2;
    px(
      g,
      x + Math.cos(a) * d,
      y + Math.sin(a) * d * 0.7 + age * age * 160,
      s,
      s,
      i % 3 ? '#e0b86c' : '#fff2c8',
    );
  }
  g.save();
  g.globalAlpha = fondu;
  g.translate(x - age * 150, y + 10 * e - age * 120 + age * age * 420);
  g.rotate(age * 11);
  g.scale(e, e);
  px(g, -6, -13, 12, 26, '#d0a65a');
  px(g, -6, -13, 3, 26, '#ecc77e');
  px(g, -8, 9, 16, 5, '#b88a40');
  g.restore();
  g.globalAlpha = 1;
}
