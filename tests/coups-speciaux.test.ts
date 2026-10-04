import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { contrainte, executeCoup } from '@core/coups';
import { xProf } from '@core/terrain';
import { pas } from '@core/partie';
import type { Commande } from '@core/types';
import { partieTest } from './outils';

const VIDE: Commande = { dx: 0, dy: 0, appuis: [] };

describe('le lob subi', () => {
  it('un lob qui a passé le joueur : pas de smash, coup limité, avantage au lobeur', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    const s = jeu.joueurs[0]!;
    jeu.phase = 'jeu';
    s.x = 1;
    Object.assign(jeu.balle, {
      x: 1.5,
      y: 5,
      z: 1,
      vx: -1,
      vy: 0,
      vz: 0,
      camp: 0,
      sol: 1,
      coup: 'lobe',
      eqF: 1,
    });
    expect(contrainte(jeu.balle, s)).toBe(true);
    // SMASH donne un renvoi normal : l'appui n'est pas perdu
    pas(jeu, PAS, () => ({ ...VIDE, appuis: ['smash'] }));
    expect(s.intent?.type).toBe('plat');
    // un coup joué dans cette situation est limité et donne l'avantage à l'autre équipe
    executeCoup(jeu, s, 'smash', 1, xProf(1, 5), 5);
    expect(jeu.balle.coup).toBe('bandeja');
    expect(jeu.avantage).toBe(1);
    // l'équipe lobeuse frappe ensuite avec une prime de puissance, l'avantage se consomme
    const t = jeu.joueurs[2]!;
    Object.assign(jeu.balle, {
      x: 14,
      y: 5,
      z: 1,
      vx: 3,
      vy: 0,
      vz: 0,
      camp: 1,
      sol: 1,
      coup: 'plat',
      eqF: 0,
    });
    t.x = 14;
    t.y = 5;
    executeCoup(jeu, t, 'plat', 0.5, xProf(0, 3), 5);
    expect(jeu.avantage).toBeNull();
  });

  it('un lob encore haut au-dessus d’un joueur au filet peut être smashé', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    const s = jeu.joueurs[0]!;
    s.x = 8;
    Object.assign(jeu.balle, { x: 7.5, y: 5, z: 2.5, camp: 0, sol: 0, coup: 'lobe', eqF: 1 });
    expect(contrainte(jeu.balle, s)).toBe(false);
  });
});
