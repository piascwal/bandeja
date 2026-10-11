import { ecranBleu } from './finale-ecran-bleu';
import { clamp01, h } from './finale-outils';
import { CHOC_S, ERREUR_FIN_S, type FinaleSuper } from './finale-super';
import { COULEURS_SUPER, C } from './palette';
import { canvas, px } from './primitives';
import type { Vue } from './vue';

/**
 * L'ERREUR 404 : la balle rebondit et remonte droit vers la caméra qui filme le jeu, grossit, frappe la vitre :
 * l'écran se fissure (les éclats se décalent), l'image se met à bugger (bandes décalées, neige), puis écran
 * bleu quelques secondes avec le message CRT_TENNIS_ERREUR_404, et le téléviseur s'éteint.
 * Tout se dessine par-dessus l'image du jeu, qui reste visible jusqu'au plantage.
 */
const T_IMPACT = 1.25; // la balle atteint la vitre
const T_FISSURES = 0.45; // durée de la propagation des fissures
const T_BUG = 1.7; // l'image se met à bugger
const T_BLEU = 2.05; // l'écran bleu
const T_BLEU_FIN = 3.95;
const NB_RAYONS = 11;

/** Le point d'impact sur la vitre (fraction de l'écran). */
const IMPACT = { x: 0.52, y: 0.45 };

let copie: { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } | null = null;

/** Prend une photo de l'image du jeu telle qu'elle est dessinée jusqu'ici (pixels réels de l'écran). */
function photo(g: CanvasRenderingContext2D): HTMLCanvasElement {
  const src = g.canvas;
  if (!copie || copie.cv.width !== src.width || copie.cv.height !== src.height) {
    const [cv, c] = canvas(src.width, src.height);
    copie = { cv, c };
  }
  copie.c.clearRect(0, 0, src.width, src.height);
  copie.c.drawImage(src, 0, 0);
  return copie.cv;
}

/** La direction de chaque fissure principale : espacées régulièrement, un peu au hasard. */
const angle = (i: number): number => (i / NB_RAYONS) * Math.PI * 2 + (h(i + 300) - 0.5) * 0.4;

