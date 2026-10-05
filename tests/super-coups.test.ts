import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { executeCoup } from '@core/coups';
import { appliqueCommande } from '@core/humain';
import { pas } from '@core/partie';
import { GAIN_JAUGE } from '@core/qualite';
import { curseurParade, dansZoneParade, NOMS_SUPER, varianteSuper } from '@core/super-coup';
import { xProf } from '@core/terrain';
import type { Balle, Commande } from '@core/types';
import { partieTest } from './outils';

const VIDE: Commande = { dx: 0, dy: 0, appuis: [] };

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

describe('la jauge du super coup, remplie par la qualité des coups', () => {
  it('un coup parfait la remplit bien plus qu’un coup médiocre', () => {
    // un smash sur une balle haute et lente, au filet : parfait
    const beau = situation({ z: 2.6, vx: -2, coup: 'lobe', sol: 0 }, 8);
    executeCoup(beau.jeu, beau.s, 'smash', 1, xProf(1, 5.5), 5, null, { precision: 1, charge: 1 });
    // le même bouton sur une balle basse reçue après un amorti : médiocre
    const mauvais = situation({ z: 0.3, vx: -2, coup: 'amorti' }, 8);
    executeCoup(mauvais.jeu, mauvais.s, 'plat', 0.9, xProf(1, 5.5), 5, null, {
      precision: 1,
      charge: 1,
      intention: 'smash',
    });
    expect(beau.jeu.jaugeSmash[0]).toBeCloseTo(GAIN_JAUGE[5]!);
    expect(mauvais.jeu.jaugeSmash[0]).toBeLessThanOrEqual(GAIN_JAUGE[2]!);
    expect(beau.jeu.jaugeSmash[1]).toBe(0);
  });

  it('l’évènement du coup porte sa qualité (1 à 5)', () => {
    const { jeu, s } = situation({ z: 2.6, vx: -2, coup: 'lobe', sol: 0 }, 8);
    executeCoup(jeu, s, 'smash', 1, xProf(1, 5.5), 5, null, { precision: 1, charge: 1 });
    const e = jeu.evenements.find((x) => x.type === 'frappe');
    expect(e).toMatchObject({ q: 5, sv: 0 });
  });

  it('un lob raté est lent et court, un lob parfait part loin et vite', () => {
    const lob = (precision: number, vitesse: number, mur: boolean) => {
      const { jeu, s } = situation({ z: 1.1, vx: -vitesse, mur }, 2);
      s.err = 0;
      executeCoup(jeu, s, 'lobe', 0.5, xProf(1, 2), 5, null, { precision, charge: 0.5 });
      const b = jeu.balle;
      return { vx: b.vx, vz: b.vz };
    };
    const rate = lob(0.05, 26, false);
    const parfait = lob(1, 6, true);
    // le parfait part beaucoup plus vite vers l'avant que le raté
    expect(parfait.vx).toBeGreaterThan(rate.vx * 1.3);
  });
});

