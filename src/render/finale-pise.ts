import { FINALE_FIN_S, LUNE_FIN_S, VOYAGE_FIN_S, type FinaleSuper } from './finale-super';
import { clamp01, h, melange } from './finale-outils';
import { type Attitude, oiseaux, personnage, surpris } from './finale-foule';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/**
 * PISE : la place des Miracles, la tour encore bien droite ; la balle arrive du ciel,
 * la frappe en haut, et la tour se met à pencher (elle oscille, puis reste penchée).
 * Sur la place, la foule des touristes : ils se promènent et photographient la tour,
 * les pigeons s'envolent au choc, tout le monde sursaute, montre du doigt, s'enfuit...
 * puis deux d'entre eux prennent la pose : ils « retiennent » la tour.
 */
const IMPACT = 0.5; // la balle frappe la tour (temps depuis le début du plan)
const PENCHE = 0.16; // l'inclinaison finale (rad) : exagérée, pour qu'on la voie bien
const HAUT_IMPACT = 0.72; // où la balle frappe, en fraction de la hauteur de la tour

/** L'inclinaison de la tour à ce temps : droite, puis elle part, dépasse et oscille avant de se poser. */
export function inclinaisonPise(tau: number): number {
  const age = tau - IMPACT;
  if (age <= 0) return 0;
  return PENCHE * (1 - Math.exp(-age * 5) * Math.cos(age * 13));
}

