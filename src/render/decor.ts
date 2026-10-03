import { clamp } from '@core/aleatoire';
import { LARG, LONG, MIL, SERV } from '@core/constants';
import { construitDevant, construitMurs } from './decor-murs';
import { EQUIPES, PEAUX } from './palette';
import { hex, pose } from './pixels';
import { canvas } from './primitives';
import type { Projection } from './projection';

/** Le décor, calculé une fois par taille d'écran : net au pixel près. */
export interface Decor {
  /** la foule des gradins : deux images alternées quand elle saute */
  foule: [HTMLCanvasElement, HTMLCanvasElement];
  terrain: HTMLCanvasElement;
  murs: HTMLCanvasElement;
  /** la vitre et le grillage de devant, dessinés par-dessus les joueurs */
  devant: HTMLCanvasElement;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const GAZON = ['#163f86', '#1d4f9c', '#2459ad', '#2a63bd', '#3170c9'].map(hex);
const SOLEXT = ['#151a2b', '#1b2134', '#21283d'].map(hex);
const LIGNE = hex('#eef3ff');

export function construitDecor(K: Projection, W: number, H: number): Decor {
  return {
    foule: construitFoule(K, W, H),
    terrain: construitTerrain(K, W, H),
    murs: construitMurs(K, W, H),
    devant: construitDevant(K, W, H),
  };
}

function construitFoule(K: Projection, W: number, H: number): [HTMLCanvasElement, HTMLCanvasElement] {
  const couleurs = [
    EQUIPES[0].maillot,
    EQUIPES[0].fonce,
    EQUIPES[1].maillot,
    EQUIPES[1].fonce,
    '#e8e8f0',
    '#f2c14e',
    '#5b6b8c',
    '#3b3f5c',
  ];
  const hasard = <T>(t: readonly T[]): T => t[Math.floor(Math.random() * t.length)]!;
  const gens: { x: number; y: number; c: string; p: string; s: number }[] = [];
  for (let y = 1; y < K.yF + 4; y += 5) {
    for (let x = 1 + ((y / 5) & 1) * 2; x < W; x += 4) {
      if (Math.random() < 0.14) continue;
      gens.push({
        x: x + Math.floor(Math.random() * 2) - 1,
        y,
        c: hasard(couleurs),
        p: hasard(PEAUX),
        s: Math.random(),
      });
    }
  }
  const images = [0, 1].map((f) => {
    const [c, x] = canvas(W, H);
    x.fillStyle = '#0d1126';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#141a36';
    for (let y = 0; y < H; y += 5) x.fillRect(0, y + 4, W, 1);
    for (const p of gens) {
      const saute = f === 1 && p.s > 0.35 ? -1 : 0;
      x.fillStyle = p.c;
      x.fillRect(p.x, p.y + 2 + saute, 3, 3);
      x.fillStyle = p.p;
      x.fillRect(p.x + 1, p.y + saute, 2, 2);
      if (f === 1 && p.s > 0.8) {
        // les bras levés
        x.fillRect(p.x - 1, p.y - 1 + saute, 1, 2);
        x.fillRect(p.x + 3, p.y - 1 + saute, 1, 2);
      }
    }
    x.fillStyle = 'rgba(6,8,22,0.45)';
    x.fillRect(0, 0, W, H);
    // projecteurs
    for (const lx of [0.12, 0.38, 0.62, 0.88]) {
      x.fillStyle = '#3a4160';
      x.fillRect(Math.round(W * lx) - 4, 3, 9, 3);
      x.fillStyle = '#fff6d0';
      x.fillRect(Math.round(W * lx) - 3, 4, 7, 1);
    }
    return c;
  });
  return [images[0]!, images[1]!];
}

/** Le sol : gazon bleu éclairé par les projecteurs, lignes blanches, et le sol de la salle autour. */
function construitTerrain(K: Projection, W: number, H: number): HTMLCanvasElement {
  const [c, x] = canvas(W, H);
  const img = x.createImageData(W, H);
  const d = img.data;
  const pyM = (K.yN - K.yF) / LARG; // pixels par mètre en profondeur
  for (let sy = 0; sy < H; sy++) {
    const t = (sy + 0.5 - K.yF) / (K.yN - K.yF);
    if (t < 0) continue;
    const k = K.kF + (K.kN - K.kF) * t;
    for (let sx = 0; sx < W; sx++) {
      const i = (sy * W + sx) * 4;
      const mx = MIL - (sx + 0.5 - K.cx) / k;
      const my = LARG * t;
      const bay = (BAYER[(sy & 3) * 4 + (sx & 3)]! + 0.5) / 16;
      if (t > 1 || mx < 0 || mx > LONG) {
        const v = 0.9 + 0.12 * Math.sin(sx * 0.31 + sy * 0.7);
        pose(d, i, SOLEXT[Math.min(2, Math.floor(v + bay))]!);
        continue;
      }
      const ligne =
        Math.abs(mx - (MIL - SERV)) < 0.5 / k ||
        Math.abs(mx - (MIL + SERV)) < 0.5 / k ||
        (Math.abs(my - 5) < 0.55 / pyM && mx > MIL - SERV - 0.2 && mx < MIL + SERV + 0.2);
      if (ligne) {
        pose(d, i, LIGNE);
        continue;
      }
      // éclairage des projecteurs, ombre au pied des murs, un peu de grain
      let l =
        0.55 +
        0.25 * Math.exp(-((mx - 5) ** 2 + (my - 4) ** 2) / 30) +
        0.25 * Math.exp(-((mx - 15) ** 2 + (my - 4) ** 2) / 30);
      l -= 0.3 * Math.max(0, 1 - Math.min(mx, LONG - mx, my) / 0.7);
      const hsh = Math.sin(sx * 12.9898 + sy * 78.233) * 43758.5453;
      l += (hsh - Math.floor(hsh) - 0.5) * 0.14;
      const v = clamp(l, 0, 0.999) * (GAZON.length - 1);
      const kk = Math.floor(v);
      pose(d, i, GAZON[Math.min(GAZON.length - 1, v - kk > bay ? kk + 1 : kk)]!);
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
