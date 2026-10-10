import { ASCENSION_FIN_S, CHOC_S, FINALE_FIN_S, LUNE_FIN_S, type FinaleSuper } from './finale-super';
import { clamp01, h, melange } from './finale-outils';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/** Les couches de la Terre, de la surface au noyau : couleur et profondeur (0 → 1) où elle commence. */
const COUCHES: [number, string][] = [
  [0, '#4a3524'], // croûte
  [0.16, '#8a3a1a'], // manteau
  [0.5, '#e0551a'], // manteau profond, rougeoyant
  [0.72, '#ffa028'], // noyau externe : lave
  [0.9, '#fff2b0'], // noyau interne
  [1.4, '#ffffff'],
];

function couche(profondeur: number): string {
  for (let i = COUCHES.length - 1; i >= 0; i--) {
    const [d, c] = COUCHES[i]!;
    if (profondeur >= d) {
      const [d2, c2] = COUCHES[i + 1] ?? [d + 1, c];
      return melange(c, c2, clamp01((profondeur - d) / (d2 - d)));
    }
  }
  return COUCHES[0]![1];
}

/**
 * Le VOLCAN : la balle perfore le court, plonge à travers la croûte, le manteau et le noyau (la lave
 * s'accroche à elle), puis ressort de l'autre côté de la Terre : un geyser de volcan, la balle à son sommet.
 */
export function volcan(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const entree = clamp01((f.t - CHOC_S) / 0.15);
  if (f.t < ASCENSION_FIN_S + 0.25) plongee(v, f, entree);
  else geyser(v, f);
  g.globalAlpha = 1;
  // la fin se fond au noir
  if (f.t > LUNE_FIN_S) {
    g.globalAlpha = clamp01((f.t - LUNE_FIN_S) / (FINALE_FIN_S - LUNE_FIN_S));
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
}

/** La plongée : la coupe de la Terre défile vers le haut, de plus en plus chaude, la balle emporte la lave. */
function plongee(v: Vue, f: FinaleSuper, entree: number): void {
  const { g, W, H } = v;
  const p = clamp01((f.t - CHOC_S) / (ASCENSION_FIN_S - CHOC_S));
  const defilement = p * p * H * 2.4 + p * H * 0.6;
  g.globalAlpha = entree;
  for (let y = 0; y < H; y += 4) {
    const profondeur = (y + defilement) / (H * 4.2);
    g.fillStyle = couche(profondeur);
    g.fillRect(0, y, W, 4);
  }
  // des cailloux dans la croûte, des bulles de magma plus bas
  for (let i = 0; i < 70; i++) {
    const wy = h(i + 5) * H * 2.6;
    const y = ((wy - defilement) % (H * 2.6)) + (wy - defilement < 0 ? H * 2.6 : 0);
    if (y < 0 || y > H) continue;
    const profondeur = (y + defilement) / (H * 4.2);
    const x = h(i) * W;
    if (profondeur < 0.5) px(g, x, y, 2 + (i % 3), 2, i % 2 ? '#2a1a10' : '#6b5038');
    else {
      g.globalAlpha = entree * 0.7;
      px(g, x, y, 3 + (i % 4), 3 + (i % 4), profondeur > 0.8 ? '#ffffff' : '#ffd27a');
      g.globalAlpha = entree;
    }
  }
  // la balle, au centre, avec sa traîne de feu qui remonte
  const bx = W / 2;
  const by = H * 0.42;
  const lave = 5 + 22 * clamp01((p - 0.35) / 0.65);
  for (let i = 24; i >= 1; i--) {
    g.globalAlpha = entree * (1 - i / 26) * 0.8;
    const t = 1 - i / 24;
    px(
      g,
      bx - 3 + Math.sin(i * 0.9 + f.t * 20) * 3,
      by - i * 5,
      3 + t * 5,
      4,
      t < 0.5 ? '#ff6a2a' : '#ffd27a',
    );
  }
  // la lave du centre qu'elle emporte avec elle : une masse qui grossit autour de la balle, des gouttes qui s'en détachent
  g.globalAlpha = entree * 0.9;
  g.fillStyle = '#ff8a1a';
  g.beginPath();
  g.ellipse(bx, by + 4, lave, lave * 1.25, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffd27a';
  g.beginPath();
  g.ellipse(bx, by + 2, lave * 0.65, lave * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 18; i++) {
    const a = h(i + 90) * Math.PI * 2;
    const r = lave + 4 + ((f.t * 40 + i * 7) % 18);
    g.globalAlpha = entree * (0.5 + 0.5 * h(i + 3));
    px(g, bx + Math.cos(a) * r, by + Math.sin(a) * r * 1.2, 2, 3, i % 2 ? '#ff6a2a' : '#fff2b0');
  }
  g.globalAlpha = entree;
  px(g, bx - 4, by - 4, 8, 8, C.contour);
  px(g, bx - 3, by - 3, 6, 6, C.balle);
  // la traversée du noyau : tout blanchit, puis le flash de la sortie
  const noyau = clamp01((f.t - (ASCENSION_FIN_S - 0.2)) / 0.45);
  if (noyau > 0) {
    g.globalAlpha = noyau;
    g.fillStyle = '#fffbe0';
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;
}

/** De l'autre côté de la Terre : un volcan entre en éruption, un geyser de lave monte, la balle à son sommet. */
function geyser(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const age = f.t - (ASCENSION_FIN_S + 0.25);
  const fondu = 1 - clamp01(age / 0.35); // le blanc du noyau se dissipe
  // le ciel de l'autre côté : une aube pourpre et orange
  for (let y = 0; y < H; y += 6) {
    g.fillStyle = melange('#2a1450', '#ff9a4a', clamp01(y / (H * 0.8)) ** 1.5);
    g.fillRect(0, y, W, 6);
  }
  for (let i = 0; i < 40; i++) px(g, h(i) * W, h(i + 50) * H * 0.4, 1, 1, '#ffffff');
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
  const e = clamp01(age / 0.9);
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
  for (let i = 0; i < 70; i++) {
    const t0 = h(i + 300) * 0.4;
    const tt = age - t0;
    if (tt < 0 || tt > 1.6) continue;
    const vx = (h(i + 400) - 0.5) * 150;
    const vy = 90 + h(i + 500) * 150;
    const x = cx + vx * tt;
    const y = sommet - (vy * tt - 0.5 * 140 * tt * tt);
    if (y > sol) continue;
    g.globalAlpha = clamp01(1.6 - tt);
    px(g, x, y, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2, i % 3 ? '#ffb24a' : '#fff2b0');
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
    const couleur = COULEURS_SUPER[5]!;
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
  // le flash blanc de la sortie du noyau, qui s'éteint
  if (fondu > 0) {
    g.globalAlpha = fondu;
    g.fillStyle = '#fffbe0';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
}
