export type Rgb = [number, number, number];

export const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Écrit un pixel dans un tampon RGBA. */
export function pose(d: Uint8ClampedArray, i: number, c: Rgb, a = 255): void {
  d[i] = c[0];
  d[i + 1] = c[1];
  d[i + 2] = c[2];
  d[i + 3] = a;
}