describe('le super coup', () => {
  it('jauge pleine, le bouton SMASH lance un super coup imparable qui gagne le point', () => {
    const { jeu, s } = situation({ z: 2.4, vx: -2, coup: 'lobe', sol: 0 }, 6);
    jeu.jaugeSmash[0] = 1;
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['smash'] }, PAS);
    for (let i = 0; i < 4 && jeu.balle.super === 0; i++) {
      jeu.balle.x -= 0.05;
      appliqueCommande(jeu, s, VIDE, PAS);
    }
    expect(jeu.balle.super).toBe(1); // une balle haute : la météore
    expect(jeu.parade).not.toBeNull(); // le jeu est figé : l'adversaire doit arrêter le curseur
    jeu.parade = null; // parade ratée
    expect(jeu.jaugeSmash[0]).toBe(0);
    // les adversaires ne peuvent pas la toucher : le point tombe au premier rebond
    for (let i = 0; i < 240 * 3 && jeu.phase === 'jeu'; i++) pas(jeu, PAS);
    expect(jeu.phase).not.toBe('jeu');
    expect(jeu.gagnant).toBe(0);
  });

  it('la variante dépend de la situation : météore, éclair, phénix ou comète', () => {
    const v = (balle: Partial<Balle>, x: number) => {
      const { jeu } = situation(balle, x);
      return varianteSuper(jeu.balle, Math.abs(x - 10));
    };
    expect(v({ z: 2.5 }, 6)).toBe(1); // haute
    expect(v({ z: 0.5, vx: -3 }, 8.5)).toBe(4); // au filet : éclair
    expect(v({ z: 0.8, vx: -4 }, 2)).toBe(3); // depuis le fond : phénix
    expect(v({ z: 0.8, vx: -20 }, 5)).toBe(2); // rapide à mi-court : comète
    expect(NOMS_SUPER.filter(Boolean)).toHaveLength(4);
  });

  it('chaque variante est imparable et gagne le point, quel que soit le CPU en face', () => {
    for (const [variante, balle, x] of [
      [1, { z: 2.5 }, 6],
      [2, { z: 0.8, vx: -20 }, 5],
      [3, { z: 0.8, vx: -4 }, 2],
      [4, { z: 0.5, vx: -3 }, 8.5],
    ] as [number, Partial<Balle>, number][]) {
      const { jeu, s } = situation(balle, x);
      executeCoup(jeu, s, 'plat', 1, xProf(1, 3), 5, null, { super: variante, precision: 1, charge: 1 });
      jeu.parade = null; // la parade ratée : le super coup file
      expect(jeu.balle.super, `variante ${variante}`).toBe(variante);
      for (let i = 0; i < 240 * 5 && jeu.phase === 'jeu'; i++) pas(jeu, PAS);
      expect(jeu.gagnant, `variante ${variante}`).toBe(0);
      expect(jeu.phase, `variante ${variante}`).toBe('point');
    }
  });
});

describe('la fin spectaculaire des super coups', () => {
  /** Joue un super coup et suit la balle pendant 4 s : sa hauteur maximale, si elle sort, et si elle brise une vitre. */
  function fin(variante: number, balle: Partial<Balle>, x: number) {
    const { jeu, s } = situation(balle, x);
    executeCoup(jeu, s, 'plat', 1, xProf(1, 3), 5, null, { super: variante, precision: 1, charge: 1 });
    jeu.parade = null; // la parade ratée : le super coup file
    const sortie = { zMax: 0, dehors: false, vitreBrisee: false, vitesseMax: 0 };
    for (let i = 0; i < 240 * 4; i++) {
      pas(jeu, PAS);
      const b = jeu.balle;
      sortie.zMax = Math.max(sortie.zMax, b.z);
      sortie.dehors ||= b.dehors;
      sortie.vitesseMax = Math.max(sortie.vitesseMax, Math.hypot(b.vx, b.vy, b.vz));
      for (const e of jeu.evenements.splice(0))
        if (e.type === 'impact' && e.surface === 'vitre' && e.force === 99) sortie.vitreBrisee = true;
    }
    return sortie;
  }

  it('la météore s’écrase puis repart dans l’espace', () => {
    const r = fin(1, { z: 2.5 }, 6);
    expect(r.zMax).toBeGreaterThan(40);
  });

  it('l’éclair repart lui aussi dans l’espace', () => {
    expect(fin(4, { z: 0.5, vx: -3 }, 8.5).zMax).toBeGreaterThan(40);
  });

  it('la comète défonce la vitre du fond et sort de la piste', () => {
    const r = fin(2, { z: 0.8, vx: -20 }, 5);
    expect(r.vitreBrisee).toBe(true);
    expect(r.dehors).toBe(true);
  });

  it('le phénix défonce la vitre de côté et sort de la piste', () => {
    const r = fin(3, { z: 0.8, vx: -4 }, 2);
    expect(r.vitreBrisee).toBe(true);
    expect(r.dehors).toBe(true);
  });

  it('aucun super coup n’est lent : de la frappe à la sortie, la balle file', () => {
    for (const [v, balle, x] of [
      [1, { z: 2.5 }, 6],
      [2, { z: 0.8, vx: -20 }, 5],
      [3, { z: 0.8, vx: -4 }, 2],
      [4, { z: 0.5, vx: -3 }, 8.5],
    ] as [number, Partial<Balle>, number][])
      expect(fin(v, balle, x).vitesseMax, `variante ${v}`).toBeGreaterThan(35);
  });
});

