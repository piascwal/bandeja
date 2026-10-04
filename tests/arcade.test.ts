import { describe, expect, it } from 'vitest';
import { physique } from '@core/balle';
import { ACCEL_MAX, HAUT_SMASH, PAS } from '@core/constants';
import { accelerationEchange, contrainte, executeCoup } from '@core/coups';
import { xProf } from '@core/terrain';
import { appliqueCommande, cibleCoup, coupAerien, coupPrevu, directionVisee } from '@core/humain';
import { pas } from '@core/partie';
import type { Commande } from '@core/types';
import { zonesBoutons } from '@input/disposition';
import { partieTest } from './outils';

const VIDE: Commande = { dx: 0, dy: 0, appuis: [] };

describe('un jeu d’arcade : on touche presque toujours la balle', () => {
  it('avec l’aide au déplacement, un simple appui renvoie la balle échange après échange', () => {
    const jeu = partieTest({ mode: 'match', jeux: 3, sieges: [0], niveau: 1, aide: true }, 31);
    let coups = 0;
    for (let i = 0; i < 120 * 90 && jeu.phase !== 'fin'; i++) {
      const appuie = jeu.phase === 'jeu' && jeu.balle.camp === 0 && i % 50 === 0;
      pas(jeu, PAS, () => (appuie ? { ...VIDE, appuis: ['plat'] } : VIDE));
      for (const e of jeu.evenements.splice(0)) if (e.type === 'frappe' && e.humain) coups++;
    }
    expect(coups).toBeGreaterThan(8);
  });

  it('le joueur est guidé vers la balle quand le joystick est au repos', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 8);
    const hum = jeu.joueurs[0]!;
    jeu.aide = true;
    jeu.phase = 'jeu';
    Object.assign(jeu.balle, { x: 4, y: 7, z: 1, vx: -2, vy: 0, vz: 0, camp: 0, sol: 1 });
    jeu.tPred = 100; // le plan posé à la main ne doit pas être recalculé
    hum.x = 8;
    hum.y = 2;
    jeu.plan[0] = { s: hum, x: 4, y: 7, z: 1, t: 1, sol: 1, ok: true, vitre: false, score: 0, sc: 0 };
    for (let i = 0; i < 120; i++) pas(jeu, PAS, () => VIDE);
    // à plus de 6 m au départ : il a bien avancé seul vers le point de frappe
    expect(Math.hypot(hum.x - 4, hum.y - 7)).toBeLessThan(4.2);
  });
});

describe('les boutons', () => {
  it('quatre petits boutons, sans COURIR ni bouton aérien', () => {
    const z = zonesBoutons(400, 200);
    expect(Object.keys(z).sort()).toEqual(['amorti', 'lobe', 'plat', 'smash']);
    for (const r of Object.values(z)) expect(r.r).toBeLessThanOrEqual(13);
  });

  it('FRAPPE peu chargé est un coup coupé, chargé un coup plat', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 2);
    const s = jeu.joueurs[0]!;
    jeu.balle.z = 0.8;
    expect(coupPrevu(jeu, s, 'plat', 0.1)).toBe('coupe');
    expect(coupPrevu(jeu, s, 'plat', 0.9)).toBe('plat');
    // même sur une balle haute, FRAPPE reste un coup normal : le smash est sur SMASH
    jeu.balle.z = HAUT_SMASH + 0.5;
    expect(coupPrevu(jeu, s, 'plat', 0.9)).toBe('plat');
    expect(coupPrevu(jeu, s, 'plat', 0.1)).toBe('coupe');
    jeu.balle.z = 0.8;
    expect(coupPrevu(jeu, s, 'lobe', 0.1)).toBe('lobe');
    expect(coupPrevu(jeu, s, 'amorti', 0.1)).toBe('amorti');
  });

  it('SMASH choisit seul selon la place et le timing', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 2);
    const s = jeu.joueurs[0]!;
    jeu.balle.z = HAUT_SMASH + 0.5;
    s.x = 8; // au filet
    expect(coupAerien(s, 0.9)).toBe('smash');
    expect(coupAerien(s, 0.3)).toBe('bandeja');
    s.x = 5; // à mi-court
    expect(coupAerien(s, 0.8)).toBe('vibora');
    expect(coupAerien(s, 0.3)).toBe('bandeja');
    s.x = 1; // au fond : on garde l'échange
    expect(coupAerien(s, 1)).toBe('bandeja');
    expect(coupPrevu(jeu, s, 'smash', 0.5)).toBe('bandeja');
    // balle basse : un coup à plat appuyé
    jeu.balle.z = 0.8;
    expect(coupPrevu(jeu, s, 'smash', 0.5)).toBe('plat');
  });
});

