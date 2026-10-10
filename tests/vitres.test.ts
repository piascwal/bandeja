import { describe, expect, it } from 'vitest';
import { PAS, MIL } from '@core/constants';
import { executeCoup } from '@core/coups';
import { graine } from '@core/aleatoire';
import { nouvellePartie, pas } from '@core/partie';
import type { Coup } from '@core/types';
import { xProf } from '@core/terrain';

/** Part des balles qui, après un rebond au sol puis contre la vitre du fond, reviennent seules dans le camp de celui qui a frappé. */
function partRevenante(type: Coup, p: number): { vitres: number; reviennent: number } {
  let vitres = 0;
  let reviennent = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const jeu = nouvellePartie({ mode: 'demo', niveau: 1, jeux: 1, rng: graine(seed) });
    const s = jeu.joueurs[0]!;
    s.x = 3 + (seed % 5);
    s.y = 2 + (seed % 7);
    jeu.phase = 'jeu';
    const haut = type === 'smash' || type === 'bandeja';
    Object.assign(jeu.balle, {
      x: s.x + 0.3,
      y: s.y,
      z: haut ? 2.4 : 1,
      vx: -4,
      vy: 0,
      vz: 0,
      camp: 0,
      sol: 1,
      coup: 'plat',
      dehors: false,
      roule: false,
    });
    // personne d'autre ne joue : on ne regarde que la physique de la balle
    for (const j of jeu.joueurs) if (j !== s) j.cd = 999;
    executeCoup(jeu, s, type, p, xProf(1, 3 + (seed % 4)), 2 + (seed % 7), null, {
      precision: 0.8,
      charge: p,
    });
    jeu.evenements.length = 0;
    let vu = false;
    for (let i = 0; i < 240 * 4; i++) {
      for (const j of jeu.joueurs) if (j !== s) j.cd = 999;
      pas(jeu, PAS);
      for (const e of jeu.evenements)
        if (e.type === 'impact' && e.surface === 'vitre' && (e.x < 0.6 || e.x > 19.4) && jeu.balle.sol >= 1)
          vu = true;
      jeu.evenements.length = 0;
      if (vu && jeu.balle.x < MIL) {
        vitres++;
        reviennent++;
        break;
      }
      if (jeu.phase !== 'jeu') {
        if (vu) vitres++;
        break;
      }
      if (i === 240 * 4 - 1 && vu) vitres++;
    }
  }
  return { vitres, reviennent };
}

describe('rebond contre la vitre du fond', () => {
  it('la balle rebondie monte dans son camp au lieu de revenir chez celui qui a frappé', () => {
    for (const [type, p] of [
      ['plat', 0.95],
      ['bandeja', 0.6],
    ] as const) {
      const { vitres, reviennent } = partRevenante(type, p);
      expect(vitres, type).toBeGreaterThan(40);
      // arcade : une balle déjà rebondie ne repasse (presque) jamais chez celui qui a frappé
      expect(reviennent / vitres, type).toBeLessThan(0.1);
    }
  });
});
