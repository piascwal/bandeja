import { ASCENSION_FIN_S, CHOC_S, FINALE_FIN_S, LUNE_FIN_S, type FinaleSuper } from './finale-super';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { ZoneBouton } from './ui';
import type { Vue } from './vue';

/** Un nombre pseudo-aléatoire entre 0 et 1, toujours le même pour le même n. */
const h = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Un mélange de deux couleurs #rrggbb. */
function melange(a: string, b: string, k: number): string {
  const x = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const m = (i: number) => Math.round(x(a, i) + (x(b, i) - x(a, i)) * k);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

/**
 * Un filtre de particules par-dessus tout l'écran pendant le choc et la montée :
 * braises (ou flocons, plumes, étincelles selon la variante) qui montent, voile
 * coloré, bords qui rougeoient, et pour l'éclair des flashs blancs.
 */
function filtre(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const k = f.t < 0.4 ? 1 : clamp01(1 - (f.t - 0.4) / 1.2);
  if (k <= 0) return;
  const couleur = COULEURS_SUPER[f.variante] ?? C.or;
  g.globalAlpha = 0.14 * k;
  g.fillStyle = couleur;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.3 * k;
  px(g, 0, 0, W, 4, couleur);
  px(g, 0, H - 4, W, 4, couleur);
  px(g, 0, 0, 4, H, couleur);
  px(g, W - 4, 0, 4, H, couleur);
  for (let i = 0; i < 110; i++) {
    const vitesse = 50 + h(i * 3 + 1) * 170;
    const x = h(i * 3) * W + Math.sin(f.t * 3 + i) * (f.variante === 3 ? 10 : 3);
    const y = H + 8 - ((f.t * vitesse + h(i * 3 + 2) * H * 1.2) % (H + 16));
    g.globalAlpha = (0.35 + 0.65 * h(i + f.t * 8 + 9) * (i % 3 === 0 ? 1 : 0.7)) * k;
    const taille = i % 5 === 0 ? 3 : i % 2 ? 2 : 1;
    const c = i % 4 === 0 ? '#ffffff' : i % 4 === 1 ? C.or : couleur;
    // les plumes du phénix et les flocons de la comète glissent de côté
    px(g, x, y, f.variante === 2 ? 1 : taille, f.variante === 4 ? 1 : taille + (f.variante === 3 ? 1 : 0), c);
  }
  if (f.variante === 4 && Math.floor(f.t * 30) % 6 === 0) {
    g.globalAlpha = 0.45 * k;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;
}

/** Le ciel qui s'assombrit, les étoiles, les nuages qui défilent et la balle qui monte en traînant le feu. */
function ascension(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const p = clamp01((f.t - CHOC_S) / (ASCENSION_FIN_S - CHOC_S));
  const entree = clamp01((f.t - CHOC_S) / 0.3);
  const couleur = COULEURS_SUPER[f.variante] ?? C.or;
  g.globalAlpha = entree;
  for (let y = 0; y < H; y += 6) {
    const niveau = y / H; // 0 en haut, 1 en bas
    g.fillStyle = melange('#000000', '#16408a', clamp01(niveau * (1.4 - p * 1.1)));
    g.fillRect(0, y, W, 6);
  }
  if (p > 0.35) {
    for (let i = 0; i < 50; i++) {
      g.globalAlpha = entree * clamp01((p - 0.35) * 2) * (0.4 + 0.6 * h(i + Math.floor(f.t * 6)));
      px(g, h(i) * W, h(i + 77) * H * 0.9, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1, '#ffffff');
    }
  }
  // des nuages qui défilent vers le bas, de plus en plus vite
  for (let i = 0; i < 8; i++) {
    const y = ((f.t * (90 + i * 30) + h(i) * H) % (H + 30)) - 10;
    g.globalAlpha = entree * (1 - p) * 0.5;
    px(g, h(i + 20) * W, y, 26 + h(i + 5) * 30, 5, '#cfe4ff');
  }
  // les lignes de vitesse
  for (let i = 0; i < 18; i++) {
    const x = h(i + 40) * W;
    const y = ((f.t * 600 + h(i) * H) % (H + 40)) - 20;
    g.globalAlpha = entree * 0.55;
    px(g, x, y, 1, 14 + h(i + 3) * 18, '#ffffff');
  }
  // la balle : elle accélère en montant, avec sa traînée de feu
  const pos = (q: number): [number, number] => [
    W * 0.5 + Math.sin(q * 3.1) * (f.variante === 3 ? 22 : 8),
    H * 0.95 - q * q * H * 1.25,
  ];
  for (let i = 30; i >= 1; i--) {
    const q = Math.max(0, p - i * 0.012);
    const [x, y] = pos(q);
    const t = 1 - i / 30;
    g.globalAlpha = entree * (0.15 + 0.7 * t);
    const taille = Math.round(2 + 6 * t);
    px(g, x - taille / 2, y - taille / 2 + 4, taille, taille, t < 0.4 ? couleur : t < 0.8 ? C.or : '#ffffff');
  }
  const [bx, by] = pos(p);
  g.globalAlpha = entree * 0.5;
  px(g, bx - 8, by - 8, 16, 16, couleur);
  g.globalAlpha = entree;
  px(g, bx - 3, by - 3, 6, 6, C.contour);
  px(g, bx - 2, by - 2, 4, 4, C.balle);
  g.globalAlpha = 1;
}

/** La position de la balle sur la lune : chute lente, rebonds amortis (pesanteur faible), puis repos. */
function balleLune(tau: number, sol: number): { y: number; rebonds: number[] } {
  let y = -12;
  let vy = 0;
  const rebonds: number[] = [];
  const pas = 0.016;
  for (let t = 0; t < tau; t += pas) {
    vy += 62 * pas;
    y += vy * pas;
    if (y >= sol) {
      y = sol;
      if (vy > 12) {
        vy *= -0.5;
        rebonds.push(t);
      } else vy = 0;
    }
  }
  return { y, rebonds };
}

/** Le plan sur la lune : ciel étoilé, la Terre au loin, sol gris cratérisé, et la balle qui retombe doucement et s'immobilise. */
function lune(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const tau = f.t - ASCENSION_FIN_S;
  const couleur = COULEURS_SUPER[f.variante] ?? C.or;
  const fondu = f.t > LUNE_FIN_S ? clamp01(1 - (f.t - LUNE_FIN_S) / (FINALE_FIN_S - LUNE_FIN_S)) : 1;
  g.globalAlpha = fondu;
  g.fillStyle = '#02030a';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = fondu * (0.35 + 0.65 * h(i + Math.floor(f.t * 4)));
    px(g, h(i) * W, h(i + 77) * H * 0.7, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1, '#ffffff');
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
  // le sol de la lune : des bandes de gris de plus en plus sombres, des cratères
  const horizon = Math.round(H * 0.7);
  for (let y = horizon; y < H; y += 4) {
    g.fillStyle = melange('#b9b9c6', '#6a6a7c', (y - horizon) / (H - horizon));
    g.fillRect(0, y, W, 4);
  }
  px(g, 0, horizon - 1, W, 1, '#e8e8f4');
  for (let i = 0; i < 9; i++) {
    const cx = h(i + 100) * W;
    const cy = horizon + 6 + h(i + 130) * (H - horizon - 12);
    const r = 5 + h(i + 160) * 12;
    g.fillStyle = 'rgba(40,40,56,0.55)';
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.38, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(235,235,250,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, cy - 1, r, r * 0.38, 0, Math.PI, Math.PI * 2);
    g.stroke();
  }
  // la balle
  const bx = Math.round(W * 0.62);
  const sol = Math.round(H * 0.8);
  const { y, rebonds } = balleLune(Math.max(0, tau), sol);
  const repos = tau > 2.2;
  // de la poussière à chaque rebond
  for (const r of rebonds) {
    const age = tau - r;
    if (age > 0.7) continue;
    for (let i = 0; i < 12; i++) {
      const dir = h(i + r * 10) * 2 - 1;
      g.globalAlpha = fondu * (1 - age / 0.7) * 0.8;
      px(g, bx + dir * age * 55, sol + 4 - Math.abs(dir) * age * 14, 2, 1, '#c8c8d6');
    }
  }
  g.globalAlpha = fondu * (0.25 + 0.2 * Math.sin(f.t * 8));
  px(g, bx - 10, y - 10, 20, 20, couleur);
  g.globalAlpha = fondu;
  px(g, bx - 4, sol + 7, 9, 2, 'rgba(0,0,0,0.5)');
  px(g, bx - 4, y - 4, 8, 8, C.contour);
  px(g, bx - 3, y - 3, 6, 6, C.balle);
  px(g, bx - 3, y - 3, 2, 2, '#f8ffc0');
  if (repos) {
    // la balle s'est posée : elle brille, une étoile scintille au-dessus
    const k = 0.5 + 0.5 * Math.sin(f.t * 6);
    g.globalAlpha = fondu * k;
    px(g, bx - 1, y - 16, 2, 8, '#ffffff');
    px(g, bx - 5, y - 13, 10, 2, '#ffffff');
  }
  g.globalAlpha = 1;
}

/**
 * Le bandeau de la fin d'un super coup : les trois temps (choc, ascension, lune)
 * et le filtre de particules. Renvoie vrai si l'écran est caché par une scène
 * plein cadre ; un appui passe la scène.
 */
export function dessineFinale(v: Vue, f: FinaleSuper, zones: ZoneBouton[], onPasse: () => void): void {
  if (!f.actif) return;
  const { g, W, H } = v;
  if (f.t >= ASCENSION_FIN_S) lune(v, f);
  else if (f.t >= CHOC_S) ascension(v, f);
  filtre(v, f);
  // la barre noire de cinéma, en haut et en bas
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, 6);
  g.fillRect(0, H - 6, W, 6);
  zones.push({ x: 0, y: 0, w: W, h: H, act: onPasse });
}
