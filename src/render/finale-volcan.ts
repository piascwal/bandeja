import { CHOC_S, FINALE_FIN_S, LUNE_FIN_S, type FinaleSuper } from './finale-super';
import { clamp01, h, melange } from './finale-outils';
import { C, COULEURS_SUPER } from './palette';
import { texte } from './police';
import { px } from './primitives';
import type { Vue } from './vue';

/**
 * Le VOLCAN, en un seul plan continu pour qu'on suive le chemin de la balle :
 * 1. on recule depuis le court, posé en haut de la Terre vue en coupe (croûte, manteau, noyau) ;
 * 2. la balle descend tout droit vers le centre en creusant un tunnel, la lave s'accroche à elle ;
 * 3. passé le centre, la Terre tourne d'un demi-tour : la balle remonte vers l'autre côté, où est le volcan ;
 * 4. on plonge sur le volcan, qui entre en éruption : un geyser de lave, la balle à son sommet.
 */
const RECUL_FIN = 0.9;
const DEPART = 0.8;
const ARRIVEE = 1.95;
const TOUR_DEBUT = 1.2;
const TOUR_FIN = 1.8;
const ZOOM_FIN = 2.2;
const DEBUT_GEYSER = ZOOM_FIN;

/** Les couches de la Terre en coupe : rayon relatif et couleur. */
const COUCHES: [number, string][] = [
  [1, '#5a4030'], // croûte
  [0.9, '#a03c18'], // manteau
  [0.68, '#e0551a'], // manteau profond
  [0.45, '#ffa028'], // noyau externe
  [0.22, '#fff2b0'], // noyau interne
];

const lisse = (x: number): number => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

