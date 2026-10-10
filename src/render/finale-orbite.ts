import { ASCENSION_FIN_S, FINALE_FIN_S, LUNE_FIN_S, type FinaleSuper } from './finale-super';
import { clamp01, h } from './finale-outils';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/**
 * L'ORBITE : la balle rebondit en orbite autour de la Terre à toute vitesse ; un satellite arrive en face ;
 * un petit ralenti montre le choc, la balle le fait exploser.
 */
export function orbite(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const tau = f.t - ASCENSION_FIN_S;
  const fondu = f.t > LUNE_FIN_S ? clamp01(1 - (f.t - LUNE_FIN_S) / (FINALE_FIN_S - LUNE_FIN_S)) : 1;
  g.globalAlpha = fondu;
  g.fillStyle = '#02030a';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 100; i++) {
    g.globalAlpha = fondu * (0.35 + 0.65 * h(i + Math.floor(f.t * 4)));
    px(g, h(i) * W, h(i + 77) * H, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1, '#ffffff');
  }
  g.globalAlpha = fondu;
  // la Terre : une grosse boule bleue en bas, son atmosphère, des continents
  const cx = W / 2;
  const cy = H * 1.12;
  const R = H * 0.78;
  g.fillStyle = '#4a8cff';
  g.globalAlpha = fondu * 0.25;
  g.beginPath();
  g.arc(cx, cy, R + 7, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = fondu;
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#1d4fb0';
  g.fillRect(0, 0, W, H);
  const rot = f.t * 14;
  for (let i = 0; i < 9; i++) {
    px(
      g,
      ((h(i) * W * 1.4 + rot) % (W * 1.2)) - W * 0.1,
      H * (0.4 + h(i + 20) * 0.5),
      16 + h(i + 9) * 40,
      5 + h(i + 3) * 9,
      '#3e9a4a',
    );
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 8; i++)
    g.fillRect(
      ((h(i + 70) * W * 1.4 + rot * 1.6) % (W * 1.2)) - W * 0.1,
      H * (0.38 + h(i + 80) * 0.5),
      30,
      3,
    );
  g.restore();
  // le temps du plan : vite, puis un petit ralenti autour du choc (s = temps du mouvement)
  const choc = 0.8;
  const s = tau < 0.75 ? 0.8 * tau : tau < 1.35 ? 0.6 + 0.333 * (tau - 0.75) : choc + 0.6 * (tau - 1.35);
  const ralenti = tau >= 0.75 && tau < 1.6;
  const orb = R + 46;
  const pos = (a: number): [number, number] => [cx + Math.cos(a) * orb * 1.18, cy - Math.sin(a) * orb];
  const aBalle = s <= choc ? Math.PI - (Math.PI / 2) * (s / choc) : Math.PI / 2 - (s - choc) * 2.4;
  const aSat = (Math.PI / 2) * Math.min(1, s / choc);
  const couleur = COULEURS_SUPER[6]!;
  // le satellite, jusqu'au choc
  if (s < choc) {
    const [sx, sy] = pos(aSat);
    px(g, sx - 3, sy - 3, 7, 7, '#c8ccd8');
    px(g, sx - 13, sy - 2, 9, 5, '#2a4fd8'); // panneaux solaires
    px(g, sx + 5, sy - 2, 9, 5, '#2a4fd8');
    px(g, sx - 1, sy - 6, 3, 3, '#ffffff');
    if (Math.floor(f.t * 6) % 2 === 0) px(g, sx, sy - 8, 1, 1, '#ff3b3b');
  }
  // la balle, sa longue traîne le long de l'orbite
  const taille = s > choc ? 3 : 4;
  for (let i = 40; i >= 1; i--) {
    const [tx, ty] = pos(aBalle + i * (ralenti ? 0.012 : 0.03));
    g.globalAlpha = fondu * (1 - i / 42) * 0.8;
    px(
      g,
      tx - 2,
      ty - 2,
      2 + Math.round((1 - i / 40) * taille),
      2 + Math.round((1 - i / 40) * taille),
      i < 12 ? '#ffffff' : couleur,
    );
  }
  g.globalAlpha = fondu;
  if (aBalle > -0.2) {
    const [bx, by] = pos(aBalle);
    g.globalAlpha = fondu * 0.5;
    px(g, bx - 7, by - 7, 14, 14, couleur);
    g.globalAlpha = fondu;
    px(g, bx - 3, by - 3, 6, 6, C.contour);
    px(g, bx - 2, by - 2, 4, 4, C.balle);
  }
  // le choc : un éclair, une boule de feu qui gonfle, des débris (panneaux, morceaux de coque) jetés au ralenti
  if (s >= choc) {
    const [ex, ey] = pos(Math.PI / 2);
    const age = tau - 1.35;
    g.globalAlpha = fondu * clamp01(1 - age / 0.6) * 0.9;
    for (const [r, c] of [
      [8 + age * 90, '#ff6a2a'],
      [5 + age * 55, '#ffd27a'],
      [3 + age * 25, '#ffffff'],
    ] as [number, string][]) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(ex, ey, r, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 46; i++) {
      const a = h(i + 600) * Math.PI * 2;
      const vit = 30 + h(i + 650) * 110;
      g.globalAlpha = fondu * clamp01(1.2 - age * 1.3);
      const gros = i < 10;
      px(
        g,
        ex + Math.cos(a) * vit * age,
        ey + Math.sin(a) * vit * age,
        gros ? 5 : 2,
        gros ? 3 : 2,
        gros ? '#2a4fd8' : i % 2 ? '#c8ccd8' : '#ffd27a',
      );
    }
    if (age < 0.12) {
      g.globalAlpha = fondu * (1 - age / 0.12) * 0.85;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, W, H);
    }
  }
  // le petit ralenti : une teinte bleue sur les bords et des barres de cinéma plus épaisses
  if (ralenti) {
    const k = clamp01(Math.min(tau - 0.75, 1.6 - tau) / 0.12);
    g.globalAlpha = 0.28 * k;
    g.fillStyle = '#0a1a4a';
    g.fillRect(0, 0, W, 22);
    g.fillRect(0, H - 22, W, 22);
    g.globalAlpha = 1;
  }
  g.globalAlpha = 1;
}
