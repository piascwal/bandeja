import { describe, expect, it } from 'vitest';
import { HAUT_GRILLE_FOND, LARG, LONG, MIL, PAS } from '@core/constants';
import { pas } from '@core/partie';
import { frappeurImmobile, partieTest, simule } from './outils';

describe('démo ordinateur contre ordinateur', () => {
  it('enchaîne services, échanges et points', () => {
    const jeu = partieTest();
    const evs = simule(jeu, 240);
    const points = evs.filter((e) => e.type === 'point');
    const frappes = evs.filter((e) => e.type === 'frappe');
    const services = evs.filter((e) => e.type === 'service');
    expect(services.length).toBeGreaterThan(6);
    expect(points.length).toBeGreaterThan(6); // des échanges plus longs qu’avant : moins de points
    // de vrais échanges : plus de frappes que de points
    expect(frappes.length).toBeGreaterThan(points.length);
    expect(evs.some((e) => e.type === 'impact' && e.surface === 'vitre')).toBe(true);
  });

  it('est reproductible avec la même graine', () => {
    const a = partieTest({}, 42);
    const b = partieTest({}, 42);
    simule(a, 60);
    simule(b, 60);
    expect(a.balle.x).toBe(b.balle.x);
    expect(a.pts).toEqual(b.pts);
    expect(a.jeux).toEqual(b.jeux);
  });

  it('garde joueurs et balle dans des positions valides', () => {
    const jeu = partieTest({}, 7);
    for (let i = 0; i < 120 / PAS; i++) {
      pas(jeu, PAS);
      jeu.evenements.length = 0;
      for (const s of jeu.joueurs) {
        expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
        expect(s.eq === 0 ? s.x < MIL : s.x > MIL).toBe(true);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(LARG);
      }
      const b = jeu.balle;
      expect(Number.isFinite(b.x) && Number.isFinite(b.z)).toBe(true);
      if (!b.dehors) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThanOrEqual(LONG);
        expect(b.z).toBeLessThan(HAUT_GRILLE_FOND + 20);
      }
    }
  });
});

describe('match', () => {
  it('se termine quand une équipe a ses jeux', () => {
    const jeu = partieTest({ mode: 'match', niveau: 2, jeux: 0 }, 3);
    const evs = simule(jeu, 1200, frappeurImmobile);
    const fin = evs.find((e) => e.type === 'finMatch');
    expect(fin).toBeDefined();
    expect(jeu.phase).toBe('fin');
    expect(Math.max(...jeu.jeux)).toBe(2);
  });
});
