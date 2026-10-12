import { describe, expect, it } from 'vitest';
import { graine } from '@core/aleatoire';
import { PAS } from '@core/constants';
import { executeCoup } from '@core/coups';
import { pas } from '@core/partie';
import { VARIANTES_SUPER, varianteSuper } from '@core/super-coup';
import { xProf } from '@core/terrain';
import { nouvelleBalle } from '@core/balle';
import { partieTest } from './outils';

describe('rotation des animations de super coup', () => {
  const choisit = (vus: number[], rng: () => number) => {
    const v = varianteSuper(nouvelleBalle(), 5, rng, vus);
    vus[v]!++;
    return v;
  };

  it('toutes les animations passent avant qu’une revienne, et ainsi de suite', () => {
    const rng = graine(3);
    const vus = Array.from({ length: 8 }, () => 0);
    for (let tour = 0; tour < 5; tour++) {
      const bloc = Array.from({ length: VARIANTES_SUPER.length }, () => choisit(vus, rng));
      expect([...bloc].sort()).toEqual([...VARIANTES_SUPER]);
    }
    expect(vus.slice(1)).toEqual(VARIANTES_SUPER.map(() => 5));
  });

  it('ne choisit que parmi les moins jouées, au hasard', () => {
    const rng = graine(8);
    const vus = [0, 2, 1, 1, 2, 1, 2, 1];
    const sortis = new Set<number>();
    for (let i = 0; i < 200; i++) sortis.add(varianteSuper(nouvelleBalle(), 5, rng, vus));
    expect([...sortis].sort()).toEqual([2, 3, 5, 7]);
  });

  it('un super coup qui gagne le point compte pour son animation, dans la partie en cours seulement', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    expect(jeu.superVus.every((n) => n === 0)).toBe(true);
    const s = jeu.joueurs[0]!;
    s.x = 6;
    s.y = 5;
    jeu.phase = 'jeu';
    Object.assign(jeu.balle, { x: 6.3, y: 5, z: 2.5, vx: -1, vy: 0, vz: 0, camp: 0, sol: 1, coup: 'plat' });
    executeCoup(jeu, s, 'plat', 1, xProf(1, 3), 5, null, { super: 6, precision: 1, charge: 1 });
    jeu.parade = null;
    for (let i = 0; i < 240 * 4; i++) {
      pas(jeu, PAS);
      jeu.evenements.length = 0;
    }
    expect(jeu.superVus[6]).toBe(1);
    expect(jeu.superVus.reduce((a, n) => a + n, 0)).toBe(1);
    expect(partieTest({ mode: 'match', sieges: [0] }, 12).superVus[6]).toBe(0);
  });
});