describe('la parade d’un super coup', () => {
  /** Un super coup de l'équipe 0 vient de partir contre l'équipe 1 (CPU) ou contre des humains. */
  function lance(humainsAdverses = false) {
    const { jeu, s } = situation({ z: 2.5 }, 6);
    if (humainsAdverses) {
      const adv = jeu.joueurs[2]!;
      adv.humain = true;
      jeu.humains.push(adv);
    }
    executeCoup(jeu, s, 'plat', 1, xProf(1, 3), 5, null, { super: 1, precision: 1, charge: 1 });
    return { jeu, s };
  }

  it('le jeu est figé pendant la parade : ni la balle ni les joueurs ne bougent', () => {
    const { jeu } = lance(true);
    const avant = { x: jeu.balle.x, y: jeu.balle.y, z: jeu.balle.z, jx: jeu.joueurs[1]!.x };
    for (let i = 0; i < 60; i++) pas(jeu, PAS);
    expect(jeu.parade).not.toBeNull();
    expect(jeu.balle.x).toBe(avant.x);
    expect(jeu.balle.z).toBe(avant.z);
    expect(jeu.joueurs[1]!.x).toBe(avant.jx);
  });

  it('un humain du camp qui subit arrête le curseur : dans le vert, le super coup est arrêté', () => {
    const { jeu } = lance(true);
    // on avance jusqu'à ce que le curseur soit dans la zone verte
    for (let i = 0; i < 600 && !dansZoneParade(curseurParade(jeu.parade!.t)); i++) pas(jeu, PAS);
    const adv = jeu.joueurs[2]!;
    appliqueCommande(jeu, adv, { ...VIDE, appuis: ['plat'] }, PAS);
    expect(jeu.parade).toBeNull();
    expect(jeu.balle.super).toBe(0);
    expect(jeu.evenements.some((e) => e.type === 'parade' && e.ok)).toBe(true);
    // la balle reste dangereuse mais jouable, et celui qui a paré gagne de la jauge
    expect(Math.hypot(jeu.balle.vx, jeu.balle.vy, jeu.balle.vz)).toBeLessThanOrEqual(24.01);
    expect(jeu.jaugeSmash[1]).toBeGreaterThanOrEqual(0.2);
  });

  it('hors de la zone verte, la parade est ratée et le super coup file', () => {
    const { jeu } = lance(true);
    for (let i = 0; i < 600 && dansZoneParade(curseurParade(jeu.parade!.t)); i++) pas(jeu, PAS);
    // le curseur est maintenant hors du vert
    for (
      let i = 0;
      i < 600 && (dansZoneParade(curseurParade(jeu.parade!.t)) || curseurParade(jeu.parade!.t) < 0.8);
      i++
    )
      pas(jeu, PAS);
    appliqueCommande(jeu, jeu.joueurs[2]!, { ...VIDE, appuis: ['plat'] }, PAS);
    expect(jeu.parade).toBeNull();
    expect(jeu.balle.super).toBe(1);
    expect(jeu.evenements.some((e) => e.type === 'parade' && !e.ok)).toBe(true);
  });

  it('sans réponse, la parade expire et le super coup file', () => {
    const { jeu } = lance(true);
    for (let i = 0; i < 240 * 3 && jeu.parade; i++) pas(jeu, PAS);
    expect(jeu.parade).toBeNull();
    expect(jeu.balle.super).toBe(1);
  });

  it('un camp de CPU arrête parfois le super coup, pas toujours', () => {
    let arretes = 0;
    for (let g = 0; g < 40; g++) {
      const { jeu, s } = situation({ z: 2.5 }, 6);
      s.humain = true;
      jeu.rng = (() => {
        let x = g + 1;
        return () => (x = (x * 16807) % 2147483647) / 2147483647;
      })();
      executeCoup(jeu, s, 'plat', 1, xProf(1, 3), 5, null, { super: 1, precision: 1, charge: 1 });
      for (let i = 0; i < 240 * 3 && jeu.parade; i++) pas(jeu, PAS);
      if (jeu.balle.super === 0) arretes++;
    }
    expect(arretes).toBeGreaterThan(2);
    expect(arretes).toBeLessThan(25);
  });
});
