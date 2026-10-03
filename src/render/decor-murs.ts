import { clamp } from '@core/aleatoire';
import { HAUT_GRILLE_FOND, HAUT_VITRE, LARG, LONG, MIL, VITRE_COTE } from '@core/constants';
import { filetH } from '@core/terrain';
import { C } from './palette';
import { hex, pose } from './pixels';
import { canvas } from './primitives';
import type { Projection } from './projection';

const POTEAU = hex('#2a3346');
const RAIL = hex('#4a5672');
const VITRE = hex('#bfe6ff');
const REFLET = hex('#ffffff');
const MAILLE = hex('#3e4a60');

/** Peint un pixel de mur. u : abscisse le long du mur (m), z : hauteur (m). */
function peintMur(
  d: Uint8ClampedArray,
  i: number,
  sx: number,
  sy: number,
  u: number,
  z: number,
  haut: number,
  vitre: boolean,
  alpha: number,
): void {
  if (Math.abs(z - haut) < 0.09 || (vitre && Math.abs(z - HAUT_VITRE) < 0.09 && haut > HAUT_VITRE)) {
    pose(d, i, RAIL, 255 * alpha);
    return;
  }
  if (Math.abs(u - Math.round(u / 2) * 2) < 0.06) {
    pose(d, i, POTEAU, 235 * alpha);
    return;
  }
  if (vitre && z <= HAUT_VITRE) {
    const reflet = (sx + 2 * sy) % 31;
    if (reflet < 2 || reflet === 5) pose(d, i, REFLET, 90 * alpha);
    else pose(d, i, VITRE, 40 * alpha);
  } else if (((sx + sy) & 3) === 0 || ((sx - sy) & 3) === 0) pose(d, i, MAILLE, 230 * alpha);
}

/** Les murs du fond et des bouts (vitres, grillages, poteaux) et le filet. */
export function construitMurs(K: Projection, W: number, H: number): HTMLCanvasElement {
  const [c, x] = canvas(W, H);
  const im = x.createImageData(W, H);
  const d = im.data;
  for (let sy = 0; sy < H; sy++) {
    for (let sx = 0; sx < W; sx++) {
      const i = (sy * W + sx) * 4;
      const fx = sx + 0.5;
      const fy = sy + 0.5;
      // mur latéral du fond (y = 0)
      const mx = MIL - (fx - K.cx) / K.kF;
      const mz = (K.yF - fy) / ((K.kz * K.kF) / K.kN);
      if (mx >= 0 && mx <= LONG && mz >= 0 && mz <= HAUT_VITRE) {
        peintMur(d, i, sx, sy, mx, mz, HAUT_VITRE, mx < VITRE_COTE || mx > LONG - VITRE_COTE, 1);
      }
      // vitres des deux bouts (x = 0 et x = 20), grillage au-dessus jusqu'à 4 m
      for (const bout of [0, 1]) {
        const k = bout ? (fx - K.cx) / MIL : (K.cx - fx) / MIL;
        const t = (k - K.kF) / (K.kN - K.kF);
        if (t < 0 || t > 1) continue;
        const z = (K.yF + t * (K.yN - K.yF) - fy) / ((K.kz * k) / K.kN);
        if (z >= 0 && z <= HAUT_GRILLE_FOND) peintMur(d, i, sx, sy, t * LARG, z, HAUT_GRILLE_FOND, true, 1);
      }
    }
  }
  x.putImageData(im, 0, 0);
  dessineFilet(K, x);
  return c;
}

/** Le filet, vu de profil : une bande au centre entre ses deux poteaux. */
function dessineFilet(K: Projection, x: CanvasRenderingContext2D): void {
  const [, hF] = K.proj(MIL, 0, filetH(0));
  const [, hN] = K.proj(MIL, LARG, filetH(LARG));
  const [, bF] = K.proj(MIL, 0, 0);
  for (let sy = Math.round(hF); sy < K.yN; sy++) {
    const t = clamp((sy - bF) / (K.yN - bF), 0, 1);
    if (sy < hF + (hN - hF) * t) continue;
    x.fillStyle = sy & 1 ? 'rgba(20,24,36,0.9)' : 'rgba(200,210,230,0.55)';
    x.fillRect(K.cx - 1, sy, 3, 1);
  }
  x.fillStyle = '#f3f5fb';
  x.fillRect(K.cx - 1, Math.round(hF), 3, 1);
  for (const [y, h] of [
    [0, hF],
    [LARG, hN],
  ] as const) {
    const [px, py] = K.proj(MIL, y, 0);
    x.fillStyle = C.contour;
    x.fillRect(Math.round(px) - 2, Math.round(h) - 1, 5, Math.round(py - h) + 2);
    x.fillStyle = '#c9cfe0';
    x.fillRect(Math.round(px) - 1, Math.round(h), 3, Math.round(py - h));
  }
}

/** La vitre et le grillage de devant (y = 10), en transparence par-dessus les joueurs. */
export function construitDevant(K: Projection, W: number, H: number): HTMLCanvasElement {
  const [c, x] = canvas(W, H);
  const id = x.createImageData(W, H);
  for (let sy = 0; sy < H; sy++) {
    for (let sx = 0; sx < W; sx++) {
      const mx = MIL - (sx + 0.5 - K.cx) / K.kN;
      const z = (K.yN - sy - 0.5) / K.kz;
      if (mx < 0 || mx > LONG || z < 0 || z > HAUT_VITRE) continue;
      const i = (sy * W + sx) * 4;
      if (mx < VITRE_COTE || mx > LONG - VITRE_COTE)
        peintMur(id.data, i, sx, sy, mx, z, HAUT_VITRE, true, 0.45);
      else if (Math.abs(z - HAUT_VITRE) < 0.09 || Math.abs(mx - Math.round(mx / 2) * 2) < 0.05)
        pose(id.data, i, POTEAU, 120);
      else if ((((sx + sy) & 3) === 0 || ((sx - sy) & 3) === 0) && (sx & 1) === 0)
        pose(id.data, i, MAILLE, 75);
    }
  }
  x.putImageData(id, 0, 0);
  return c;
}
