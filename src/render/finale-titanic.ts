import { clamp01, h } from './finale-outils';
import { glacon, moitie, navire, dechirure } from './finale-navire';
import { minutage, VOYAGE_FIN_S, type FinaleSuper } from './finale-super';
import { texte } from './police';
import { C, COULEURS_SUPER } from './palette';
import { canvas, px } from './primitives';
import type { Vue } from './vue';

/**
 * TITANIC : la vérité sur l'iceberg. Nuit sur l'Atlantique nord : le paquebot fonce droit sur l'iceberg, la
 * vigie crie, il braque au dernier moment et le frôle sans le toucher... mais la balle tombe du ciel sur
 * l'iceberg, qui bascule sur le paquebot : la coque se fend et se casse en deux, la poupe se dresse, la proue
 * plonge, les deux moitiés coulent. La scène est dessinée sur une toile à part, fondue sur le jeu à la fin.
 */
const T_VIRAGE = 0.85; // le paquebot braque (fin à T_VIRAGE_FIN)
const T_VIRAGE_FIN = 1.3;
const T_BALLE = 1.3; // la balle apparaît dans le ciel...
const T_COUP = 1.65; // ... et frappe le sommet de l'iceberg
const T_CHOC = 1.9; // l'iceberg bascule contre la coque
const T_SEP = 2.05; // la coque se casse en deux
const ICEBERG_X = 0.69; // (fraction de la largeur)

const lisse = (x: number): number => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

let toile: { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } | null = null;

export function titanic(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const m = minutage(6);
  const fondu = f.t > m.fondu ? clamp01(1 - (f.t - m.fondu) / (m.fin - m.fondu)) : 1;
  if (!toile || toile.cv.width !== W || toile.cv.height !== H) {
    const [cv, c] = canvas(W, H);
    toile = { cv, c };
  }
  const { cv, c } = toile;
  c.clearRect(0, 0, W, H);
  dessine(c, W, H, f.t - VOYAGE_FIN_S, f.t);
  g.globalAlpha = fondu;
  g.drawImage(cv, 0, 0);
  g.globalAlpha = 1;
}

function dessine(c: CanvasRenderingContext2D, W: number, H: number, tau: number, t: number): void {
  const age = tau - T_CHOC;
  const secousse = age >= 0 ? 5 * (1 - clamp01(age / 0.6)) : 0;
  const hy = Math.round(H * 0.5);
  c.save();
  c.translate(
    Math.round((h(Math.floor(t * 50)) - 0.5) * secousse * 2),
    Math.round((h(Math.floor(t * 50) + 5) - 0.5) * secousse * 2),
  );
  fond(c, W, H, hy, t);
  // l'iceberg, derrière le paquebot : il bascule vers lui quand la balle le frappe
  const ix = W * ICEBERG_X;
  const ib = Math.round(H * 0.585);
  const lunge = lisse((tau - T_COUP) / (T_CHOC - T_COUP));
  c.save();
  c.translate(ix, ib + H * 0.05 * lunge);
  c.rotate(-0.28 * lunge);
  c.scale(1 + 0.25 * lunge, 1 + 0.25 * lunge);
  glacon(c, W, H, 0, 0);
  c.restore();
  const viree = lisse((tau - T_VIRAGE) / (T_VIRAGE_FIN - T_VIRAGE));
  const n = navire(W);
  const s = 1 + 0.08 * viree;
  const wl = Math.round(H * 0.63 + H * 0.075 * viree);
  const proue = W * 0.14 + W * 0.405 * Math.min(tau, T_CHOC);
  const x0 = proue - n.L * s;
  const xb = Math.round(0.48 * n.L);
  const contact = x0 + xb * s;
  sillage(c, x0, wl, tau, t);
  c.save();
  c.beginPath();
  c.rect(0, 0, W, wl + 1);
  c.clip();
  if (tau < T_SEP) {
    c.drawImage(
      n.img,
      Math.round(x0),
      Math.round(wl - n.haut * s),
      Math.round((n.L + 2) * s),
      Math.round((n.haut + n.tirant) * s),
    );
    if (tau > T_CHOC + 0.05) fissure(c, contact, wl, n.haut * s, n.L * s);
  } else {
    const u = Math.max(0, (tau - T_SEP) / 1.0);
    const e = lisse(u);
    // la poupe se dresse autour de la cassure et sombre ; la proue pique du nez et sombre aussi
    for (const cote of ['poupe', 'proue'] as const) {
      const poupe = cote === 'poupe';
      const angle = poupe ? 1.0 * e + 0.2 * clamp01(u - 1) : 0.34 * e;
      const dx = (poupe ? -0.05 : 0.04) * n.L * e;
      const sombre = (poupe ? 0.5 : 0.32) * n.L * u * u + (poupe ? 0 : 0.05 * n.L * e);
      c.save();
      c.translate(contact + dx, wl + sombre);
      c.rotate(angle);
      c.scale(s, s);
      c.translate(-xb, 0);
      c.clip(moitie(n, xb, cote));
      c.drawImage(n.img, 0, -n.haut);
      c.restore();
    }
  }
  c.restore();
  fumees(c, n.L, x0, wl, s, tau, t);
  if (tau > T_CHOC) bulles(c, contact, wl, tau, t);
  // l'iceberg pousse sa pointe sous l'eau jusqu'à la coque
  if (lunge > 0) belier(c, ix, ib + H * 0.05 * lunge, contact, wl + n.tirant * s, W, lunge, tau);
  if (tau > 0.55 && tau < T_VIRAGE_FIN && Math.floor(t * 6) % 2 === 0)
    texte(c, '!', x0 + 0.85 * n.L * s, wl - 0.33 * n.L * s - 12, '#ffffff', 1, 'c');
  balle(c, W, ix, ib - H * 0.32, tau);
  if (age >= 0) choc(c, contact, wl, age, W);
  c.restore();
  if (age >= 0 && age < 0.1) {
    c.globalAlpha = 1 - age / 0.1;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;
  }
  if (tau < 0.2) {
    c.globalAlpha = 1 - tau / 0.2;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;
  }
}

