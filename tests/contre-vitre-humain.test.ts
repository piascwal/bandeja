import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { vitreJouable } from '@core/contre-vitre';
import { pas } from '@core/partie';
import type { Balle, Commande } from '@core/types';
import { partieTest } from './outils';

const VIDE: Commande = { dx: 0, dy: 0, appuis: [] };

/** Un humain de l'équipe 0 en x, la balle déjà rebondie en bx (la vitre du fond est à x = 0). */
function situation(x: number, bx: number, balle: Partial<Balle> = {}) {
  const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
  const s = jeu.joueurs[0]!;
  s.x = x;
  s.y = 5;
  jeu.phase = 'jeu';
  Object.assign(jeu.balle, {
    x: bx,
    y: 5,
    z: 0.9,
    vx: -2,
    vy: 0,
    vz: 0,
    camp: 0,
    sol: 1,
    coup: 'lobe',
    ...balle,
  });
  return { jeu, s };
}

describe('renvoi direct dans sa vitre (contre-vitre du joueur)', () => {
  it('se déclenche sur un lob profond passé derrière le joueur, ou quand il est collé à la vitre', () => {
    const lob = situation(3, 1);
    expect(vitreJouable(lob.jeu.balle, lob.s)).toBe(true);
    const colle = situation(1.2, 1);
    expect(vitreJouable(colle.jeu.balle, colle.s)).toBe(true);
  });

  it('pas sur une balle devant le joueur, non rebondie, haute ou loin de la vitre', () => {
    const devant = situation(1, 3);
    expect(vitreJouable(devant.jeu.balle, devant.s)).toBe(false);
    const nonRebondie = situation(3, 1, { sol: 0 });
    expect(vitreJouable(nonRebondie.jeu.balle, nonRebondie.s)).toBe(false);
    const haute = situation(3, 1, { z: 2.5 });
    expect(vitreJouable(haute.jeu.balle, haute.s)).toBe(false);
    const loin = situation(5, 4);
    expect(vitreJouable(loin.jeu.balle, loin.s)).toBe(false);
  });

  it('FRAPPE renvoie la balle dans la vitre : elle la touche puis retombe chez l’adversaire', () => {
    const { jeu } = situation(1.4, 0.8);
    const evs: string[] = [];
    let coup = '';
    for (let i = 0; i < 1500; i++) {
      const cmd: Commande = i === 0 ? { dx: 0, dy: 0, appuis: ['plat'] } : VIDE;
      pas(jeu, PAS, () => cmd);
      for (const e of jeu.evenements) {
        if (e.type === 'frappe') coup = e.coup;
        if (e.type === 'impact') evs.push(`${e.surface}`);
      }
      jeu.evenements.length = 0;
      if (jeu.balle.sol >= 1 && jeu.balle.camp === 1 && coup) break;
    }
    expect(coup).toBe('vitre');
    expect(evs[0]).toBe('vitre');
    expect(jeu.balle.camp).toBe(1);
  });
});
