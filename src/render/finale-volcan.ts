import { CHOC_S, FINALE_FIN_S, LUNE_FIN_S, type FinaleSuper } from './finale-super';
import { clamp01, h } from './finale-outils';
import { geyser } from './finale-geyser';
import { C } from './palette';
import { texte } from './police';
import { px } from './primitives';
import type { Vue } from './vue';

/**
 * Le VOLCAN, en un seul plan continu pour qu'on suive le chemin de la balle :
 * 1. on recule depuis le court, posé en haut de la Terre vue en coupe (croûte, manteau, noyau) ;
 * 2. la balle descend tout droit vers le centre en creusant un tunnel, la lave s'accroche à elle ;
 * 3. passé le centre, la Terre tourne d'un demi-tour : la balle remonte vers l'autre côté, où est le volcan ;
 * 4. la caméra se colle à la balle qui fonce vers la surface, la lave dans son sillage ;
 * 5. elle sort du volcan dans une explosion, puis l'éruption : un geyser de lave, la balle à son sommet.
 */
const RECUL_FIN = 0.85;
const DEPART = 0.85;
const TOUR_DEBUT = 1.3;
const TOUR_FIN = 1.7;
const POURSUITE = 1.7;
const ARRIVEE = 2.3;
const DEBUT_GEYSER = 2.5;

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

/** Où en est la balle sur le diamètre (0 : le court, 1 : le volcan) : elle descend, puis fonce vers la sortie. */
const avancee = (t: number): number =>
  t < POURSUITE
    ? 0.75 * lisse((t - DEPART) / (POURSUITE - DEPART))
    : 0.75 + 0.25 * clamp01((t - POURSUITE) / (ARRIVEE - POURSUITE));