export function volcan(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  if (f.t < ZOOM_FIN) coupe(v, f);
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

/** La Terre en coupe : le court en haut, le volcan en bas ; la balle la traverse, puis la Terre se retourne. */
function coupe(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const t = f.t;
  const entree = clamp01((t - CHOC_S) / 0.12);
  g.globalAlpha = entree;
  g.fillStyle = '#02030a';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 80; i++)
    px(g, h(i) * W, h(i + 77) * H, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1, '#ffffff');
  const cx = W / 2;
  const cy = H / 2 + 6;
  const R = Math.round(H * 0.38);
  // la caméra : on part tout près du court (en haut), on recule ; à la fin on plonge sur le volcan (en haut aussi)
  const zoom =
    t < RECUL_FIN
      ? 7 - 6 * lisse((t - CHOC_S) / (RECUL_FIN - CHOC_S))
      : t > ARRIVEE
        ? 1 + 3.5 * lisse((t - ARRIVEE) / (ZOOM_FIN - ARRIVEE))
        : 1;
  const tour = Math.PI * lisse((t - TOUR_DEBUT) / (TOUR_FIN - TOUR_DEBUT));
  // la balle sur le diamètre, du haut (le court) au bas (le volcan), dans le repère de la Terre
  const s = lisse((t - DEPART) / (ARRIVEE - DEPART));
  const yb = -R + 2 * R * s;
  // à la fin, le volcan (au sommet après le demi-tour) descend vers le bas de l'écran pendant qu'on plonge sur lui,
  // pour arriver cadré comme le plan de l'éruption qui suit
  const fin = lisse((t - ARRIVEE) / (ZOOM_FIN - ARRIVEE));
  const ancreY = cy - R - 10 * fin;
  g.save();
  g.translate(cx, ancreY + (H * 0.62 - ancreY) * fin);
  g.scale(zoom, zoom);
  g.translate(-cx, -ancreY);
  g.translate(cx, cy);
  g.rotate(tour);
  // l'atmosphère, puis les couches
  g.globalAlpha = entree * 0.25;
  g.fillStyle = '#6aa8ff';
  g.beginPath();
  g.arc(0, 0, R + 6, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = entree;
  for (const [r, c] of COUCHES) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(0, 0, R * r, 0, Math.PI * 2);
    g.fill();
  }
  // le noyau bat
  g.globalAlpha = entree * (0.35 + 0.25 * Math.sin(t * 9));
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(0, 0, R * 0.14, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = entree;
  // la surface : mers et terres, sur le bord
  g.lineWidth = 3;
  g.strokeStyle = '#1d4fb0';
  g.beginPath();
  g.arc(0, 0, R - 1, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 10; i++) {
    const a = h(i + 30) * Math.PI * 2;
    g.strokeStyle = '#3e9a4a';
    g.beginPath();
    g.arc(0, 0, R - 1, a, a + 0.15 + h(i) * 0.3);
    g.stroke();
  }
  // le court, en haut ; le volcan, en bas (pointe vers l'extérieur)
  px(g, -7, -R - 3, 14, 4, '#2a6bd8');
  px(g, -7, -R - 3, 14, 1, '#ffffff');
  px(g, -1, -R - 4, 1, 5, '#ffffff');
  g.fillStyle = '#2a1e18';
  g.beginPath();
  g.moveTo(-16, R - 2);
  g.lineTo(16, R - 2);
  g.lineTo(5, R + 13);
  g.lineTo(-5, R + 13);
  g.closePath();
  g.fill();
  px(g, -4, R + 11, 8, 2, s >= 1 ? '#ffb24a' : '#5a1a10');
  // le tunnel creusé par la balle : sombre dans la croûte, de la lave plus bas
  for (let y = -R; y < yb; y += 2) {
    const r = Math.abs(y) / R;
    px(g, -1, y, 3, 2, r > 0.9 ? '#120c08' : r > 0.45 ? '#ff6a1a' : '#fff2b0');
  }
  // la balle, et la lave qu'elle emporte depuis le noyau
  if (s > 0 && s < 1) {
    const lave = 2 + 6 * clamp01((s - 0.4) / 0.25);
    g.globalAlpha = entree * 0.85;
    g.fillStyle = '#ff8a1a';
    g.beginPath();
    g.arc(0, yb, lave, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = entree;
    px(g, -2, yb - 2, 5, 5, C.contour);
    px(g, -1, yb - 1, 3, 3, C.balle);
  }
  // le volcan s'éveille : la balle en sort, de la lave jaillit
  if (s >= 1) {
    for (let i = 0; i < 16; i++) {
      const tt = (t - ARRIVEE + h(i) * 0.2) % 0.6;
      g.globalAlpha = clamp01(1 - tt / 0.6);
      px(
        g,
        (h(i + 5) - 0.5) * 10 * tt * 6,
        R + 13 + tt * 40 * (0.6 + h(i + 9)),
        2,
        2,
        i % 2 ? '#ffb24a' : '#fff2b0',
      );
    }
    // la balle ressort du cratère et monte, portée par la lave
    const sortie = R + 14 + (t - ARRIVEE) * 140;
    g.globalAlpha = 1;
    px(g, -3, R + 13, 6, sortie - R - 13, '#ff8a1a');
    g.globalAlpha = 1;
    px(g, -2, sortie - 2, 5, 5, C.contour);
    px(g, -1, sortie - 1, 3, 3, C.balle);
  }
  g.restore();
  // ce qui se passe, écrit en clair au bon moment
  const legende = (txt: string, a: number, b: number) => {
    if (t < a || t > b) return;
    g.globalAlpha = clamp01(Math.min(t - a, b - t) / 0.12);
    texte(g, txt, cx, H - 24, '#ffd27a', 1, 'c');
    g.globalAlpha = 1;
  };
  legende('LA BALLE PERFORE LE COURT', RECUL_FIN - 0.15, 1.15);
  legende('CENTRE DE LA TERRE', 1.2, 1.55);
  legende('DE L AUTRE COTE...', 1.6, ZOOM_FIN);
}

/** De l'autre côté de la Terre : un volcan entre en éruption, un geyser de lave monte, la balle à son sommet. */
function geyser(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const age = f.t - DEBUT_GEYSER;
  // on arrive du zoom sur le volcan : un voile clair qui se dissipe
  const fondu = 0.6 * (1 - clamp01(age / 0.3));
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
