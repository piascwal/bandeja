import { ASCENSION_FIN_S, FINALE_FIN_S, LUNE_FIN_S, crateresLune, type FinaleSuper } from './finale-super';
import { clamp01, h, melange } from './finale-outils';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/** La balle s'écrase sur la lune à ce moment du plan (s) : avant, elle arrive ; après, elle laisse son cratère. */
const IMPACT_S = 0.6;
/** Rayon du cratère laissé par la balle (pixels logiques). */
const RAYON_CRATERE = 16;

/** Un cratère vu de biais : une ellipse sombre, son bord éclairé en haut. */
function cratere(g: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  g.globalAlpha = alpha;
  g.fillStyle = 'rgba(40,40,56,0.6)';
  g.beginPath();
  g.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(20,20,32,0.55)';
  g.beginPath();
  g.ellipse(x, y + 1, r * 0.7, r * 0.26, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(235,235,250,0.55)';
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(x, y - 1, r, r * 0.38, 0, Math.PI, Math.PI * 2);
  g.stroke();
}

/**
 * Le plan sur la lune : ciel étoilé, la Terre au loin, sol gris déjà criblé des
 * cratères de toutes les balles précédentes ; la balle arrive à toute vitesse du
 * ciel, s'écrase (éclair, onde de choc, débris, poussière) et creuse un nouveau
 * cratère, qui restera pour les prochaines fois.
 */
export function lune(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const tau = f.t - ASCENSION_FIN_S;
  const couleur = COULEURS_SUPER[f.variante] ?? C.or;
  const fondu = f.t > LUNE_FIN_S ? clamp01(1 - (f.t - LUNE_FIN_S) / (FINALE_FIN_S - LUNE_FIN_S)) : 1;
  g.globalAlpha = fondu;
  g.fillStyle = '#02030a';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = fondu * (0.35 + 0.65 * h(i + Math.floor(f.t * 4)));
    px(g, h(i) * W, h(i + 77) * H * 0.55, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1, '#ffffff');
  }
  g.globalAlpha = fondu;
  // la Terre, au loin
  const ex = W * 0.2;
  const ey = H * 0.22;
  for (let dy = -14; dy <= 14; dy++) {
    const w = Math.floor(Math.sqrt(14 * 14 - dy * dy));
    px(g, ex - w, ey + dy, w * 2, 1, dy > 4 ? '#1d4fb0' : '#2a6bd8');
  }
  px(g, ex - 7, ey - 4, 8, 3, '#3e9a4a');
  px(g, ex + 2, ey + 2, 6, 4, '#3e9a4a');
  px(g, ex - 10, ey - 9, 9, 2, '#e8f2ff');
  // le sol de la lune : une grosse boule grise vue de l'espace, dont l'horizon est arrondi
  const horizon = Math.round(H * 0.62);
  const R = W * 1.6;
  const cx0 = W / 2;
  const sag = (x: number): number => (x - cx0) ** 2 / (2 * R);
  g.save();
  g.beginPath();
  g.arc(cx0, horizon + R, R, 0, Math.PI * 2);
  g.clip();
  for (let y = horizon; y < H + 40; y += 4) {
    g.fillStyle = melange('#b9b9c6', '#6a6a7c', Math.min(1, (y - horizon) / (H - horizon)));
    g.fillRect(0, y - 40, W, 44);
  }
  g.restore();
  // le bord éclairé de la lune
  g.strokeStyle = '#e8e8f4';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx0, horizon + R, R, Math.PI * 1.2, Math.PI * 1.8);
  g.stroke();
  const place = (cx: number, cy: number): [number, number] => [
    cx * W,
    horizon + sag(cx * W) + 10 + cy * (H - horizon - 34),
  ];
  // les cratères déjà là : ceux des balles des parties d'avant, puis ceux de cette lune sauvegardés
  for (let i = 0; i < 8; i++) {
    const [ax, ay] = place(0.05 + h(i + 100) * 0.9, h(i + 130));
    cratere(g, ax, ay, 6 + h(i + 160) * 12, fondu);
  }
  const anciens = crateresLune();
  const n = f.cratereAjoute ? anciens.length - 1 : anciens.length;
  for (let i = 0; i < n; i++) {
    const c = anciens[i]!;
    const [cx, cy] = place(c.x, c.y);
    cratere(g, cx, cy, c.r, fondu);
  }
  // la balle : elle arrive en diagonale, de plus en plus vite, puis s'écrase
  const [bx, by] = place(f.xLune, f.yLune);
  const age = tau - IMPACT_S;
  if (age < 0) {
    const k = clamp01(tau / IMPACT_S);
    const pos = (q: number): [number, number] => [bx + (1 - q) * 70, -14 + (by + 14) * q * q];
    for (let i = 14; i >= 1; i--) {
      const [tx, ty] = pos(Math.max(0, k - i * 0.035));
      const t = 1 - i / 14;
      g.globalAlpha = fondu * (0.15 + 0.7 * t);
      const taille = Math.round(2 + 5 * t);
      px(g, tx - taille / 2, ty - taille / 2, taille, taille, t < 0.5 ? couleur : C.or);
    }
    const [x, y] = pos(k);
    g.globalAlpha = fondu * 0.55;
    px(g, x - 7, y - 7, 14, 14, couleur);
    g.globalAlpha = fondu;
    px(g, x - 3, y - 3, 6, 6, C.contour);
    px(g, x - 2, y - 2, 4, 4, C.balle);
    g.globalAlpha = 1;
    return;
  }
  // l'impact : le cratère se creuse en un instant, et il restera
  f.ajouteCratereLune(RAYON_CRATERE);
  const creuse = 1 - (1 - clamp01(age / 0.3)) ** 3;
  cratere(g, bx, by + 2, RAYON_CRATERE * creuse, fondu);
  // l'onde de choc, qui s'étale sur le sol
  if (age < 0.6) {
    g.globalAlpha = fondu * (1 - age / 0.6) * 0.8;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(bx, by + 2, age * 190, age * 190 * 0.38, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // les débris, jetés très haut puis retombant lentement (pesanteur faible) : quelques gros, beaucoup de petits
  for (let i = 0; i < 110; i++) {
    const gros = i < 24;
    const vx = (h(i) - 0.5) * (gros ? 150 : 260);
    const vy = (gros ? 50 : 20) + h(i + 40) * (gros ? 130 : 170);
    const tt = age;
    const y = by - (vy * tt - 0.5 * 110 * tt * tt);
    if (y > by + 4 || tt > 1.4) continue;
    g.globalAlpha = fondu * clamp01(1.4 - tt) * 0.9;
    const c = i % 7 === 0 ? couleur : i % 2 ? '#d8d8e6' : '#8a8a9c';
    px(g, bx + vx * tt, y, gros && i % 3 === 0 ? 2 : 1, gros && i % 3 === 0 ? 2 : 1, c);
  }
  // les étincelles de l'impact, vives et brèves, dans la couleur de la balle
  if (age < 0.45) {
    for (let i = 0; i < 40; i++) {
      const ang = h(i + 200) * Math.PI;
      const v = 70 + h(i + 240) * 150;
      g.globalAlpha = fondu * (1 - age / 0.45);
      px(g, bx - Math.cos(ang) * v * age, by - Math.sin(ang) * v * age * 0.7, 1, 1, i % 2 ? '#ffffff' : C.or);
    }
  }
  // la poussière qui monte du cratère
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = fondu * clamp01(0.5 - age * 0.3) * 0.5;
    g.fillStyle = '#c8c8d6';
    g.beginPath();
    g.ellipse(
      bx + (h(i + 90) - 0.5) * 30,
      by - age * 14 - i * 3,
      9 + age * 14,
      4 + age * 5,
      0,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  // la balle, au fond du cratère : elle brille, une étoile scintille au-dessus
  g.globalAlpha = fondu * (0.3 + 0.2 * Math.sin(f.t * 8));
  px(g, bx - 8, by - 6, 16, 12, couleur);
  g.globalAlpha = fondu;
  px(g, bx - 4, by - 3, 8, 8, C.contour);
  px(g, bx - 3, by - 2, 6, 6, C.balle);
  px(g, bx - 3, by - 2, 2, 2, '#f8ffc0');
  if (age > 0.7) {
    const k = 0.5 + 0.5 * Math.sin(f.t * 6);
    g.globalAlpha = fondu * k;
    px(g, bx - 1, by - 20, 2, 9, '#ffffff');
    px(g, bx - 5, by - 16, 10, 2, '#ffffff');
  }
  // l'éclair blanc de l'impact
  if (age < 0.25) {
    g.globalAlpha = fondu * (1 - age / 0.25) * 0.8;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;
}
