import { ASCENSION_FIN_S, CHOC_S, type FinaleSuper } from './finale-super';
import { clamp01, h, melange } from './finale-outils';
import { lune } from './lune';
import { orbite } from './finale-orbite';
import { volcan } from './finale-volcan';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { ZoneBouton } from './ui';
import type { Vue } from './vue';

/**
 * Un filtre de particules par-dessus tout l'écran pendant le choc et la montée :
 * braises qui montent, voile coloré, bords qui rougeoient.
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
    const x = h(i * 3) * W + Math.sin(f.t * 3 + i) * 3;
    const y = H + 8 - ((f.t * vitesse + h(i * 3 + 2) * H * 1.2) % (H + 16));
    g.globalAlpha = (0.35 + 0.65 * h(i + f.t * 8 + 9) * (i % 3 === 0 ? 1 : 0.7)) * k;
    const taille = i % 5 === 0 ? 3 : i % 2 ? 2 : 1;
    const c = i % 4 === 0 ? '#ffffff' : i % 4 === 1 ? C.or : couleur;
    px(g, x, y, taille, taille, c);
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
  // elle garde le cap pris au rebond : elle penche du côté où elle partait (30° au plus)
  const depart = Math.max(W * 0.25, Math.min(W * 0.75, f.x));
  const pos = (q: number): [number, number] => {
    const montee = q * q * H * 1.25;
    return [depart + f.cap * 0.58 * montee, H * 0.95 - montee];
  };
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

/**
 * Le bandeau de la fin d'un super coup : les trois temps (choc, ascension, lune)
 * et le filtre de particules. Renvoie vrai si l'écran est caché par une scène
 * plein cadre ; un appui passe la scène.
 */
export function dessineFinale(v: Vue, f: FinaleSuper, zones: ZoneBouton[], onPasse: () => void): void {
  if (!f.actif) return;
  const { g, W, H } = v;
  // le volcan plonge dans la Terre au lieu de monter ; l'orbite monte comme les autres puis tourne autour de la Terre
  if (f.variante === 2 && f.t >= CHOC_S) volcan(v, f);
  else if (f.t >= ASCENSION_FIN_S) (f.variante === 3 ? orbite : lune)(v, f);
  else if (f.t >= CHOC_S) ascension(v, f);
  filtre(v, f);
  // la barre noire de cinéma, en haut et en bas
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, 6);
  g.fillRect(0, H - 6, W, 6);
  zones.push({ x: 0, y: 0, w: W, h: H, act: onPasse });
}
