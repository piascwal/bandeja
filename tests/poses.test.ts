import { describe, expect, it } from 'vitest';
import { executeCoup } from '@core/coups';
import { xProf } from '@core/terrain';
import type { Balle, Coup } from '@core/types';
import { partieTest } from './outils';

/** Le coup `type` joué sur une balle à la hauteur z ; renvoie la pose du joueur juste après. */
function pose(type: Coup, z: number, superCoup = 0): string {
  const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
  const s = jeu.joueurs[0]!;
  s.x = 7;
  s.y = 5;
  jeu.phase = 'jeu';
  const balle: Partial<Balle> = { x: 7.3, y: 5, z, vx: -3, vy: 0, vz: 0, camp: 0, sol: 0, coup: 'lobe' };
  Object.assign(jeu.balle, balle);
  executeCoup(jeu, s, type, 0.9, xProf(1, 3), 5, null, { precision: 1, charge: 1, super: superCoup });
  return s.poseCoup;
}

describe('les poses des coups aériens', () => {
  it('le smash et les super coups décollent : le sprite aux pieds en l’air', () => {
    expect(pose('smash', 2.6)).toBe('smash2');
    for (const v of [1, 2, 3, 4]) expect(pose('smash', 1.2, v)).toBe('smash2');
  });

  it('la bandeja et la víbora gardent la pose d’armé, les deux pieds au sol', () => {
    expect(pose('bandeja', 2.6)).toBe('smash1');
    expect(pose('vibora', 2.6)).toBe('smash1');
  });

  it('un coup bas garde la pose normale', () => {
    expect(pose('plat', 1)).toBe('attente');
    expect(pose('bandeja', 1)).toBe('attente');
  });
});
