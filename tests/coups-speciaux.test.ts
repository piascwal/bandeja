import { describe, expect, it } from 'vitest';
import { physique } from '@core/balle';
import { PAS, SMASH_GAIN_COUP, SMASH_GAIN_VITRE } from '@core/constants';
import { contrainte, executeCoup } from '@core/coups';
import { xProf } from '@core/terrain';
import { appliqueCommande, coupPrevu } from '@core/humain';
import { pas } from '@core/partie';
import type { Commande } from '@core/types';
import { partieTest } from './outils';

const VIDE: Commande = { dx: 0, dy: 0, appuis: [] };

describe('le super coup', () => {
  /** Un joueur de l'équipe 0 immobile à x = 2, la balle (déplacée à la main, sans pesanteur) qui arrive sur lui. */
  function arrivee(charge: number) {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    const s = jeu.joueurs[0]!;
    s.x = 2;
    s.y = 5;
    jeu.phase = 'jeu';
    Object.assign(jeu.balle, {
      x: 4,
      y: 5,
      z: 1.1,
      vx: 0,
      vy: 0,
      vz: 0,
      camp: 0,
      sol: 1,
      spin: 'plat',
      coup: 'plat',
    });
    s.intent = { type: 'plat', t: 0 };
    let distance = -1;
    let puissance = -1;
    let superVu = false;
    for (let i = 0; i < 600 && distance < 0; i++) {
      jeu.balle.x -= 0.004;
      if (s.intent) s.intent.t = 0; // l'appui reste en attente
      s.charge = charge;
      appliqueCommande(jeu, s, VIDE, PAS);
      s.charge = Math.max(s.charge, charge);
      for (const e of jeu.evenements.splice(0)) {
        if (e.type === 'frappe') {
          distance = Math.hypot(jeu.balle.x - s.x, jeu.balle.y - s.y);
          puissance = e.puissance;
          superVu = jeu.balle.super;
        }
      }
    }
    return { distance, puissance, superVu };
  }

  it('jauge pleine : le coup attend que la balle soit tout près, et c’est un super coup', () => {
    const plein = arrivee(1);
    const tard = arrivee(0.1);
    expect(plein.distance).toBeGreaterThan(0);
    expect(plein.distance).toBeLessThan(0.8);
    expect(tard.distance).toBeGreaterThan(1.2);
    expect(plein.superVu).toBe(true);
    expect(plein.puissance).toBe(1);
    // appuyer au dernier moment : jamais de super coup
    expect(tard.superVu).toBe(false);
    expect(tard.puissance).toBeLessThan(1);
  });

  it('un super coup repart comme un boulet après son rebond', () => {
    const vitesseApresRebond = (superCoup: boolean): number => {
      const jeu = partieTest({ mode: 'match', sieges: [0] }, 5);
      const s = jeu.joueurs[0]!;
      s.x = 6;
      s.y = 5;
      Object.assign(jeu.balle, { x: 6.5, y: 5, z: 0.8, vx: 5, vy: 0, vz: 0, sol: 1, camp: 0 });
      jeu.phase = 'jeu';
      executeCoup(jeu, s, 'plat', 0.97, xProf(1, 2.8), 5, null, { precision: 1, risque: false, superCoup });
      let v = 0;
      let rebonds = 0;
      for (let i = 0; i < 240 * 3 && rebonds === 0; i++)
        physique(jeu.balle, 1 / 240, (t) => {
          if (t === 'sol') {
            rebonds++;
            v = Math.hypot(jeu.balle.vx, jeu.balle.vy);
          }
        });
      return v;
    };
    expect(vitesseApresRebond(true)).toBeGreaterThan(vitesseApresRebond(false) * 1.2);
  });
});

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

describe('la jauge de smash', () => {
  it('les coups d’un long échange et les renvois de vitre remplissent la jauge de l’équipe qui frappe', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    const s = jeu.joueurs[0]!;
    jeu.phase = 'jeu';
    const frappe = () => {
      Object.assign(jeu.balle, { x: 5, y: 5, z: 1, vx: -3, vy: 0, vz: 0, camp: 0, sol: 1, coup: 'plat' });
      executeCoup(jeu, s, 'plat', 0.5, xProf(1, 3), 5);
    };
    for (let i = 0; i < 3; i++) frappe(); // échange court : rien
    expect(jeu.jaugeSmash[0]).toBe(0);
    frappe();
    expect(jeu.jaugeSmash[0]).toBeCloseTo(SMASH_GAIN_COUP);
    // un renvoi de vitre vaut davantage
    jeu.balle.mur = true;
    Object.assign(jeu.balle, { x: 5, y: 5, z: 1, camp: 0, sol: 1 });
    jeu.balle.mur = true;
    const avant = jeu.jaugeSmash[0];
    executeCoup(jeu, s, 'plat', 0.5, xProf(1, 3), 5);
    expect(jeu.jaugeSmash[0] - avant).toBeCloseTo(SMASH_GAIN_COUP + SMASH_GAIN_VITRE);
    expect(jeu.jaugeSmash[1]).toBe(0);
  });

  it('jauge pleine : le smash sur une balle haute est garanti par 3 / par 4, même au fond, puis la jauge se vide', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 12);
    const s = jeu.joueurs[0]!;
    jeu.phase = 'jeu';
    s.x = 1.5; // au fond : sinon une bandeja
    jeu.jaugeSmash[0] = 1;
    Object.assign(jeu.balle, { x: 2, y: 5, z: 2.6, vx: -1, vy: 0, vz: 0, camp: 0, sol: 0, coup: 'plat' });
    expect(coupPrevu(jeu, s, 'smash', 0.1)).toBe('smash');
    executeCoup(jeu, s, 'smash', 0.3, xProf(1, 5.5), 5);
    expect(jeu.balle.portres).toBe(true);
    expect(jeu.jaugeSmash[0]).toBe(0);
    // jauge vide : plus de garantie
    Object.assign(jeu.balle, { x: 2, y: 5, z: 2.6, camp: 0, sol: 0 });
    executeCoup(jeu, s, 'smash', 0.3, xProf(1, 5.5), 5);
    expect(jeu.balle.portres).toBe(false);
  });
});
