import { describe, expect, it } from 'vitest';
import { MIL, PAS } from '@core/constants';
import { murVise, placementVitre } from '@core/contre-vitre';
import { executeCoup } from '@core/coups';
import { pas } from '@core/partie';
import { qualite, situationDe } from '@core/qualite';
import type { Balle, Commande } from '@core/types';
import { partieTest } from './outils';

/** Un humain de l'équipe 0 en (x, 5), la balle en (bx, 5) : la vitre du fond est à x = 0. */
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

/** Joue la partie avec ce joystick tenu et un appui sur FRAPPE au premier pas ; renvoie le coup du joueur et les surfaces touchées. */
function joue(jeu: ReturnType<typeof situation>['jeu'], dx: number, dy: number, secondes = 4) {
  const surfaces: string[] = [];
  let coup = '';
  let passe = false;
  let fini = false;
  for (let i = 0; i < secondes / PAS; i++) {
    const cmd: Commande = { dx, dy, appuis: i === 0 ? ['plat'] : [] };
    pas(jeu, PAS, () => cmd);
    for (const e of jeu.evenements) {
      if (e.type === 'frappe' && e.humain && !coup) {
        coup = e.coup;
      }
      if (e.type === 'impact' && coup) {
        surfaces.push(e.surface);
        if (e.surface === 'sol' && !passe) fini = true;
      }
    }
    jeu.evenements.length = 0;
    if (coup && !fini && jeu.balle.x > MIL) passe = true;
  }
  return { coup, surfaces, passe };
}

describe('on choisit sa vitre avec le joystick, dans toutes les situations', () => {
  it('poussé presque à fond vers l’arrière ou vers un côté ; sinon coup ordinaire', () => {
    // l'équipe 0 est en miroir sur son écran, mais murVise reçoit la visée de la piste : x > 0 vers le filet
    expect(murVise({ x: -1, y: 0 }, 0)).toBe('fond');
    expect(murVise({ x: -0.9, y: 0.3 }, 0)).toBe('fond');
    expect(murVise({ x: 0, y: -1 }, 0)).toBe('haut');
    expect(murVise({ x: 0.2, y: 1 }, 0)).toBe('bas');
    expect(murVise({ x: 1, y: 0 }, 0)).toBeNull(); // vers le filet
    expect(murVise({ x: 0, y: 0 }, 0)).toBeNull(); // au repos
    expect(murVise({ x: -0.5, y: 0 }, 0)).toBeNull(); // pas assez poussé : on dirige juste le coup
    expect(murVise({ x: -0.7, y: -0.7 }, 0)).toBeNull(); // entre deux : pas de vitre
    expect(murVise({ x: 1, y: 0 }, 1)).toBe('fond'); // l'équipe 1 joue de l'autre côté
  });

  it('le placement : la balle dans le dos, près de la vitre, vaut bien plus que la balle devant', () => {
    const bon = situation(3, 0.8);
    const moyen = situation(3, 2.6);
    const mauvais = situation(2, 4);
    const p = (c: ReturnType<typeof situation>) => placementVitre(c.jeu.balle, c.s, 'fond');
    expect(p(bon)).toBeGreaterThan(0.8);
    expect(p(moyen)).toBeLessThan(p(bon));
    expect(p(mauvais)).toBeLessThan(0.3);
  });

  it('un renvoi bien placé est vert, un renvoi mal placé est médiocre', () => {
    const niveau = (c: ReturnType<typeof situation>) => {
      const sit = situationDe(c.jeu.balle, c.s, 0.9, 1);
      sit.vitre = placementVitre(c.jeu.balle, c.s, 'fond');
      return qualite('vitre', sit).niveau;
    };
    expect(niveau(situation(2, 0.7))).toBeGreaterThanOrEqual(4);
    expect(niveau(situation(1.5, 4))).toBeLessThanOrEqual(2);
  });

  it('bien placé et visé vers le fond : la balle touche la vitre puis retombe chez l’adversaire', () => {
    const { jeu } = situation(1.8, 0.8);
    // l'écran de l'équipe 0 est en miroir : le joystick à droite, c'est vers la vitre du fond
    const { coup, surfaces, passe } = joue(jeu, 1, 0);
    expect(coup).toBe('vitre');
    expect(surfaces[0]).toBe('vitre');
    expect(passe).toBe(true); // elle passe chez l'adversaire sans avoir rebondi chez nous
  });

  it('bien placé et visé vers le côté : la vitre de côté, puis chez l’adversaire', () => {
    const { jeu, s } = situation(3, 3);
    s.y = 1.6;
    Object.assign(jeu.balle, { y: 0.5 });
    const { coup, surfaces, passe } = joue(jeu, 0, -1);
    expect(coup).toBe('cote');
    expect(surfaces[0]).toBe('vitre');
    expect(passe).toBe(true); // elle passe chez l'adversaire sans avoir rebondi chez nous
  });

  it('même mal placé, le joueur tire sur sa vitre : le coup part, et la balle ne passe pas chez l’adversaire', () => {
    const { jeu } = situation(5, 4.5); // balle devant lui, loin de la vitre
    const { coup, surfaces } = joue(jeu, 1, 0);
    expect(coup).toBe('vitre');
    expect(surfaces).toContain('vitre');
  });

  it('au repos le coup reste ordinaire, même à côté de la vitre', () => {
    const { jeu } = situation(1.8, 0.8);
    const { coup } = joue(jeu, 0, 0);
    expect(['vitre', 'cote']).not.toContain(coup);
  });

  it('une balle haute : le coup vitre attend qu’elle descende', () => {
    const { jeu } = situation(2, 1, { z: 3, vz: -4, sol: 0 });
    const { coup } = joue(jeu, 1, 0, 0.05);
    expect(coup).toBe('');
  });
});

describe('executeCoup avec un renvoi de vitre voulu', () => {
  it('vert : dirigé chez l’adversaire ; raté : brut, sans calcul d’élan', () => {
    const bien = situation(1.8, 0.7);
    executeCoup(bien.jeu, bien.s, 'vitre', 0.5, 12, 5, 'fond', {
      vitreLibre: true,
      precision: 1,
      intention: 'vitre',
    });
    expect(bien.jeu.balle.coup).toBe('vitre');
    const mal = situation(1.5, 4.5);
    executeCoup(mal.jeu, mal.s, 'vitre', 0.5, 12, 5, 'fond', {
      vitreLibre: true,
      precision: 0.2,
      intention: 'vitre',
    });
    expect(mal.jeu.balle.coup).toBe('vitre');
    expect(mal.jeu.balle.vx).toBeLessThan(0); // vers la vitre du fond, de l'équipe 0
  });
});

describe('ralentissement dans la zone de frappe', () => {
  /** Distance parcourue en 0,3 s par un joueur qui a armé son coup, joystick à fond, la balle à `ecart` mètres. */
  const parcours = (ecart: number): number => {
    const { jeu, s } = situation(6, 6 + ecart, { vx: 0, z: 1.2, coup: 'plat', sol: 0 });
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