/** Le ciel étoilé avec sa lune, la mer noire et son reflet. */
function fond(c: CanvasRenderingContext2D, W: number, H: number, hy: number, t: number): void {
  for (let y = 0; y < hy; y += 4) {
    c.fillStyle = `rgb(${2 + Math.round((y / hy) * 14)},${3 + Math.round((y / hy) * 40)},${12 + Math.round((y / hy) * 70)})`;
    c.fillRect(0, y, W, 4);
  }
  for (let y = hy; y < H; y += 4) {
    const k = (y - hy) / (H - hy);
    c.fillStyle = `rgb(${12 - Math.round(k * 8)},${46 - Math.round(k * 30)},${84 - Math.round(k * 42)})`;
    c.fillRect(0, y, W, 4);
  }
  for (let i = 0; i < 70; i++) {
    c.globalAlpha = 0.3 + 0.7 * h(i + Math.floor(t * 3));
    px(c, h(i) * W, h(i + 77) * hy * 0.9, i % 8 === 0 ? 2 : 1, 1, '#ffffff');
  }
  c.globalAlpha = 0.2;
  c.fillStyle = '#fff6d0';
  c.beginPath();
  c.arc(W * 0.16, H * 0.16, 15, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  c.beginPath();
  c.arc(W * 0.16, H * 0.16, 9, 0, Math.PI * 2);
  c.fillStyle = '#fff6d0';
  c.fill();
  for (let i = 0; i < 26; i++) {
    c.globalAlpha = 0.15 + 0.45 * h(i + Math.floor(t * 5));
    const y = hy + 3 + i * 3.4;
    px(c, W * 0.16 - (2 + i * 0.25) + (h(i + 5) - 0.5) * 6, y, 4 + i * 0.5, 1, '#ffe9a8');
  }
  c.globalAlpha = 0.45;
  for (let i = 0; i < 30; i++)
    px(c, (h(i) * W + t * (10 + i)) % W, hy + 4 + i * ((H - hy) / 31), 6 + h(i + 3) * 10, 1, '#2a6aa8');
  c.globalAlpha = 1;
}

/** L'écume derrière la poupe. */
function sillage(c: CanvasRenderingContext2D, x0: number, wl: number, tau: number, t: number): void {
  const k = 1 - clamp01((tau - T_CHOC) / 0.5);
  for (let i = 0; i < 26; i++) {
    c.globalAlpha = (0.2 + 0.5 * (1 - i / 26)) * k;
    px(c, x0 + 4 - i * 4 - h(i + Math.floor(t * 8)) * 3, wl - 1 + (i % 3), 4, 2, '#dff2ff');
  }
  c.globalAlpha = 1;
}

/** La fumée des quatre cheminées, qui file vers l'arrière puis s'éteint à la cassure. */
function fumees(
  c: CanvasRenderingContext2D,
  L: number,
  x0: number,
  wl: number,
  s: number,
  tau: number,
  t: number,
): void {
  const vie = 1 - clamp01((tau - T_SEP) / 0.5);
  if (vie <= 0) return;
  for (const f of [0.3, 0.42, 0.54, 0.66])
    for (let i = 0; i < 6; i++) {
      const a = (t * 0.9 + i / 6 + f) % 1;
      c.globalAlpha = 0.5 * (1 - a) * vie;
      const r = 2 + a * 7;
      px(c, x0 + f * L * s - a * 0.12 * L * s - r / 2, wl - 0.41 * L * s - a * 16 - r / 2, r, r, '#9aa4b4');
    }
  c.globalAlpha = 1;
}

/** La pointe immergée de l'iceberg qui s'allonge sous l'eau jusqu'à la coque. */
function belier(
  c: CanvasRenderingContext2D,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  W: number,
  k: number,
  tau: number,
): void {
  const a = 1 - clamp01((tau - T_SEP - 0.6) / 0.5);
  c.globalAlpha = 0.55 * a;
  c.fillStyle = '#bfeaff';
  c.beginPath();
  c.moveTo(bx - 0.07 * W, by);
  c.lineTo(bx - 0.07 * W + (cx - (bx - 0.07 * W)) * k, by + (cy - by) * k - 3);
  c.lineTo(bx - 0.07 * W + (cx - (bx - 0.07 * W)) * k, by + (cy - by) * k + 2);
  c.lineTo(bx - 0.01 * W, by + 0.04 * W);
  c.closePath();
  c.fill();
  c.globalAlpha = 1;
}

/** La balle : tombe du ciel sur le sommet de l'iceberg, puis repart en rebondissant. */
function balle(c: CanvasRenderingContext2D, W: number, px0: number, py0: number, tau: number): void {
  if (tau < T_BALLE || tau > T_COUP + 0.6) return;
  const couleur = COULEURS_SUPER[6]!;
  const pos = (u: number): [number, number] => {
    if (u <= T_COUP) {
      const q = (u - T_BALLE) / (T_COUP - T_BALLE);
      return [W * 0.38 + (px0 - W * 0.38) * q, -8 + (py0 + 8) * q ** 1.5];
    }
    const a = u - T_COUP;
    return [px0 + a * 240, py0 - a * 210 + a * a * 260];
  };
  for (let i = 14; i >= 1; i--) {
    const u = Math.max(T_BALLE, tau - i * 0.012);
    const [x, y] = pos(u);
    c.globalAlpha = 0.15 + 0.6 * (1 - i / 14);
    const s = Math.round(1 + 4 * (1 - i / 14));
    px(c, x - s / 2, y - s / 2, s, s, i < 5 ? '#ffffff' : couleur);
  }
  c.globalAlpha = 1;
  const [x, y] = pos(tau);
  px(c, x - 4, y - 4, 8, 8, C.contour);
  px(c, x - 3, y - 3, 6, 6, C.balle);
}

/** La fente noire qui court dans la coque avant qu'elle ne cède. */
function fissure(c: CanvasRenderingContext2D, x: number, wl: number, haut: number, L: number): void {
  c.strokeStyle = '#000000';
  c.lineWidth = 2;
  c.beginPath();
  for (let y = -haut; y <= 2; y += 3) {
    const px0 = x + dechirure(y, L);
    if (y === -haut) c.moveTo(px0, wl + y);
    else c.lineTo(px0, wl + y);
  }
  c.stroke();
}

/** L'onde de choc, l'éclat de glace et les débris qui retombent à l'eau. */
function choc(c: CanvasRenderingContext2D, x: number, wl: number, age: number, W: number): void {
  c.strokeStyle = '#ffffff';
  c.lineWidth = 3;
  c.globalAlpha = 1 - clamp01(age / 0.4);
  c.beginPath();
  c.ellipse(x, wl, 8 + age * 0.35 * W, 3 + age * 0.08 * W, 0, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < 44; i++) {
    const vx = (h(i + 700) - 0.5) * 200;
    const vy = -(50 + h(i + 710) * 150);
    const px0 = x + vx * age;
    const py0 = wl - 18 + vy * age + 230 * age * age;
    if (py0 > wl + 4) continue;
    c.globalAlpha = 1 - clamp01(age / 1.4);
    const gros = i < 12 ? 3 : 2;
    px(c, px0, py0, gros, gros, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#bfe6ff' : '#8fb6d0');
  }
  c.globalAlpha = 1;
}

/** Les bulles qui remontent de la coque éventrée. */
function bulles(c: CanvasRenderingContext2D, x: number, wl: number, tau: number, t: number): void {
  c.strokeStyle = '#bfe6ff';
  c.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (t * 0.7 + h(i + 800)) % 1;
    c.globalAlpha = 0.7 * (1 - a) * clamp01((tau - T_CHOC) / 0.2);
    c.beginPath();
    c.arc(x + (h(i + 810) - 0.5) * 70, wl + 3 - a * 14, 1 + h(i + 820) * 2, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha = 1;
}