export function volcan(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  if (f.t < DEBUT_GEYSER) coupe(v, f);
  else geyser(v, f, DEBUT_GEYSER);
  g.globalAlpha = 1;
  // la fin se fond au noir
  if (f.t > LUNE_FIN_S) {
    g.globalAlpha = clamp01((f.t - LUNE_FIN_S) / (FINALE_FIN_S - LUNE_FIN_S));
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
}

/** La Terre en coupe : le court en haut, le volcan en bas ; la balle la traverse, la Terre se retourne, on la suit. */
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
  const tour = Math.PI * lisse((t - TOUR_DEBUT) / (TOUR_FIN - TOUR_DEBUT));
  const s = avancee(t);
  const yb = -R + 2 * R * s;
  // la balle à l'écran (la Terre a tourné de `tour`)
  const bxE = cx - Math.sin(tour) * yb;
  const byE = cy + Math.cos(tour) * yb;
  // la caméra : on recule depuis le court ; pendant la poursuite on se colle à la balle ; à la sortie, au cratère
  const poursuite = lisse((t - POURSUITE) / 0.2);
  const zoom = t < RECUL_FIN ? 7 - 6 * lisse((t - CHOC_S) / (RECUL_FIN - CHOC_S)) : 1 + 3.5 * poursuite;
  const ancreX = t < RECUL_FIN ? cx : bxE;
  const ancreY = t < RECUL_FIN ? cy - R : byE;
  const cibleY = t < RECUL_FIN ? cy - R : byE + (H * 0.6 - byE) * poursuite;
  // la poursuite tremble, la sortie encore plus
  const age = t - ARRIVEE;
  const secousse = t > POURSUITE ? (age > 0 ? 7 * (1 - clamp01(age / 0.25)) : 1.5 * poursuite) : 0;
  const sx = (h(Math.floor(t * 50)) - 0.5) * secousse * 2;
  const sy = (h(Math.floor(t * 50) + 3) - 0.5) * secousse * 2;
  g.save();
  g.translate(ancreX + sx, cibleY + sy);
  g.scale(zoom, zoom);
  g.translate(-ancreX, -ancreY);
  g.translate(cx, cy);
  g.rotate(tour);
  terre(g, R, t, entree);
  // le tunnel creusé par la balle : sombre dans la croûte, de la lave plus bas ; derrière elle, la lave qui la suit
  for (let y = -R; y < yb; y += 2) {
    const r = Math.abs(y) / R;
    px(g, -1, y, 3, 2, r > 0.9 ? '#120c08' : r > 0.45 ? '#ff6a1a' : '#fff2b0');
  }
  if (t > POURSUITE && s < 1) {
    for (let i = 0; i < 26; i++) {
      const d = i * 2.2 + ((t * 120) % 2.2);
      g.globalAlpha = 1 - i / 26;
      px(g, -2 + Math.sin(i + t * 30), yb - d, 4, 2, i < 6 ? '#fff2b0' : '#ff8a1a');
    }
    g.globalAlpha = 1;
  }
  // la balle, et la lave qu'elle emporte depuis le noyau
  if (s > 0 && s < 1) {
    const lave = 2 + 5 * clamp01((s - 0.4) / 0.25);
    g.globalAlpha = entree * 0.85;
    g.fillStyle = '#ff8a1a';
    g.beginPath();
    g.ellipse(0, yb, lave, lave * (t > POURSUITE ? 1.8 : 1), 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = entree;
    px(g, -2, yb - 2, 5, 5, C.contour);
    px(g, -1, yb - 1, 3, 3, C.balle);
  }
  // la sortie : la balle jaillit du cratère, des bombes de lave partent dans tous les sens
  if (age >= 0) {
    const haut = R + 14 + age * 220;
    px(g, -2, R + 13, 4, haut - R - 13, '#ffd27a');
    px(g, -2, haut - 2, 5, 5, C.contour);
    px(g, -1, haut - 1, 3, 3, C.balle);
    for (let i = 0; i < 40; i++) {
      const a = (h(i + 11) - 0.5) * 2.4;
      const vit = 60 + h(i + 31) * 160;
      g.globalAlpha = clamp01(1 - age / 0.3);
      px(g, Math.sin(a) * vit * age, R + 13 + Math.cos(a) * vit * age, 2, 2, i % 3 ? '#ffb24a' : '#fff2b0');
    }
    g.globalAlpha = 1;
  }
  g.restore();
  // la vitesse : des traits qui filent pendant la poursuite
  if (t > POURSUITE && t < ARRIVEE) {
    g.globalAlpha = 0.5 * poursuite;
    for (let i = 0; i < 26; i++) {
      const x = h(i + 140) * W;
      const y = ((t * 900 + h(i) * H) % (H + 60)) - 30;
      px(g, x, y, 1, 18 + h(i + 3) * 26, i % 3 ? '#ffd27a' : '#ffffff');
    }
    g.globalAlpha = 1;
  }
  // l'explosion de la sortie : un éclair, des anneaux de choc
  if (age >= 0) {
    for (let k = 0; k < 3; k++) {
      g.globalAlpha = clamp01(1 - age / 0.2) * 0.8;
      g.strokeStyle = k === 1 ? '#ffb24a' : '#ffffff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, H * 0.6 - 30, age * (900 + k * 400), 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = clamp01(age / 0.2);
    g.fillStyle = '#fffbe0';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  legendes(v, t);
}

/** La Terre en coupe, dans son repère (centre à l'origine) : les couches, la surface, le court en haut, le volcan en bas. */
function terre(g: CanvasRenderingContext2D, R: number, t: number, entree: number): void {
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
  px(g, -4, R + 11, 8, 2, t > ARRIVEE - 0.25 ? '#ffb24a' : '#5a1a10');
}

/** Ce qui se passe, écrit en clair au bon moment. */
function legendes(v: Vue, t: number): void {
  const { g, W, H } = v;
  const legende = (txt: string, a: number, b: number) => {
    if (t < a || t > b) return;
    g.globalAlpha = clamp01(Math.min(t - a, b - t) / 0.12);
    texte(g, txt, W / 2, H - 24, '#ffd27a', 1, 'c');
    g.globalAlpha = 1;
  };
  legende('LA BALLE PERFORE LE COURT', RECUL_FIN - 0.2, 1.2);
  legende('CENTRE DE LA TERRE', 1.2, 1.6);
  legende('DE L AUTRE COTE...', 1.6, 1.95);
  legende('VERS LA SURFACE !', 1.95, ARRIVEE);
}
