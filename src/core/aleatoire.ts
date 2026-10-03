/** Générateur pseudo-aléatoire dans [0, 1[ : Math.random en jeu, graine fixe en test. */
export type Aleatoire = () => number;

/** Mulberry32 : petit générateur reproductible à partir d'une graine. */
export function graine(seed: number): Aleatoire {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const alea = (rng: Aleatoire, a: number, b: number): number => a + rng() * (b - a);

/** Approximation d'une loi normale centrée réduite (somme de trois uniformes). */
export const gauss = (rng: Aleatoire): number => (rng() + rng() + rng() - 1.5) / 0.75;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
