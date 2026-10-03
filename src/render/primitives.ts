export function px(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  col: string,
): void {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

export function disque(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string): void {
  g.fillStyle = col;
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
    g.fillRect(icx - w, icy + dy, w * 2 + 1, 1);
  }
}

/** Cercle d'un pixel (ou plus) d'épaisseur ; part < 1 n'en trace qu'une portion, depuis le haut. */
export function anneau(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  col: string,
  part = 1,
  epais = 1,
): void {
  g.fillStyle = col;
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const n = Math.ceil(r * 8);
  for (let i = 0; i < n * part; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    for (let k = 0; k < epais; k++) {
      g.fillRect(Math.round(icx + Math.cos(a) * (r - k)), Math.round(icy + Math.sin(a) * (r - k)), 1, 1);
    }
  }
}

/** Petite croix en losange posée au sol (repère du rebond, cible du service). */
export function croixSol(g: CanvasRenderingContext2D, sx: number, sy: number, col: string): void {
  for (let k = -2; k <= 2; k++) {
    px(g, sx + k, sy + k * 0.5, 1, 1, col);
    px(g, sx + k, sy - k * 0.5, 1, 1, col);
  }
}

/** Crée un canvas hors écran de la taille demandée. */
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Copie retournée horizontalement (pour un dessin tourné vers la gauche). */
export function miroir(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, x] = canvas(src.width, src.height);
  x.translate(c.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}
