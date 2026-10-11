import { canvas, px } from './primitives';

/**
 * Les décors de la scène du Titanic : le paquebot (dessiné une fois dans une image, puis découpé et incliné
 * en deux morceaux) et l'iceberg. Le repère du navire : sa poupe à gauche, sa ligne de flottaison en y = 0.
 */
export interface Navire {
  img: HTMLCanvasElement;
  /** longueur, hauteur au-dessus de l'eau (pixels) et part sous l'eau */
  L: number;
  haut: number;
  tirant: number;
}

let memo: Navire | null = null;

/** Le paquebot : coque noire à bande rouge, quatre cheminées jaunes, ponts blancs éclairés, deux mâts. */
export function navire(W: number): Navire {
  const L = Math.round(W * 0.46);
  if (memo && memo.L === L) return memo;
  const haut = Math.ceil(L * 0.43) + 2;
  const tirant = Math.ceil(L * 0.05) + 1;
  const [img, g] = canvas(L + 2, haut + tirant);
  g.translate(0, haut);
  const f = (k: number) => Math.round(k * L);
  // la coque, puis la peinture rouge sous la flottaison
  const coque = new Path2D();
  coque.moveTo(0, -f(0.11));
  coque.lineTo(f(0.9), -f(0.11));
  coque.lineTo(L, -f(0.15));
  coque.lineTo(f(0.965), 0);
  coque.lineTo(f(0.93), tirant);
  coque.lineTo(f(0.05), tirant);
  coque.lineTo(0, -f(0.03));
  coque.closePath();
  g.fillStyle = '#10131c';
  g.fill(coque);
  g.save();
  g.clip(coque);
  px(g, 0, 0, L, tirant, '#9a2a1a');
  g.restore();
  px(g, f(0.02), -f(0.105), f(0.9), 2, '#e9e9e9');
  for (let x = f(0.06); x < f(0.9); x += 5) {
    px(g, x, -f(0.075), 1, 1, '#ffd27a');
    px(g, x + 2, -f(0.045), 1, 1, '#ffd27a');
  }
  // les ponts : de plus en plus étroits, fenêtres allumées
  for (const [x0, x1, haute, basse] of [
    [0.16, 0.8, 0.17, 0.11],
    [0.21, 0.74, 0.22, 0.17],
    [0.3, 0.66, 0.26, 0.22],
  ] as [number, number, number, number][]) {
    px(g, f(x0), -f(haute), f(x1 - x0), f(haute - basse), '#efe8d8');
    px(g, f(x0), -f(haute), f(x1 - x0), 1, '#ffffff');
    px(g, f(x0), -f(basse) - 1, f(x1 - x0), 1, '#b8ab90');
    for (let x = f(x0) + 3; x < f(x1) - 2; x += 4) px(g, x, -f(haute) + 3, 1, 2, '#ffd27a');
  }
  // les quatre cheminées, légèrement penchées vers l'arrière, noires au sommet
  for (const c of [0.3, 0.42, 0.54, 0.66]) {
    const w = Math.max(5, f(0.05));
    const x = f(c) - Math.round(w / 2);
    for (let y = 0; y < f(0.15); y++) {
      const dec = Math.round(y * 0.08);
      px(g, x - dec, -f(0.26) - y, w, 1, y > f(0.12) ? '#0c0c10' : '#d9a441');
      if (y <= f(0.12)) {
        px(g, x - dec, -f(0.26) - y, 1, 1, '#f0c66a');
        px(g, x - dec + w - 2, -f(0.26) - y, 2, 1, '#a97a22');
      }
    }
  }
  // les mâts, avec la hune de veille
  px(g, f(0.85), -f(0.32), 1, f(0.21), '#cfcfcf');
  px(g, f(0.85) - 1, -f(0.27), 3, 2, '#8a8a99');
  px(g, f(0.12), -f(0.25), 1, f(0.14), '#cfcfcf');
  memo = { img, L, haut, tirant };
  return memo;
}

/** Le contour déchiré de la coque par où elle se casse : x (relatif à la cassure) selon la hauteur y. */
export function dechirure(y: number, L: number): number {
  return Math.round(Math.sin(y * 0.9) * 0.012 * L + (Math.floor(y / 4) % 2 ? 0.01 * L : -0.01 * L));
}

/** Le chemin de découpe d'une moitié du navire, de part et d'autre de la cassure en `xb` (repère de l'image). */
export function moitie(n: Navire, xb: number, cote: 'poupe' | 'proue'): Path2D {
  const p = new Path2D();
  const bas = n.tirant + 2;
  const haut = n.haut + 2;
  const loin = cote === 'poupe' ? -4 : n.L + 6;
  p.moveTo(loin, -haut);
  for (let y = -haut; y <= bas; y += 3) p.lineTo(xb + dechirure(y, n.L), y);
  p.lineTo(loin, bas);
  p.closePath();
  return p;
}

/** L'iceberg : sommet blanc, faces claires à gauche et sombres à droite, immergé en bleu. (cx, base) au pied. */
export function glacon(g: CanvasRenderingContext2D, W: number, H: number, cx: number, base: number): void {
  const pts = (l: [number, number][]) => {
    const p = new Path2D();
    l.forEach(([x, y], i) => (i ? p.lineTo(cx + x * W, base + y * H) : p.moveTo(cx + x * W, base + y * H)));
    p.closePath();
    return p;
  };
  g.globalAlpha = 0.4;
  g.fillStyle = '#5ec0e8';
  g.fill(
    pts([
      [-0.16, 0],
      [-0.11, 0.1],
      [-0.03, 0.15],
      [0.07, 0.12],
      [0.15, 0.05],
      [0.17, 0],
    ]),
  );
  g.globalAlpha = 1;
  const contour: [number, number][] = [
    [-0.115, 0],
    [-0.095, -0.06],
    [-0.07, -0.12],
    [-0.045, -0.19],
    [-0.02, -0.28],
    [0, -0.32],
    [0.02, -0.25],
    [0.05, -0.2],
    [0.065, -0.14],
    [0.09, -0.08],
    [0.12, 0],
  ];
  g.fillStyle = '#d8ecfa';
  g.fill(pts(contour));
  g.fillStyle = '#f7fcff';
  g.fill(
    pts([
      [-0.115, 0],
      [-0.095, -0.06],
      [-0.07, -0.12],
      [-0.045, -0.19],
      [-0.02, -0.28],
      [0, -0.32],
      [0, -0.12],
      [-0.03, 0],
    ]),
  );
  g.fillStyle = '#8fb6d0';
  g.fill(
    pts([
      [0, -0.32],
      [0.02, -0.25],
      [0.05, -0.2],
      [0.065, -0.14],
      [0.09, -0.08],
      [0.12, 0],
      [0.03, 0],
      [0, -0.12],
    ]),
  );
}
