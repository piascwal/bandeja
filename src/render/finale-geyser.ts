import type { FinaleSuper } from './finale-super';
import { clamp01, h, melange } from './finale-outils';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/** De l'autre côté de la Terre : un volcan entre en éruption, un geyser de lave monte, la balle à son sommet. */
export function geyser(v: Vue, f: FinaleSuper, debut: number): void {
  const { g, W, H } = v;
  const age = f.t - debut;
  // on arrive de l'explosion de la sortie : un éclair blanc qui se dissipe
  const fondu = 1 - clamp01(age / 0.25);
  // tout tremble au début de l'éruption
  const secousse = 6 * (1 - clamp01(age / 0.45));
  // le ciel de l'autre côté : une aube pourpre et orange
  for (let y = 0; y < H; y += 6) {
    g.fillStyle = melange('#2a1450', '#ff9a4a', clamp01(y / (H * 0.8)) ** 1.5);
    g.fillRect(0, y, W, 6);
  }
  for (let i = 0; i < 40; i++) px(g, h(i) * W, h(i + 50) * H * 0.4, 1, 1, '#ffffff');
  // le ciel reste en place, le paysage tremble (au pixel près, pour ne pas ouvrir de jours entre les bandes)
  g.save();
  g.translate(
    Math.round((h(Math.floor(f.t * 40)) - 0.5) * secousse * 2),
    Math.round((h(Math.floor(f.t * 40) + 7) - 0.5) * secousse * 2),
  );
  const sol = Math.round(H * 0.82);
  const cx = W / 2;
  const hauteurCone = H * 0.3;
  // la mer, au loin, et la terre sombre
  g.fillStyle = '#1a2a5a';
  g.fillRect(0, sol - 6, W, 6);
  g.fillStyle = '#1c1410';
  g.fillRect(0, sol, W, H - sol);
  // le cône du volcan, en gradins
  const sommet = sol - hauteurCone;
  for (let y = sommet; y < sol; y += 3) {
    const k = (y - sommet) / hauteurCone;
    const demi = 12 + k * (W * 0.34);
    g.fillStyle = melange('#3a2c26', '#1c1410', k);
    g.fillRect(cx - demi, y, demi * 2, 3);
  }
  // le geyser : une colonne de lave qui monte, plus large à la base, avec des gerbes qui retombent
  const e = 1 - (1 - clamp01(age / 0.45)) ** 3;
  const hautColonne = e * (sommet - H * 0.14);
  const haut = sommet - hautColonne;
  for (let y = haut; y < sommet; y += 3) {
    const k = (y - haut) / Math.max(1, hautColonne);
    const l = 5 + k * 9 + Math.sin(y * 0.3 + f.t * 18) * 1.5;
    g.fillStyle = melange('#fff2b0', '#e0451a', k);
    g.fillRect(cx - l, y, l * 2, 3);
  }
  // les coulées sur les flancs
  for (let i = 0; i < 5; i++) {
    const dir = i % 2 ? 1 : -1;
    const l = clamp01((age - 0.3) / 1.2) * (30 + h(i) * 50);
    g.fillStyle = '#ff5a1a';
    for (let k = 0; k < l; k += 2)
      px(
        g,
        cx + dir * (14 + k * (0.6 + h(i + 9) * 0.5) + i * 3),
        sommet + 6 + k * 1.4,
        3,
        3,
        k % 6 ? '#e0451a' : '#ffd27a',
      );
  }
  // des gerbes de lave projetées autour, qui retombent
  for (let i = 0; i < 140; i++) {
    const t0 = i < 60 ? 0 : h(i + 300) * 0.5;
    const tt = age - t0;
    if (tt < 0 || tt > 1.6) continue;
    const vx = (h(i + 400) - 0.5) * (i < 60 ? 320 : 150);
    const vy = (i < 60 ? 140 : 90) + h(i + 500) * (i < 60 ? 260 : 150);
    const x = cx + vx * tt;
    const y = sommet - (vy * tt - 0.5 * 140 * tt * tt);
    if (y > sol) continue;
    g.globalAlpha = clamp01(1.6 - tt);
    px(g, x, y, i % 4 === 0 ? 4 : 2, i % 4 === 0 ? 4 : 2, i % 3 ? '#ffb24a' : '#fff2b0');
  }
  g.globalAlpha = 1;
  // la fumée qui monte du cratère
  for (let i = 0; i < 6; i++) {
    g.globalAlpha = clamp01(0.55 - i * 0.05) * clamp01(age / 0.4) * 0.6;
    g.fillStyle = '#4a3c46';
    g.beginPath();
    g.ellipse(
      cx + Math.sin(f.t * 2 + i) * 14 + (i - 3) * 12,
      haut + 30 + i * 12,
      22 + i * 5,
      10 + i * 2,
      0,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  g.globalAlpha = 1;
  // la balle au sommet du geyser, entourée de lave, avec une étoile qui scintille
  if (e > 0.1) {
    const couleur = COULEURS_SUPER[2]!;
    g.globalAlpha = 0.5;
    px(g, cx - 12, haut - 12, 24, 20, couleur);
    g.globalAlpha = 1;
    px(g, cx - 5, haut - 5, 10, 10, C.contour);
    px(g, cx - 4, haut - 4, 8, 8, C.balle);
    px(g, cx - 4, haut - 4, 3, 3, '#f8ffc0');
    if (e >= 1) {
      const k = 0.5 + 0.5 * Math.sin(f.t * 8);
      g.globalAlpha = k;
      px(g, cx - 1, haut - 24, 2, 10, '#ffffff');
      px(g, cx - 6, haut - 20, 12, 2, '#ffffff');
      g.globalAlpha = 1;
    }
  }
  // l'onde de choc de l'explosion, qui balaie le paysage
  if (age < 0.6) {
    for (const [k, c] of [
      [1, '#ffffff'],
      [0.7, '#ffb24a'],
    ] as [number, string][]) {
      g.globalAlpha = (1 - age / 0.6) * 0.8;
      g.strokeStyle = c;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(cx, sommet, age * 900 * k, age * 260 * k, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  g.restore();
  // l'éclair blanc de l'explosion, qui s'éteint
  if (fondu > 0) {
    g.globalAlpha = fondu;
    g.fillStyle = '#fffbe0';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
}
