import { describe, expect, it } from 'vitest';
import { affinite, GAIN_JAUGE, niveauDe, qualite, type Situation } from '@core/qualite';

const base: Situation = {
  z: 1,
  vitesse: 10,
  loin: 4,
  prev: 'plat',
  mur: false,
  precision: 1,
  charge: 1,
  filetAdverse: false,
};
const sit = (o: Partial<Situation>): Situation => ({ ...base, ...o });

describe('le moteur de qualité des coups', () => {
  it('cinq niveaux, du plus médiocre au parfait', () => {
    expect([0, 0.19, 0.2, 0.39, 0.4, 0.57, 0.58, 0.74, 0.75, 1].map(niveauDe)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
  });

  it('un lob lent et haut, bien placé au filet : un gros smash parfait', () => {
    const q = qualite('smash', sit({ z: 2.6, vitesse: 6, loin: 2.5, prev: 'lobe' }));
    expect(q.niveau).toBe(5);
  });

  it('un smash sur une balle basse reçue après un amorti : un coup médiocre', () => {
    const q = qualite('smash', sit({ z: 0.3, vitesse: 5, loin: 2, prev: 'amorti' }));
    expect(q.niveau).toBeLessThanOrEqual(1);
  });

  it('un super lob est plus facile après une balle lente revenue de la vitre à mi-hauteur', () => {
    const apresVitre = qualite('lobe', sit({ z: 1.1, vitesse: 8, mur: true, loin: 7 }));
    const apresBoulet = qualite('lobe', sit({ z: 1.1, vitesse: 26, mur: false, loin: 7 }));
    expect(apresVitre.score).toBeGreaterThan(apresBoulet.score + 0.25);
    expect(apresVitre.niveau).toBe(5);
  });

  it('un amorti réussit au filet sur une balle basse et lente, pas depuis le fond', () => {
    const filet = qualite('amorti', sit({ z: 0.4, vitesse: 7, loin: 2 }));
    const fond = qualite('amorti', sit({ z: 0.4, vitesse: 7, loin: 8 }));
    expect(filet.niveau).toBeGreaterThanOrEqual(4);
    expect(fond.score).toBeLessThan(filet.score - 0.15);
  });

  it('une volée bien choisie contre une balle rapide n’est pas rouge : le coup est un peu moins beau, pas mauvais', () => {
    const volee = qualite('plat', sit({ z: 1.2, vitesse: 24, loin: 3, precision: 0.5, charge: 0.4 }));
    expect(volee.niveau).toBeGreaterThanOrEqual(3);
    // le même coup sur une balle lente est au moins aussi bon
    const lente = qualite('plat', sit({ z: 1.2, vitesse: 9, loin: 3, precision: 0.5, charge: 0.4 }));
    expect(lente.score).toBeGreaterThan(volee.score);
  });

  it('un coup aérien bien joué sur une balle haute est vert, même sans charge maximale', () => {
    const q = qualite('smash', sit({ z: 2.4, vitesse: 14, loin: 3, precision: 0.7, charge: 0.7 }));
    expect(q.niveau).toBeGreaterThanOrEqual(4);
    // un coup à plat sur cette balle haute reste médiocre : c'est le coup aérien qu'il fallait
    expect(qualite('plat', sit({ z: 2.4, vitesse: 14, loin: 3 })).niveau).toBeLessThanOrEqual(3);
  });

  it('un lob prend les adversaires au filet à revers, un amorti ceux du fond de court', () => {
    const lobAuFilet = qualite('lobe', sit({ z: 1, filetAdverse: true }));
    const lobAuFond = qualite('lobe', sit({ z: 1, filetAdverse: false }));
    expect(lobAuFilet.score).toBeGreaterThan(lobAuFond.score);
    const amortiAuFond = qualite('amorti', sit({ z: 0.4, loin: 3, vitesse: 7, filetAdverse: false }));
    const amortiAuFilet = qualite('amorti', sit({ z: 0.4, loin: 3, vitesse: 7, filetAdverse: true }));
    expect(amortiAuFond.score).toBeGreaterThanOrEqual(amortiAuFilet.score);
  });

  it('un coup coupé aime les balles basses, un plat les balles à mi-hauteur', () => {
    expect(affinite('coupe', sit({ z: 0.3 }))).toBeGreaterThan(affinite('coupe', sit({ z: 1.8 })));
    expect(affinite('plat', sit({ z: 1 }))).toBeGreaterThan(affinite('plat', sit({ z: 2.5 })));
  });

  it('le timing et la charge comptent pour les coups de puissance, la charge pas pour les coups de finesse', () => {
    const bon = qualite('plat', sit({ precision: 1, charge: 1 })).score;
    expect(qualite('plat', sit({ precision: 0.1, charge: 1 })).score).toBeLessThan(bon);
    expect(qualite('plat', sit({ precision: 1, charge: 0.05 })).score).toBeLessThan(bon);
    expect(qualite('lobe', sit({ charge: 0.05 })).score).toBe(qualite('lobe', sit({ charge: 1 })).score);
  });

  it('une balle très rapide est plus dure à bien jouer', () => {
    expect(qualite('plat', sit({ vitesse: 30 })).score).toBeLessThan(
      qualite('plat', sit({ vitesse: 8 })).score,
    );
  });

  it('les plus beaux coups remplissent bien plus vite la jauge', () => {
    expect(GAIN_JAUGE[5]!).toBeGreaterThan(GAIN_JAUGE[3]! * 1.5);
    expect(GAIN_JAUGE[1]!).toBeLessThan(0.02);
    for (let n = 2; n <= 5; n++) expect(GAIN_JAUGE[n]!).toBeGreaterThan(GAIN_JAUGE[n - 1]!);
  });
});
