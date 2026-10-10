import { describe, expect, it } from 'vitest';
import { graine } from '@core/aleatoire';
import { PARADE_RALENTI, PAS, VITESSE } from '@core/constants';
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
    // la scène se fige, le joueur rejoint la balle puis la frappe
    for (let i = 0; i < 240 && jeu.balle.super === 0; i++) pas(jeu, PAS);
    expect(jeu.balle.super).toBe(1); // une balle haute : la météore
    expect(jeu.parade).not.toBeNull(); // le jeu est figé : l'adversaire doit arrêter le curseur
    jeu.parade = null; // parade ratée
    expect(jeu.jaugeSmash[0]).toBe(0);
    // les adversaires ne peuvent pas la toucher : le point tombe au premier rebond
    for (let i = 0; i < 240 * 3 && jeu.phase === 'jeu'; i++) pas(jeu, PAS);
    expect(jeu.phase).not.toBe('jeu');
    expect(jeu.gagnant).toBe(0);
  });

  it('SUPER dès que la balle est dans notre camp : la scène se fige, le joueur court puis s’envole vers la balle et lance le gros coup', () => {
    // le joueur est au fond, la balle haute près du filet : loin de sa raquette
    const { jeu, s } = situation({ x: 9, y: 2, z: 3.2, vx: -2, vy: 0, vz: 0, sol: 0, coup: 'plat' }, 1);
    s.y = 8;
    const autre = jeu.joueurs[1]!;
    autre.x = 3;
    jeu.jaugeSmash[0] = 1;
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['smash'] }, PAS);
    expect(jeu.approche).not.toBeNull();
    const avant = { bx: jeu.balle.x, bz: jeu.balle.z, ax: autre.x, cx: jeu.joueurs[2]!.x };
    let hauteurMax = 0;
    for (let i = 0; i < 240 && jeu.approche; i++) {
      pas(jeu, PAS);
      hauteurMax = Math.max(hauteurMax, s.saut);
      // tout est figé, sauf le joueur
      expect(jeu.balle.x).toBe(avant.bx);
      expect(jeu.balle.z).toBe(avant.bz);
      expect(autre.x).toBe(avant.ax);
      expect(jeu.joueurs[2]!.x).toBe(avant.cx);
    }
    expect(jeu.approche).toBeNull();
    // il a sauté jusqu'à la balle (3,2 m : la raquette est à 1,5 m debout) et frappé
    expect(hauteurMax).toBeGreaterThan(1.2);
    expect(jeu.balle.super).toBeGreaterThan(0);
    expect(jeu.balle.eqF).toBe(0);
    expect(s.haut).toBe(true);
    expect(s.poseCoup).toBe('smash2');
    // le jeu reprend par la parade de l'adversaire
    expect(jeu.parade).not.toBeNull();
    expect(jeu.jaugeSmash[0]).toBe(0);
  });

  it('une balle basse : le joueur court sans sauter', () => {
    const { jeu, s } = situation({ x: 7, y: 5, z: 0.8, vx: -2, vy: 0, vz: 0, sol: 1, coup: 'plat' }, 1);
    jeu.jaugeSmash[0] = 1;
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['smash'] }, PAS);
    let hauteurMax = 0;
    for (let i = 0; i < 240 && jeu.approche; i++) {
      pas(jeu, PAS);
      hauteurMax = Math.max(hauteurMax, s.saut);
    }
    expect(hauteurMax).toBeLessThan(0.1);
    expect(jeu.balle.super).toBeGreaterThan(0);
  });

  it('sans la jauge pleine, SUPER ne fige rien : le joueur reste maître de ses déplacements', () => {
    const { jeu, s } = situation({ x: 9, y: 2, z: 1.2, vx: -2, vy: 0, vz: 0, sol: 0 }, 1);
    jeu.jaugeSmash[0] = 0.5;
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['smash'] }, PAS);
    expect(jeu.approche).toBeNull();
  });

  it('balle dans l’autre camp : SUPER ne déclenche pas l’approche', () => {
    const { jeu, s } = situation({ x: 12, y: 5, z: 1.2, vx: 8, camp: 1, sol: 0 }, 1);
    jeu.jaugeSmash[0] = 1;
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['smash'] }, PAS);
    expect(jeu.approche).toBeNull();
  });

  it('sans jauge pleine, la touche du haut vaut FRAPPE : jamais de super coup ni de coup perdu', () => {
    const { jeu, s } = situation({ z: 2.4, vx: -2, coup: 'lobe', sol: 0 }, 6);
    expect(jeu.jaugeSmash[0]).toBeLessThan(1);
    appliqueCommande(jeu, s, { ...VIDE, appuis: ['smash'] }, PAS);
    for (let i = 0; i < 4 && jeu.balle.coup === 'lobe'; i++) {
      jeu.balle.x -= 0.05;
      appliqueCommande(jeu, s, VIDE, PAS);
    }
    expect(jeu.balle.super).toBe(0);
    expect(jeu.parade).toBeNull();
    // balle haute : FRAPPE a donné le coup aérien
    expect(['smash', 'vibora', 'bandeja']).toContain(jeu.balle.coup);
  });

  it('la variante dépend de la situation : météore, orbite, volcan, éclair, phénix ou comète', () => {
    const v = (balle: Partial<Balle>, x: number) => {
      const { jeu } = situation(balle, x);
      return varianteSuper(jeu.balle, Math.abs(x - 10));
    };
    expect(v({ z: 2.5 }, 6)).toBe(1); // haute
    expect(v({ z: 2.5 }, 2)).toBe(6); // haute, frappée de loin : orbite
    expect(v({ z: 2.5 }, 8.5)).toBe(5); // haute, au filet : volcan
    expect(v({ z: 0.5, vx: -3 }, 8.5)).toBe(4); // au filet : éclair
    expect(v({ z: 0.8, vx: -4 }, 2)).toBe(3); // depuis le fond : phénix
    expect(v({ z: 0.8, vx: -20 }, 5)).toBe(2); // rapide à mi-court : comète
    expect(NOMS_SUPER.filter(Boolean)).toHaveLength(6);
  });

  it('avec le hasard, toutes les variantes sortent, la situation donnant la plus probable', () => {
    const { jeu } = situation({ z: 0.8, vx: -20 }, 5); // à mi-court : comète
    const rng = graine(5);
    const vus = new Map<number, number>();
    for (let i = 0; i < 600; i++) {
      const v = varianteSuper(jeu.balle, 5, rng);
      vus.set(v, (vus.get(v) ?? 0) + 1);
    }
    for (const v of [1, 2, 3, 4, 5, 6]) expect(vus.get(v) ?? 0, `variante ${v}`).toBeGreaterThan(20);
    expect(vus.get(2)!).toBeGreaterThan(vus.get(1)!); // la comète, naturelle ici, sort le plus souvent
    // volcan et orbite : près de la moitié des super coups, plus seulement la lune
    expect(((vus.get(5) ?? 0) + (vus.get(6) ?? 0)) / 600).toBeGreaterThan(0.35);
  });

  it('chaque variante est imparable et gagne le point, quel que soit le CPU en face', () => {
    for (const [variante, balle, x] of [
      [1, { z: 2.5 }, 6],
      [2, { z: 0.8, vx: -20 }, 5],
      [3, { z: 0.8, vx: -4 }, 2],
      [4, { z: 0.5, vx: -3 }, 8.5],
      [5, { z: 2.5 }, 8.5],
      [6, { z: 2.5 }, 2],
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

  it('le jeu passe au ralenti pendant la parade : la balle avance, mais très lentement', () => {
    const { jeu } = lance(true);
    const v = Math.hypot(jeu.balle.vx, jeu.balle.vy, jeu.balle.vz);
    const avant = { x: jeu.balle.x, y: jeu.balle.y, z: jeu.balle.z };
    for (let i = 0; i < 60; i++) pas(jeu, PAS);
    expect(jeu.parade).not.toBeNull();
    const d = Math.hypot(jeu.balle.x - avant.x, jeu.balle.y - avant.y, jeu.balle.z - avant.z);
    expect(d).toBeGreaterThan(0);
    // au plus la distance parcourue à vitesse normale, réduite par le ralenti (marge pour la gravité)
    expect(d).toBeLessThan(v * 60 * PAS * VITESSE * PARADE_RALENTI * 1.5);
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

describe('après un super coup, les joueurs ne s’entassent pas', () => {
  it('la balle partie très loin ne tire plus personne : les partenaires gardent leur écart pendant tout le point', () => {
    const jeu = partieTest({ mode: 'match', jeux: 3, sieges: [] }, 5);
    jeu.phase = 'point';
    jeu.dureePoint = 9;
    Object.assign(jeu.balle, { x: 148, y: 420, z: 45, dehors: true, roule: false });
    for (let i = 0; i < 240 * 8; i++) pas(jeu, PAS);
    for (const eq of [0, 1]) {
      const [a, b] = jeu.joueurs.filter((s) => s.eq === eq);
      expect(Math.abs(a!.y - b!.y)).toBeGreaterThan(2.5);
    }
  });
});
