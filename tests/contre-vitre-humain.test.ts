import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { murVise, vitreJouable } from '@core/contre-vitre';
import { pas } from '@core/partie';
import type { Balle, Commande } from '@core/types';
import { partieTest } from './outils';

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

  it('pas sur une balle devant le joueur ou loin de la vitre', () => {
    const devant = situation(1, 3);
    expect(vitreJouable(devant.jeu.balle, devant.s)).toBe(false);
    const loin = situation(5, 4);
    expect(vitreJouable(loin.jeu.balle, loin.s)).toBe(false);
  });

  it('même sur une balle haute ou pas encore rebondie (feinte de smash)', () => {
    const haute = situation(3, 1, { z: 2.6, sol: 0 });
    expect(vitreJouable(haute.jeu.balle, haute.s)).toBe(true);
    expect(murVise(haute.jeu.balle, haute.s, { x: -1, y: 0 })).toBe('fond');
  });

  it('FRAPPE renvoie la balle dans la vitre : elle la touche puis retombe chez l’adversaire', () => {
    const { jeu } = situation(1.4, 0.8);
    const evs: string[] = [];
    let coup = '';
    for (let i = 0; i < 1500; i++) {
      // l'écran de l'équipe 0 est en miroir : le joystick à droite, c'est vers la vitre du fond
      const cmd: Commande = { dx: 1, dy: 0, appuis: i === 0 ? ['plat'] : [] };
      pas(jeu, PAS, () => cmd);
      for (const e of jeu.evenements) {
        if (e.type === 'frappe' && e.humain) coup = e.coup;
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

describe('vitre de côté et visée', () => {
  /** Un joueur en milieu de piste mais collé à la vitre de côté y = 0, la balle dans son dos près de cette vitre. */
  const cote = () => {
    const { jeu, s } = situation(3, 3);
    s.y = 1.2;
    Object.assign(jeu.balle, { y: 0.4 });
    return { jeu, s };
  };

  it('la situation de côté est reconnue, pas au milieu de la piste', () => {
    const c = cote();
    expect(vitreJouable(c.jeu.balle, c.s)).toBe(true);
    const milieu = situation(3, 3);
    expect(vitreJouable(milieu.jeu.balle, milieu.s)).toBe(false);
  });

  it('on choisit la vitre en poussant le joystick vers elle ; au repos ou vers le filet, le coup est ordinaire', () => {
    const c = cote();
    expect(murVise(c.jeu.balle, c.s, { x: 0, y: -1 })).toBe('haut');
    expect(murVise(c.jeu.balle, c.s, { x: 0, y: 1 })).toBeNull(); // vers l'autre côté : coup ordinaire
    expect(murVise(c.jeu.balle, c.s, { x: 1, y: 0 })).toBeNull(); // vers le filet
    expect(murVise(c.jeu.balle, c.s, { x: 0, y: 0 })).toBeNull(); // joystick au repos : coup ordinaire vers l'avant
    const f = situation(1.4, 0.8);
    expect(murVise(f.jeu.balle, f.s, { x: -1, y: 0 })).toBe('fond');
    expect(murVise(f.jeu.balle, f.s, { x: 1, y: 0 })).toBeNull();
    expect(murVise(f.jeu.balle, f.s, { x: 0, y: 0 })).toBeNull();
  });

  it('FRAPPE en visant le côté : la balle tape sa vitre de côté puis retombe chez l’adversaire', () => {
    const { jeu } = cote();
    const surfaces: string[] = [];
    let coup = '';
    for (let i = 0; i < 1500; i++) {
      const cmd: Commande = i === 0 ? { dx: 0, dy: -1, appuis: ['plat'] } : { dx: 0, dy: -1, appuis: [] };
      pas(jeu, PAS, () => cmd);
      for (const e of jeu.evenements) {
        if (e.type === 'frappe' && e.humain) coup = e.coup;
        if (e.type === 'impact') surfaces.push(e.surface);
      }
      jeu.evenements.length = 0;
      if (coup && jeu.balle.camp === 1 && jeu.balle.sol >= 1) break;
    }
    expect(coup).toBe('cote');
    expect(surfaces[0]).toBe('vitre');
    expect(jeu.balle.camp).toBe(1);
  });
});

describe('ralentissement dans la zone de frappe', () => {
  /** Distance parcourue en 0,3 s par un joueur qui a armé son coup, joystick à fond, la balle à `ecart` mètres. */
  const parcours = (ecart: number): number => {
    const { jeu, s } = situation(6, 6 + ecart, { vx: 0, z: 1.2, coup: 'plat', sol: 0 });
    s.intent = { type: 'plat', t: 0.3 };
    s.y = 5;
    const y0 = s.y;
    for (let i = 0; i < 0.3 / PAS; i++) {
      s.intent = { type: 'plat', t: 0.3 };
      jeu.balle.x = s.x + ecart;
      jeu.balle.vx = 0;
      pas(jeu, PAS, () => ({ dx: 0, dy: 1, appuis: [] }));
    }
    return Math.abs(s.y - y0);
  };

  it('le joueur est plus lent quand la balle est presque à portée que quand elle est loin', () => {
    expect(parcours(1.5)).toBeLessThan(parcours(5) * 0.8);
  });
});
