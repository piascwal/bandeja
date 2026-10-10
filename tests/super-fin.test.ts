import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { executeCoup } from '@core/coups';
import { pas } from '@core/partie';
import { xProf } from '@core/terrain';
import type { Balle } from '@core/types';
import { partieTest } from './outils';

/** Un joueur de l'équipe 0 en place, la balle posée là où on veut. */
function situation(balle: Partial<Balle>, x = 2) {
  const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
  const s = jeu.joueurs[0]!;
  s.x = x;
  s.y = 5;
  jeu.phase = 'jeu';
  Object.assign(jeu.balle, {
    x: x + 0.3,
    y: 5,
    z: 1,
    vx: -1,
    vy: 0,
    vz: 0,
    camp: 0,
    sol: 1,
    coup: 'plat',
    ...balle,
  });
  return { jeu, s };
}

describe('la fin spectaculaire des super coups', () => {
  /** Joue un super coup et suit la balle pendant 4 s : sa hauteur maximale, si elle sort, sa vitesse maximale. */
  function fin(variante: number, balle: Partial<Balle>, x: number) {
    const { jeu, s } = situation(balle, x);
    executeCoup(jeu, s, 'plat', 1, xProf(1, 3), 5, null, { super: variante, precision: 1, charge: 1 });
    jeu.parade = null; // la parade ratée : le super coup file
    const sortie = { zMax: 0, dehors: false, vitesseMax: 0 };
    for (let i = 0; i < 240 * 4; i++) {
      pas(jeu, PAS);
      const b = jeu.balle;
      sortie.zMax = Math.max(sortie.zMax, b.z);
      sortie.dehors ||= b.dehors;
      sortie.vitesseMax = Math.max(sortie.vitesseMax, Math.hypot(b.vx, b.vy, b.vz));
      jeu.evenements.length = 0;
    }
    return sortie;
  }

  it('la météore s’écrase puis repart dans l’espace', () => {
    const r = fin(1, { z: 2.5 }, 6);
    expect(r.zMax).toBeGreaterThan(40);
  });

  it('le volcan perfore le court : pas de rebond, la balle s’enfonce et le point est pour celui qui frappe', () => {
    const { jeu, s } = situation({ z: 2.5 }, 8.5);
    executeCoup(jeu, s, 'plat', 1, xProf(1, 3), 5, null, { super: 2, precision: 1, charge: 1 });
    jeu.parade = null;
    let monte = 0;
    let raison = '';
    for (let i = 0; i < 240 * 4 && jeu.phase === 'jeu'; i++) {
      pas(jeu, PAS);
      if (jeu.balle.sol >= 1) monte = Math.max(monte, jeu.balle.vz, jeu.balle.z);
      for (const e of jeu.evenements.splice(0)) if (e.type === 'point') raison = e.raison;
    }
    expect(raison).toBe('VOLCAN !');
    expect(jeu.gagnant).toBe(0);
    expect(jeu.balle.dehors).toBe(true);
    expect(monte).toBeLessThan(0.5); // aucun rebond
  });

  it('l’orbite rebondit très haut et très vite, comme la météore', () => {
    expect(fin(3, { z: 2.5 }, 2).zMax).toBeGreaterThan(40);
  });

  it('aucun super coup n’est lent : de la frappe à la sortie, la balle file', () => {
    for (const [v, balle, x] of [
      [1, { z: 2.5 }, 6],
      [2, { z: 2.5 }, 8.5],
      [3, { z: 2.5 }, 2],
    ] as [number, Partial<Balle>, number][])
      expect(fin(v, balle, x).vitesseMax, `variante ${v}`).toBeGreaterThan(35);
  });
});
