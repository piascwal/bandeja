import { describe, expect, it } from 'vitest';
import { graine } from '@core/aleatoire';
import { nouvelleBalle, physique } from '@core/balle';
import { MIL, PAS, PERIODE_JAUGE, SERV } from '@core/constants';
import { contreVitre } from '@core/contre-vitre';
import { cibleService, jaugeVal } from '@core/service';
import { partieTest } from './outils';

describe('jauge de service', () => {
  it('monte de 0 à 1 puis redescend', () => {
    expect(jaugeVal(0)).toBe(0);
    expect(jaugeVal(PERIODE_JAUGE)).toBeCloseTo(1);
    expect(jaugeVal(2 * PERIODE_JAUGE)).toBeCloseTo(0);
    for (let t = 0; t < 5; t += 0.01) {
      expect(jaugeVal(t)).toBeGreaterThanOrEqual(0);
      expect(jaugeVal(t)).toBeLessThanOrEqual(1);
    }
  });
});

describe('placement du service', () => {
  it('serveur dans son camp, receveur en diagonale, cible dans le carré', () => {
    const jeu = partieTest();
    const s = jeu.serveur;
    const r = jeu.receveur;
    expect(s.eq).not.toBe(r.eq);
    expect(s.posServ.y > 5).not.toBe(r.posServ.y > 5);
    for (const vise of [-1, 0, 1]) {
      const c = cibleService(s, vise);
      expect(Math.abs(c.x - MIL)).toBeLessThan(SERV);
      expect(c.y > 5).toBe(r.posServ.y > 5);
    }
  });
});

describe('contre-vitre', () => {
  it('trouve un élan qui touche sa vitre du fond puis retombe chez l’adversaire', () => {
    const b = nouvelleBalle();
    Object.assign(b, { x: 1, y: 5, z: 0.6 });
    expect(contreVitre(b, 0, 5, 'fond', graine(1))).toBe(true);
    const contacts: string[] = [];
    let fin = false;
    for (let i = 0; i < 1000 && !fin; i++) {
      physique(b, PAS, (t, cote) => {
        contacts.push(`${t}:${cote}`);
        if (t === 'sol') fin = true;
      });
    }
    expect(contacts[0]).toBe('vitre:0');
    expect(contacts.at(-1)).toBe('sol:1');
  });
});