export function erreur(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const t = f.t;
  const ix = W * IMPACT.x;
  const iy = H * IMPACT.y;
  if (t >= T_BLEU) {
    const p = clamp01((t - T_BLEU) / (T_BLEU_FIN - T_BLEU));
    const sortie = clamp01((t - T_BLEU_FIN) / (ERREUR_FIN_S - 0.12 - T_BLEU_FIN));
    // les premières images de l'écran bleu clignotent, comme une carte qui rame
    if (t - T_BLEU < 0.12 && Math.floor(t * 40) % 2 === 0) {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
    } else ecranBleu(v, p, sortie, t);
    // le jeu revient : l'image noire se dissipe sur les dernières images
    if (t > ERREUR_FIN_S - 0.12) {
      g.globalAlpha = clamp01((t - (ERREUR_FIN_S - 0.12)) / 0.12);
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    return;
  }
  const arrive = clamp01((t - CHOC_S) / (T_IMPACT - CHOC_S));
  if (t < T_IMPACT) {
    balle(g, W, H, f, arrive, ix, iy);
    return;
  }
  const age = t - T_IMPACT;
  const fente = clamp01(age / T_FISSURES);
  const photoJeu = photo(g);
  // le choc : l'écran tremble et blanchit
  const secousse = 7 * (1 - clamp01(age / 0.5));
  g.save();
  g.translate(
    Math.round((h(Math.floor(t * 60)) - 0.5) * secousse * 2),
    Math.round((h(Math.floor(t * 60) + 9) - 0.5) * secousse * 2),
  );
  eclats(g, W, H, ix, iy, photoJeu, clamp01((age - 0.15) / 0.7));
  fissures(g, W, H, ix, iy, fente);
  g.restore();
  if (age < 0.12) {
    g.globalAlpha = 1 - age / 0.12;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (t >= T_BUG) bug(g, W, H, photoJeu, clamp01((t - T_BUG) / (T_BLEU - T_BUG)), t);
}

/** La balle, qui part du point d'impact au sol et fonce vers la caméra : de plus en plus grosse, avec sa traînée. */
function balle(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  f: FinaleSuper,
  q: number,
  ix: number,
  iy: number,
): void {
  const couleur = COULEURS_SUPER[7]!;
  const pos = (k: number): [number, number, number] => {
    const e = k * k;
    return [f.x + (ix - f.x) * e, f.y + (iy - f.y) * e, 2 + 38 * k ** 2.6];
  };
  for (let i = 18; i >= 1; i--) {
    const [x, y, r] = pos(Math.max(0, q - i * 0.018));
    const k = 1 - i / 18;
    g.globalAlpha = 0.15 + 0.5 * k;
    const s = Math.max(2, r * (0.5 + 0.5 * k));
    px(g, x - s / 2, y - s / 2, s, s, k < 0.5 ? couleur : '#ffffff');
  }
  const [x, y, r] = pos(q);
  const disque = (rayon: number, c: string) => {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, rayon, 0, Math.PI * 2);
    g.fill();
  };
  g.globalAlpha = 0.35;
  disque(r * 1.6, couleur);
  g.globalAlpha = 1;
  disque(r + 1.5, C.contour);
  disque(r, C.balle);
  // les coutures de la balle et son reflet
  if (r > 5) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = Math.max(1, r * 0.12);
    g.beginPath();
    g.arc(x - r * 1.05, y, r * 0.95, -0.9, 0.9);
    g.arc(x + r * 1.05, y, r * 0.95, Math.PI - 0.9, Math.PI + 0.9);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(Math.round(x - r * 0.55), Math.round(y - r * 0.6), Math.max(2, Math.round(r * 0.35)), 2);
  }
  // les éclairs de la vitre qui approche : l'écran se voile de blanc juste avant l'impact
  if (q > 0.85) {
    g.globalAlpha = (q - 0.85) * 2;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
}

/** Les fissures : des rayons qui partent de l'impact en zigzaguant, des anneaux brisés, un cratère clair. */
function fissures(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  ix: number,
  iy: number,
  k: number,
): void {
  const R = Math.hypot(W, H);
  for (const [couleur, epais] of [
    ['#05060a', 3],
    ['#e8f2ff', 1],
  ] as [string, number][]) {
    g.strokeStyle = couleur;
    g.lineWidth = epais;
    g.beginPath();
    for (let i = 0; i < NB_RAYONS; i++) {
      const a = angle(i);
      const long = R * (0.6 + 0.4 * h(i + 310)) * k;
      let x = ix;
      let y = iy;
      g.moveTo(x, y);
      for (let d = 0; d < long; d += 14) {
        const da = (h(i * 40 + d) - 0.5) * 0.35;
        x += Math.cos(a + da) * 14;
        y += Math.sin(a + da) * 14;
        g.lineTo(x, y);
        // des branches secondaires
        if (d % 56 === 28 && h(i * 90 + d) > 0.4) {
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a + 0.9) * 16 * h(d + i), y + Math.sin(a + 0.9) * 16 * h(d + i));
          g.moveTo(x, y);
        }
      }
    }
    // les anneaux brisés autour de l'impact
    for (const r of [16, 34, 58, 92]) {
      if (r > R * k * 0.4) continue;
      for (let i = 0; i < NB_RAYONS; i++) {
        if (h(i + r) < 0.35) continue;
        const a0 = angle(i);
        const a1 = angle(i + 1);
        g.moveTo(ix + Math.cos(a0) * r, iy + Math.sin(a0) * r);
        g.lineTo(ix + Math.cos((a0 + a1) / 2) * r * 0.95, iy + Math.sin((a0 + a1) / 2) * r * 0.95);
        g.lineTo(ix + Math.cos(a1) * r, iy + Math.sin(a1) * r);
      }
    }
    g.stroke();
  }
  // le cratère de l'impact : étoile sombre et lueur
  px(g, ix - 3, iy - 3, 6, 6, '#05060a');
  g.globalAlpha = 0.5 * (1 - k);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(ix, iy, 16, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

/** Les éclats de vitre : chaque morceau entre deux fissures reprend l'image du jeu, un peu décalée et penchée. */
function eclats(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  ix: number,
  iy: number,
  photoJeu: HTMLCanvasElement,
  k: number,
): void {
  if (k <= 0) return;
  const R = Math.hypot(W, H);
  const echelle = g.getTransform().a;
  for (let i = 0; i < NB_RAYONS; i++) {
    const a0 = angle(i);
    const a1 = angle(i + 1) + (i === NB_RAYONS - 1 ? Math.PI * 2 : 0);
    const am = (a0 + a1) / 2;
    const morceau = new Path2D();
    morceau.moveTo(ix, iy);
    morceau.lineTo(ix + Math.cos(a0) * R, iy + Math.sin(a0) * R);
    morceau.lineTo(ix + Math.cos(am) * R * 1.2, iy + Math.sin(am) * R * 1.2);
    morceau.lineTo(ix + Math.cos(a1) * R, iy + Math.sin(a1) * R);
    morceau.closePath();
    const dx = Math.cos(am) * (1 + 4 * h(i + 320)) * k;
    const dy = Math.sin(am) * (1 + 4 * h(i + 320)) * k;
    const rot = (h(i + 330) - 0.5) * 0.03 * k;
    g.save();
    g.clip(morceau);
    g.fillStyle = '#04050b';
    g.fillRect(0, 0, W, H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate((ix + dx) * echelle, (iy + dy) * echelle);
    g.rotate(rot);
    g.translate(-ix * echelle, -iy * echelle);
    g.drawImage(photoJeu, 0, 0);
    g.restore();
  }
}

/** Le bug de l'image : bandes décalées, neige, lignes qui défilent, de plus en plus fort jusqu'au plantage. */
function bug(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  photoJeu: HTMLCanvasElement,
  force: number,
  t: number,
): void {
  const echelle = g.getTransform().a;
  const n = 3 + Math.round(force * 12);
  for (let i = 0; i < n; i++) {
    const graine = Math.floor(t * 18) * 31 + i;
    const y = Math.floor(h(graine) * H);
    const hb = 3 + Math.floor(h(graine + 1) * (8 + force * 28));
    const dx = (h(graine + 2) - 0.5) * (20 + force * 120);
    g.save();
    g.beginPath();
    g.rect(0, y, W, hb);
    g.clip();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(photoJeu, dx * echelle, 0);
    g.restore();
    if (h(graine + 3) > 0.55) {
      g.globalAlpha = 0.5;
      px(g, 0, y, W, hb, h(graine + 4) > 0.5 ? '#00e5ff' : '#ff2bd6');
      g.globalAlpha = 1;
    }
  }
  // la neige
  for (let i = 0; i < 40 + force * 260; i++) {
    const graine = Math.floor(t * 24) * 977 + i;
    g.globalAlpha = 0.6;
    const c = h(graine + 2);
    px(
      g,
      h(graine) * W,
      h(graine + 1) * H,
      2 + (c > 0.9 ? 2 : 0),
      1 + (c > 0.9 ? 1 : 0),
      c > 0.5 ? '#ffffff' : '#000000',
    );
  }
  g.globalAlpha = 0.18 * force;
  g.fillStyle = '#0000ff';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
}