export function pise(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const tau = f.t - VOYAGE_FIN_S;
  const age = tau - IMPACT;
  const fondu = f.t > LUNE_FIN_S ? clamp01(1 - (f.t - LUNE_FIN_S) / (FINALE_FIN_S - LUNE_FIN_S)) : 1;
  const secousse = age >= 0 ? 5 * (1 - clamp01(age / 0.4)) : 0;
  g.globalAlpha = fondu;
  for (let y = 0; y < H; y += 4) {
    g.fillStyle = melange('#4a9cff', '#cfe8ff', y / H);
    g.fillRect(0, y, W, 4);
  }
  g.save();
  g.translate(
    Math.round((h(Math.floor(f.t * 50)) - 0.5) * secousse * 2),
    Math.round((h(Math.floor(f.t * 50) + 5) - 0.5) * secousse * 2),
  );
  const sol = Math.round(H * 0.8);
  for (let i = 0; i < 4; i++)
    px(g, ((h(i) * W + tau * 8) % (W + 60)) - 30, H * (0.1 + h(i + 4) * 0.25), 40, 6, '#ffffff');
  // le Duomo, à gauche, et la pelouse
  px(g, W * 0.06, sol - 34, W * 0.28, 34, '#efe8d8');
  px(g, W * 0.06, sol - 34, W * 0.28, 3, '#fffaf0');
  for (let i = 0; i < 9; i++) px(g, W * 0.08 + i * W * 0.029, sol - 26, 3, 14, '#b8ab90');
  g.fillStyle = '#efe8d8';
  g.beginPath();
  g.arc(W * 0.2, sol - 34, 14, Math.PI, 0);
  g.fill();
  px(g, 0, sol, W, H - sol, '#3e9a4a');
  px(g, 0, sol, W, 2, '#5ab866');
  px(g, W * 0.4, sol + 8, W * 0.6, 5, '#e8e0cc');
  // la tour, dessinée droite puis tournée autour de son pied
  const pied = W * 0.62;
  const Ht = Math.round(H * 0.6);
  const lt = Math.round(Ht * 0.24);
  const ang = inclinaisonPise(tau);
  g.save();
  g.translate(pied + lt / 2, sol);
  g.rotate(ang);
  tour(g, lt, Ht);
  g.restore();
  // la poussière au pied, quand le sol cède
  if (age >= 0)
    for (let i = 0; i < 30; i++) {
      const a = Math.PI + h(i + 300) * Math.PI;
      const d = (10 + h(i + 310) * 40) * Math.sqrt(clamp01(age / 0.8));
      g.globalAlpha = fondu * 0.7 * (1 - clamp01(age / 1.1));
      px(g, pied + lt + Math.cos(a) * d, sol + Math.sin(a) * d * 0.4, 4, 3, '#d8cfb8');
    }
  g.globalAlpha = fondu;
  oiseaux(g, W * 0.48, sol + 16, 7, age < 0 ? -1 : age, f.t);
  foule(g, W, sol, tau, age, f.t, (H / 200) * 1.5);
  // la balle : du ciel en haut à gauche jusqu'au flanc de la tour, puis elle rebondit et repart
  const ix = pied;
  const iy = sol - Ht * HAUT_IMPACT;
  const couleur = COULEURS_SUPER[4]!;
  const pos = (t: number): [number, number] => {
    if (t <= IMPACT) {
      const k = t / IMPACT;
      return [-20 + (ix + 20) * k, H * 0.05 + (iy - H * 0.05) * k * k];
    }
    const a = t - IMPACT;
    return [ix - a * 280, iy - a * 240 + a * a * 60];
  };
  for (let i = 20; i >= 0; i--) {
    const t = Math.max(0, tau - i * 0.012);
    if (age >= 0 && t < IMPACT) continue;
    const [x, y] = pos(t);
    const k = 1 - i / 20;
    g.globalAlpha = fondu * (i === 0 ? 1 : 0.2 + 0.6 * k);
    const s = i === 0 ? 6 : Math.round(1 + 4 * k);
    if (i === 0) {
      px(g, x - 3, y - 3, 6, 6, C.contour);
      px(g, x - 2, y - 2, 4, 4, C.balle);
    } else px(g, x - s / 2, y - s / 2, s, s, k > 0.7 ? '#ffffff' : couleur);
  }
  // l'éclat de l'impact : éclats de marbre et étoile blanche
  if (age >= 0 && age < 0.5) {
    for (let i = 0; i < 18; i++) {
      const a = h(i + 400) * Math.PI * 2;
      const d = age * (60 + h(i + 410) * 120);
      g.globalAlpha = fondu * (1 - age / 0.5);
      px(
        g,
        ix + Math.cos(a) * d,
        iy + Math.sin(a) * d + age * age * 200,
        2,
        2,
        i % 3 ? '#efe8d8' : '#ffffff',
      );
    }
    g.globalAlpha = fondu * (1 - age / 0.25);
    px(g, ix - 12, iy - 1, 24, 3, '#ffffff');
    px(g, ix - 1, iy - 12, 3, 24, '#ffffff');
  }
  g.restore();
  if (age >= 0 && age < 0.12) {
    g.globalAlpha = (1 - age / 0.12) * fondu;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
  }
  // le blanc de l'arrivée (fin de la plongée du voyage)
  if (tau < 0.2) {
    g.globalAlpha = 1 - tau / 0.2;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;
}

/** La tour, droite, son pied en (0, 0) : le socle, six galeries d'arcades, le clocher plus étroit. */
function tour(g: CanvasRenderingContext2D, l: number, Ht: number): void {
  const x0 = -l / 2;
  const etage = Ht / 8.4;
  px(g, x0, -Ht + etage * 0.9, l, Ht - etage * 0.9, '#efe8d8');
  px(g, x0 + l * 0.7, -Ht + etage * 0.9, l * 0.3, Ht - etage * 0.9, '#d6cbb0'); // le côté à l'ombre
  for (let n = 0; n < 8; n++) {
    const y = -etage * (n + 1);
    px(g, x0 - 1, y, l + 2, 2, '#fffaf0'); // la corniche de l'étage
    const arcades = n === 0 ? 3 : 5;
    for (let i = 0; i < arcades; i++) {
      const ax = x0 + 2 + ((l - 4) * (i + 0.5)) / arcades - 1;
      const sombre = n === 0 ? '#c9bea4' : '#8f8268';
      px(g, ax, y + 4, 2, etage - 6, sombre);
    }
  }
  // le clocher, plus étroit
  const lc = l * 0.7;
  px(g, -lc / 2, -Ht, lc, etage * 0.9, '#efe8d8');
  px(g, -lc / 2 - 1, -Ht, lc + 2, 2, '#fffaf0');
  for (let i = 0; i < 3; i++)
    px(g, -lc / 2 + 2 + ((lc - 4) * (i + 0.5)) / 3 - 1, -Ht + 4, 2, etage * 0.9 - 6, '#8f8268');
  px(g, x0 - 2, -3, l + 4, 3, '#cfc4ab'); // le socle
}

/**
 * Les touristes de la place : [graine, position (fraction de W), recul sous l'horizon, attitude
 * avant le choc, après le choc, regard, vitesse avant et après (px/s)]. Rangés du fond vers le devant.
 */
const FOULE: [number, number, number, Attitude, Attitude, 1 | -1, number, number][] = [
  [8, 0.97, 8, 'marche', 'pointe', -1, -8, 0],
  [6, 0.36, 10, 'marche', 'bras', 1, 7, 0],
  [11, 0.5, 12, 'debout', 'court', 1, 0, -40],
  [1, 0.8, 14, 'photo', 'bras', -1, 0, 0],
  [2, 0.84, 15, 'debout', 'pointe', -1, 0, 0],
  [12, 0.1, 16, 'marche', 'pointe', 1, 10, 0],
  [3, 0.44, 20, 'marche', 'court', 1, 9, -45],
  [9, 0.66, 22, 'photo', 'bras', -1, 0, 0],
  [7, 0.56, 26, 'debout', 'bras', 1, 0, 0],
  [13, 0.25, 28, 'photo', 'photo', 1, 0, 0],
];
/** Les deux qui prennent la pose une fois la tour penchée, et celui qui les photographie. */
const POSE: [number, number, number, Attitude, 1 | -1][] = [
  [4, 0.76, 30, 'retient', -1],
  [14, 0.8, 31, 'retient', -1],
  [5, 0.92, 32, 'photo', -1],
];

function foule(
  g: CanvasRenderingContext2D,
  W: number,
  sol: number,
  tau: number,
  age: number,
  t: number,
  e: number,
): void {
  for (const [n, fx, dy, avant, apres, sens, v0, v1] of FOULE) {
    const choc = age > 0.12 + h(n) * 0.15;
    const x = W * fx + v0 * Math.min(tau, 0.5 + age) + (choc ? v1 * (age - 0.12) : 0);
    personnage(g, x, sol + dy, n, choc ? apres : avant, t, choc && v1 < 0 ? -1 : sens, e);
    if (choc && apres !== 'court' && apres !== 'photo') surpris(g, x, sol + dy, t, n, e);
  }
  // la pose : ils arrivent en marchant, puis « retiennent » la tour
  if (age > 0.5)
    for (const [n, fx, dy, attitude, sens] of POSE) {
      const arrive = Math.min(1, (age - 0.5) / 0.35);
      const x = W * fx + (1 - arrive) * 40;
      personnage(g, x, sol + dy, n, arrive < 1 ? 'marche' : attitude, t, sens, e);
    }
}