describe('la direction du coup', () => {
  it('le côté vient du joystick, et on peut le relâcher juste avant de frapper', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 2);
    const s = jeu.joueurs[0]!;
    s.y = 5;
    jeu.phase = 'jeu';
    pas(jeu, PAS, () => ({ ...VIDE, dy: -1 }));
    expect(cibleCoup(s, 'plat').ty).toBeLessThan(2);
    // joystick lâché : la direction tient encore un instant
    pas(jeu, PAS, () => VIDE);
    expect(directionVisee(s).y).toBe(-1);
    expect(cibleCoup(s, 'plat').ty).toBeLessThan(2);
    for (let i = 0; i < 120; i++) pas(jeu, PAS, () => VIDE);
    expect(directionVisee(s)).toEqual({ x: 0, y: 0 });
    pas(jeu, PAS, () => ({ ...VIDE, dy: 1 }));
    expect(cibleCoup(s, 'plat').ty).toBeGreaterThan(8);
  });

  it('poussé vers le filet, le coup est plus long ; tiré en arrière, plus court', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 2);
    const s = jeu.joueurs[0]!;
    jeu.phase = 'jeu';
    const long = (dx: number) => {
      pas(jeu, PAS, () => ({ ...VIDE, dx }));
      // équipe 0 : le miroir inverse dx, donc dx négatif = vers le filet (x croissant)
      return cibleCoup(s, 'plat').tx;
    };
    expect(long(-1)).toBeGreaterThan(long(1));
  });
});

describe('le jeu de vitre du padel', () => {
  it('un coup chargé rebondit, tape la vitre et revient en hauteur ; peu chargé, il garde la balle basse', () => {
    const retour = (p: number): number => {
      const jeu = partieTest({ mode: 'match', sieges: [0] }, 5);
      const s = jeu.joueurs[0]!;
      s.err = 0;
      s.x = 6;
      s.y = 5;
      Object.assign(jeu.balle, { x: 6.5, y: 5, z: 0.8, vx: 5, vy: 0, vz: 0, sol: 1, camp: 0 });
      jeu.phase = 'jeu';
      executeCoup(jeu, s, 'plat', p, xProf(1, 2.8), 5);
      let vitre = false;
      let zMax = 0;
      for (let i = 0; i < 240 * 4; i++) {
        physique(jeu.balle, 1 / 240, (t) => {
          if (t === 'vitre') vitre = true;
        });
        if (vitre && jeu.balle.x < 16) zMax = Math.max(zMax, jeu.balle.z);
      }
      expect(vitre).toBe(true);
      return zMax;
    };
    expect(retour(0.9)).toBeGreaterThan(retour(0.55) + 0.8);
  });

  it('le joueur n’est pas guidé quand la balle va d’abord rebondir sur une vitre', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 8);
    const hum = jeu.joueurs[0]!;
    jeu.phase = 'jeu';
    jeu.aide = true;
    jeu.tPred = 100;
    Object.assign(jeu.balle, { x: 4, y: 7, z: 1, vx: -2, vy: 0, vz: 0, camp: 0, sol: 1 });
    hum.x = 8;
    hum.y = 2;
    jeu.plan[0] = { s: hum, x: 1, y: 7, z: 1, t: 1, sol: 1, ok: true, vitre: true, score: 0, sc: 0 };
    for (let i = 0; i < 120; i++) pas(jeu, PAS, () => VIDE);
    expect(Math.hypot(hum.x - 8, hum.y - 2)).toBeLessThan(0.01);
  });

  it('le joueur reste à distance du filet', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 8);
    const hum = jeu.joueurs[0]!;
    for (let i = 0; i < 240; i++) pas(jeu, PAS, () => ({ ...VIDE, dx: -1 }));
    expect(Math.abs(hum.x - 10)).toBeGreaterThanOrEqual(0.79);
  });

  it('la vitre relance la balle à hauteur de jeu', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 5);
    const b = jeu.balle;
    Object.assign(b, { x: 19.99, y: 5, z: 0.5, vx: 8, vy: 0, vz: -2, spin: 'plat' });
    physique(b, 1 / 240);
    physique(b, 1 / 240);
    expect(b.vz).toBeGreaterThan(1.5);
  });

  it('sans l’option, le joueur n’est jamais conduit vers la balle', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 8);
    const hum = jeu.joueurs[0]!;
    expect(jeu.aide).toBe(false);
    jeu.phase = 'jeu';
    jeu.tPred = 100;
    Object.assign(jeu.balle, { x: 4, y: 7, z: 1, vx: -2, vy: 0, vz: 0, camp: 0, sol: 1 });
    hum.x = 8;
    hum.y = 2;
    jeu.plan[0] = { s: hum, x: 4, y: 7, z: 1, t: 1, sol: 1, ok: true, vitre: false, score: 0, sc: 0 };
    for (let i = 0; i < 120; i++) pas(jeu, PAS, () => VIDE);
    expect(Math.hypot(hum.x - 8, hum.y - 2)).toBeLessThan(0.01);
  });

  it('la balle accélère au fil de l’échange, avec un plafond', () => {
    expect(accelerationEchange(0)).toBe(1);
    expect(accelerationEchange(2)).toBe(1);
    expect(accelerationEchange(10)).toBeGreaterThan(accelerationEchange(5));
    expect(accelerationEchange(500)).toBeCloseTo(1 + ACCEL_MAX);
  });
});

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
    // le bouton SMASH ne répond pas
    pas(jeu, PAS, () => ({ ...VIDE, appuis: ['smash'] }));
    expect(s.intent).toBeNull();
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
