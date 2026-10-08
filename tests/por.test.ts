import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { executeCoup } from '@core/coups';
import { graine } from '@core/aleatoire';
import { nouvellePartie, pas } from '@core/partie';
import { typeDePor } from '@core/por';
import type { Situation } from '@core/qualite';
import { xProf } from '@core/terrain';
import type { Coup } from '@core/types';

const sit = (o: Partial<Situation> = {}): Situation => ({
  z: 2.6,
  vitesse: 12,
  loin: 2.5,
  prev: 'lobe',
  mur: false,
  precision: 1,
  charge: 1,
  filetAdverse: true,
  ...o,
});

describe('por 3 et por 4 : réservés aux bons smashs', () => {
  it('un smash bien placé sous une balle haute, contre des adversaires au filet, peut sortir', () => {
    // à plat vers le centre : por 4 ; en diagonale : por 3
    expect(typeDePor('smash', 0.95, 0.9, sit(), false, 5, 0)).toBe(4);
    expect(typeDePor('smash', 0.95, 0.9, sit(), false, 9, 0)).toBe(3);
    // sur un lob de l'adversaire, même si ses joueurs ne sont pas au filet
    expect(typeDePor('smash', 0.95, 0.9, sit({ filetAdverse: false, prev: 'lobe' }), false, 5, 0)).toBe(4);
  });

  it("mais pas à tous les coups, ni n'importe quand", () => {
    const ok = (o: Partial<Situation>, p = 0.95, score = 0.9, subi = false) =>
      typeDePor('smash', p, score, sit(o), subi, 5, 0);
    expect(ok({}, 0.95, 0.9)).toBe(4);
    expect(typeDePor('smash', 0.95, 0.9, sit(), false, 5, 0.9)).toBe(0); // le tirage dit non
    expect(ok({ loin: 6 })).toBe(0); // du fond du court
    expect(ok({ z: 1.8 })).toBe(0); // balle trop basse
    expect(ok({}, 0.5)).toBe(0); // pas assez armé
    expect(ok({}, 0.95, 0.4)).toBe(0); // mal joué
    expect(ok({}, 0.95, 0.9, true)).toBe(0); // sur un lob subi
    expect(ok({ filetAdverse: false, prev: 'plat' })).toBe(0); // les adversaires ne sont pas collés au filet
  });

  it('la víbora très forte et très bien jouée sort très rarement, par le côté', () => {
    expect(typeDePor('vibora', 0.95, 0.9, sit(), false, 9, 0.05)).toBe(3);
    expect(typeDePor('vibora', 0.95, 0.9, sit(), false, 9, 0.5)).toBe(0);
    expect(typeDePor('vibora', 0.7, 0.9, sit(), false, 9, 0.05)).toBe(0);
  });

  it('jamais : bandeja, volée, lob, amorti, coupé, coup de vitre', () => {
    for (const type of ['bandeja', 'plat', 'lobe', 'amorti', 'coupe', 'vitre', 'cote'] as Coup[]) {
      expect(typeDePor(type, 1, 1, sit(), false, 5, 0), type).toBe(0);
    }
  });

  it('un smash qualifié sort vraiment de la piste, et gagne le point par un por', () => {
    let sorties = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const jeu = nouvellePartie({ mode: 'demo', niveau: 1, jeux: 1, rng: graine(seed) });
      const s = jeu.joueurs[0]!;
      s.x = 8;
      s.y = 5;
      jeu.phase = 'jeu';
      jeu.posture[1] = 'filet';
      Object.assign(jeu.balle, {
        x: 8.3,
        y: 5,
        z: 2.7,
        vx: -2,
        vy: 0,
        vz: 0,
        camp: 0,
        sol: 0,
        coup: 'lobe',
        dehors: false,
      });
      for (const j of jeu.joueurs) if (j !== s) j.cd = 999;
      executeCoup(jeu, s, 'smash', 1, xProf(1, 3), 5, null, { precision: 1, charge: 1 });
      if (jeu.balle.por === 0) continue;
      jeu.evenements.length = 0;
      for (let i = 0; i < 240 * 5 && jeu.phase === 'jeu'; i++) {
        for (const j of jeu.joueurs) if (j !== s) j.cd = 999;
        pas(jeu, PAS);
      }
      const point = jeu.evenements.find((e) => e.type === 'point');
      if (point && point.type === 'point' && point.raison.startsWith('POR')) sorties++;
    }
    expect(sorties).toBeGreaterThan(5);
  });
});
