import { CHOC_S, VOYAGE_FIN_S, type FinaleSuper } from './finale-super';
import { clamp01, h } from './finale-outils';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/**
 * Le voyage de PISE et du SPHINX : vue de l'espace, la Terre défile sous la balle,
 * qui part du court, file au-dessus de la mer et retombe sur sa destination
 * (l'Italie, verte, ou l'Égypte, sable) ; à la fin, la caméra plonge sur la cible.
 */
const A_DEPART = -0.5; // le court, à gauche (angle sur le globe, 0 en haut)
const A_CIBLE = 0.5; // la destination, à droite
const ROTATION = 0.3; // la Terre tourne pendant le voyage : le décor défile sous la balle

/** Les terres du globe : [angle, profondeur sous l'horizon, demi-largeur, demi-hauteur (px), couleur]. */
function terres(sphinx: boolean): [number, number, number, number, string][] {
  const vert = '#3e9a4a';
  const cible = sphinx ? '#d8b45a' : vert;
  return [
    [A_DEPART, 16, 34, 20, vert],
    [A_DEPART - 0.25, 40, 60, 34, '#4aa856'],
    [-0.02, 26, 9, 5, '#4aa856'],
    [0.12, 50, 14, 8, '#4aa856'],
    [A_CIBLE + ROTATION, 14, 30, 18, cible],
    [A_CIBLE + ROTATION + 0.22, 44, 66, 36, sphinx ? '#c9a24a' : '#4aa856'],
    [1.5, 30, 50, 30, vert],
  ];
}

export function voyage(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const sphinx = f.variante === 5;
  const duree = VOYAGE_FIN_S - CHOC_S;
  const tau = f.t - CHOC_S;
  const k = clamp01(tau / (duree - 0.2)); // avancée de la balle
  const plonge = clamp01((tau - (duree - 0.25)) / 0.25); // le zoom final sur la cible
  const couleur = COULEURS_SUPER[f.variante] ?? C.or;
  const R = H;
  const cx = W / 2;
  const cy = H * 0.6 + R;
  const rot = -ROTATION * k;
  // un point au-dessus de la surface (angle sur le globe, altitude en pixels) → écran
  const ecran = (a: number, alt: number): [number, number] => [
    cx + Math.sin(a + rot) * (R + alt),
    cy - Math.cos(a + rot) * (R + alt),
  ];
  const [cibleX, cibleY] = ecran(A_CIBLE + ROTATION, 0);
  g.save();
  // la plongée : on grossit autour de la cible, qui vient au centre de l'écran
  const zoom = 1 + plonge * plonge * 5;
  g.translate(cibleX + (W / 2 - cibleX) * plonge, cibleY + (H / 2 - cibleY) * plonge);
  g.scale(zoom, zoom);
  g.translate(-cibleX, -cibleY);
  g.fillStyle = '#02030a';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = 0.35 + 0.65 * h(i + Math.floor(f.t * 4));
    px(g, (((h(i) * W - tau * 30) % W) + W) % W, h(i + 77) * H * 0.8, i % 9 === 0 ? 2 : 1, 1, '#ffffff');
  }
  // l'atmosphère, la mer, les terres, les nuages
  g.globalAlpha = 0.35;
  g.fillStyle = '#4a8cff';
  g.beginPath();
  g.arc(cx, cy, R + 7, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = '#1d4fb0';
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  g.translate(cx, cy);
  g.rotate(rot);
  for (const [a, d, rx, ry, c] of terres(sphinx)) {
    g.save();
    g.rotate(a);
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(0, -(R - d), rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + i * 0.3 + h(i) * 0.1;
    g.save();
    g.rotate(a);
    g.fillRect(-10, -R - 4 + h(i + 5) * 10, 16 + h(i + 9) * 14, 2);
    g.restore();
  }
  g.restore();
  // le départ : le petit court ; l'arrivée : la silhouette du monument
  const [dx, dy] = ecran(A_DEPART, 0);
  px(g, dx - 6, dy - 4, 12, 5, '#2f7d3a');
  px(g, dx - 6, dy - 4, 12, 1, '#ffffff');
  px(g, dx, dy - 4, 1, 5, '#ffffff');
  repere(g, cibleX, cibleY, sphinx, f.t);
  // la balle : un arc au-dessus de la mer, qui retombe sur la cible
  const alt = (q: number) => Math.sin(Math.PI * q) * H * 0.38;
  const posBalle = (q: number) => ecran(A_DEPART + (A_CIBLE + ROTATION - A_DEPART) * q, alt(q));
  for (let i = 24; i >= 1; i--) {
    const q = Math.max(0, k - i * 0.012);
    const [x, y] = posBalle(q);
    const t = 1 - i / 24;
    g.globalAlpha = 0.2 + 0.7 * t;
    const taille = Math.round(1 + 4 * t);
    px(g, x - taille / 2, y - taille / 2, taille, taille, t < 0.5 ? couleur : t < 0.85 ? C.or : '#ffffff');
  }
  const [bx, by] = posBalle(k);
  g.globalAlpha = 0.5;
  px(g, bx - 6, by - 6, 12, 12, couleur);
  g.globalAlpha = 1;
  px(g, bx - 3, by - 3, 6, 6, C.contour);
  px(g, bx - 2, by - 2, 4, 4, C.balle);
  g.restore();
  // le blanc de la plongée
  if (plonge > 0) {
    g.globalAlpha = plonge * plonge;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;
}

/** Le repère de la destination : une épingle qui clignote et la silhouette du monument (tour ou pyramides). */
function repere(g: CanvasRenderingContext2D, x: number, y: number, sphinx: boolean, t: number): void {
  if (sphinx) {
    for (const [ox, s] of [
      [-5, 5],
      [3, 4],
    ] as [number, number][])
      for (let i = 0; i < s; i++)
        px(g, x + ox - i, y - s + i, i * 2 + 1, 1, i < s / 2 ? '#fff2b0' : '#e8c070');
  } else {
    px(g, x - 1, y - 9, 3, 9, '#f4efe2');
    px(g, x - 1, y - 7, 3, 1, '#b8ab90');
    px(g, x - 1, y - 4, 3, 1, '#b8ab90');
  }
  if (Math.floor(t * 6) % 2 === 0) {
    px(g, x - 1, y - 18, 3, 5, '#ff3b3b');
    px(g, x, y - 13, 1, 3, '#ffffff');
  }
}
