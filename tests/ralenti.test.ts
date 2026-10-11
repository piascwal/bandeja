import { describe, expect, it } from 'vitest';
import { DUREE_POINT, DUREE_POINT_RALENTI, DUREE_POINT_SUPER, PAS } from '@core/constants';
import { pas } from '@core/partie';
import { gagne } from '@core/regles';
import { FinaleSuper, minutage, RYTHME_FINALE } from '../src/render/finale-super';
import { Ralenti } from '../src/app/ralenti';
import { partieTest } from './outils';

describe('ralenti des points', () => {
  it("un échange court garde l'annonce normale, un long l'allonge", () => {
    const jeu = partieTest({ mode: 'match', jeux: 3, sieges: [] }, 7);
    const durees = new Set<number>();
    let phase = jeu.phase;
    for (let i = 0; i < 240 / PAS; i++) {
      pas(jeu, PAS);
      if (jeu.phase === 'point' && phase !== 'point') durees.add(jeu.dureePoint);
      phase = jeu.phase;
      jeu.evenements.length = 0;
    }
    expect(
      [...durees].every((d) => d === DUREE_POINT || d === DUREE_POINT_RALENTI || d === DUREE_POINT_SUPER),
    ).toBe(true);
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
      // (un point long qui finit dans les dernières secondes n'a pas le temps de démarrer son rejeu : on ne le compte pas)
      if (jeu.phase === 'point' && phase !== 'point' && jeu.dureePoint > DUREE_POINT && i < (90 - 2) / PAS)
        pointsLongs++;
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

  it('le rejeu d’un super coup attend la fin de sa scène finale, puis part aussitôt', () => {
    const jeu = partieTest({ mode: 'match', jeux: 3, sieges: [] }, 7);
    const r = new Ralenti();
    const f = new FinaleSuper();
    const joue = (secondes: number, quand?: () => void) => {
      for (let i = 0; i < secondes / PAS; i++) {
        pas(jeu, PAS);
        jeu.evenements.length = 0;
        f.maj(PAS);
        r.suit(jeu, PAS, true, f);
        quand?.();
      }
    };
    // un échange en cours pendant quelques secondes, puis le point gagné par un super coup (scène du Titanic, la plus longue)
    for (let i = 0; i < 60 / PAS && jeu.phase !== 'jeu'; i++) {
      pas(jeu, PAS);
      jeu.evenements.length = 0;
      r.suit(jeu, PAS, true, f);
    }
    joue(2);
    jeu.balle.super = 6;
    gagne(jeu, 0, 'TITANIC !');
    f.declenche(6, 0, 0);
    expect(jeu.dureePoint).toBe(DUREE_POINT_SUPER);
    let rejeuPendantScene = false;
    let debutRejeu = -1;
    joue((minutage(6).fin / RYTHME_FINALE) * 1.2, () => {
      if (r.actif && f.actif) rejeuPendantScene = true;
      if (r.actif && debutRejeu < 0) debutRejeu = f.t;
    });
    expect(rejeuPendantScene).toBe(false);
    expect(debutRejeu).toBeGreaterThan(minutage(6).fin);
    // le rejeu part dans la seconde qui suit la fin de la scène, pas à un délai fixe plus tardif
    expect((debutRejeu - minutage(6).fin) / RYTHME_FINALE).toBeLessThan(0.5);
  });
});
