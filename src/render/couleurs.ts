/** RVB (0-255) → TSL : teinte en degrés, saturation et luminosité entre 0 et 1. */
export function rgbHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** TSL → RVB (0-255). */
export function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/**
 * Le rouge franc du dessin d'origine (maillot, casquette, short, chaussures,
 * cadre de la pala) ; la peau, plus orangée et moins saturée, n'est pas touchée.
 */
export function estRougeEquipe(h: number, s: number, l: number): boolean {
  return (h < 4.5 || h > 330) && s > 0.6 && l > 0.12 && l < 0.85;
}

/** Recolore en place les pixels rouges d'un tampon RGBA vers la teinte donnée. */
export function recoloreTampon(d: Uint8ClampedArray, teinte: number): void {
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, l] = rgbHsl(d[i]!, d[i + 1]!, d[i + 2]!);
    if (!estRougeEquipe(h, s, l)) continue;
    const [r, g, b] = hslRgb(teinte, s, Math.min(1, l * 1.05));
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}
