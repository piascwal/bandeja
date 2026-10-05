/** Un nombre pseudo-aléatoire entre 0 et 1, toujours le même pour le même n. */
export const h = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Un mélange de deux couleurs #rrggbb. */
export function melange(a: string, b: string, k: number): string {
  const x = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const m = (i: number) => Math.round(x(a, i) + (x(b, i) - x(a, i)) * k);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}
