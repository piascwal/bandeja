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
const T_COUP = 1.65; // ... et frappe le paquebot, sur le pont, au milieu
const T_CHOC = 1.85; // le coup le rejette contre l'iceberg
const T_SEP = 2.0; // la coque se casse en deux
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

/** Où est le paquebot : échelle, flottaison et poupe (il braque, puis la balle le rejette contre l'iceberg). */
function etatNavire(W: number, H: number, L: number, tau: number): { s: number; wl: number; x0: number } {
  const braque =
    lisse((tau - T_VIRAGE) / (T_VIRAGE_FIN - T_VIRAGE)) *
    (1 - 0.85 * lisse((tau - T_COUP) / (T_CHOC - T_COUP)));
  const s = 1 + 0.08 * braque;
  return {
    s,
    wl: Math.round(H * 0.63 + H * 0.075 * braque),
    x0: W * 0.14 + W * 0.405 * Math.min(tau, T_COUP) - L * s,
  };
}

function dessine(c: CanvasRenderingContext2D, W: number, H: number, tau: number, t: number): void {
  const age = tau - T_COUP;
  const secousse = age >= 0 ? 5 * (1 - clamp01(age / 0.6)) : 0;
  const hy = Math.round(H * 0.5);
  c.save();
  c.translate(
    Math.round((h(Math.floor(t * 50)) - 0.5) * secousse * 2),
    Math.round((h(Math.floor(t * 50) + 5) - 0.5) * secousse * 2),
  );
  fond(c, W, H, hy, t);
  // l'iceberg reste immobile, derrière le paquebot
  const ix = W * ICEBERG_X;
  const ib = Math.round(H * 0.585);
  glacon(c, W, H, ix, ib);
  const n = navire(W);
  const { s, wl, x0 } = etatNavire(W, H, n.L, tau);
  const xb = Math.round(0.48 * n.L);
  const contact = x0 + xb * s;
  // le point de la frappe : le pont, au milieu, tel qu'il est à l'instant du coup
  const coup = etatNavire(W, H, n.L, T_COUP);
  const cx = coup.x0 + xb * coup.s;
  const cy = coup.wl - 0.26 * n.L * coup.s;
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
    if (tau > T_COUP + 0.05) fissure(c, contact, wl, n.haut * s, n.L * s);
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
  if (tau > T_SEP) bulles(c, contact, wl, tau, t);
  if (tau > 0.55 && tau < T_VIRAGE_FIN && Math.floor(t * 6) % 2 === 0)
    texte(c, '!', x0 + 0.85 * n.L * s, wl - 0.33 * n.L * s - 12, '#ffffff', 1, 'c');
  balle(c, W, cx, cy, tau);
  if (age >= 0) choc(c, cx, cy, wl, age, W);
  // la coque racle le pied de l'iceberg : des éclats de glace
  if (tau > T_CHOC) glace(c, contact, ib, tau - T_CHOC);
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

/** La balle : tombe du ciel sur le pont du paquebot, puis repart en rebondissant. */
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

/** L'onde de choc du coup sur le pont : anneau, gerbe d'étincelles et d'éclats qui retombent à l'eau. */
function choc(c: CanvasRenderingContext2D, x: number, y: number, wl: number, age: number, W: number): void {
  c.strokeStyle = '#ffffff';
  c.lineWidth = 3;
  c.globalAlpha = 1 - clamp01(age / 0.4);
  c.beginPath();
  c.ellipse(x, y, 8 + age * 0.3 * W, 6 + age * 0.12 * W, 0, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < 44; i++) {
    const vx = (h(i + 700) - 0.5) * 220;
    const vy = -(60 + h(i + 710) * 170);
    const px0 = x + vx * age;
    const py0 = y + vy * age + 260 * age * age;
    if (py0 > wl + 2) continue;
    c.globalAlpha = 1 - clamp01(age / 1.2);
    const gros = i < 12 ? 3 : 2;
    px(c, px0, py0, gros, gros, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ffd27a' : '#c8d4e8');
  }
  c.globalAlpha = 1;
}

/** Les éclats de glace arrachés au pied de l'iceberg quand la coque le racle. */
function glace(c: CanvasRenderingContext2D, x: number, y: number, age: number): void {
  for (let i = 0; i < 30; i++) {
    const vx = (h(i + 900) - 0.5) * 120;
    const vy = -(30 + h(i + 910) * 110);
    const py0 = y - 6 + vy * age + 220 * age * age;
    if (py0 > y + 6) continue;
    c.globalAlpha = 1 - clamp01(age / 1);
    px(c, x + vx * age, py0, 2, 2, i % 2 ? '#ffffff' : '#bfe6ff');
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
