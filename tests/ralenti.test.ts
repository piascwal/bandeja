import { describe, expect, it } from 'vitest';
import { DUREE_POINT, DUREE_POINT_RALENTI, PAS } from '@core/constants';
import { pas } from '@core/partie';
import { Ralenti } from '../src/app/ralenti';
import { partieTest } from './outils';

describe('ralenti des points', () => {
  it("un échange court garde l'annonce normale, un long l'allonge", () => {
    const jeu = partieTest({ mode: 'match', jeux: 3, sieges: [] }, 7);
    const durees = new Set<number>();
    let phase = jeu.phase;
    for (let i = 0; i < 60 / PAS; i++) {
      pas(jeu, PAS);
      if (jeu.phase === 'point' && phase !== 'point') durees.add(jeu.dureePoint);
      phase = jeu.phase;
      jeu.evenements.length = 0;
    }
    expect([...durees].every((d) => d === DUREE_POINT || d === DUREE_POINT_RALENTI)).toBe(true);
    expect(durees.has(DUREE_POINT_RALENTI)).toBe(true);
  });

  it('le rejeu part après le point, se termine et ne se relance pas pour le même point', () => {
    const jeu = partieTest({ mode: 'match', jeux: 3, sieges: [] }, 7);
    const r = new Ralenti();
    let debuts = 0;
    let etait = false;
    let pointsLongs = 0;
    let phase = jeu.phase;
    for (let i = 0; i < 90 / PAS; i++) {
      pas(jeu, PAS);
      if (jeu.phase === 'point' && phase !== 'point' && jeu.dureePoint > DUREE_POINT) pointsLongs++;
      phase = jeu.phase;
      jeu.evenements.length = 0;
      r.suit(jeu, PAS, true);
      if (r.actif && !etait) debuts++;
      etait = r.actif;
      // le rejeu ne dure jamais plus que l'annonce du point
      if (r.actif) expect(jeu.phase).toBe('point');
    }
    expect(pointsLongs).toBeGreaterThan(0);
    expect(debuts).toBe(pointsLongs);
  });
});
