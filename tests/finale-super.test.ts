import { describe, expect, it } from 'vitest';
import { ajouteCratere, BANDEAU_S, FINALE_FIN_S, lisCrateres } from '../src/render/finale-super';
import { Effets } from '../src/render/effets';
import { DUREE_POINT_SUPER, FINALE_SUPER_S, RALENTI_CLIP, RALENTI_RYTHME } from '@core/constants';

describe('fin spectaculaire du super coup', () => {
  it('le bandeau du point attend la fin de la scène', () => {
    const fx = new Effets();
    fx.finale.declenche(1, 100, 80);
    fx.differe('METEORE !', null, '#fff');
    for (let t = 0; t < BANDEAU_S - 0.2; t += 0.05) fx.maj(0.05);
    expect(fx.banniere).toBeNull();
    for (let t = 0; t < 0.6; t += 0.05) fx.maj(0.05);
    expect(fx.banniere).not.toBeNull();
  });

  it('un appui passe la scène : le bandeau tombe aussitôt', () => {
    const fx = new Effets();
    fx.finale.declenche(2, 10, 10);
    fx.differe('COMETE !', null, '#fff');
    fx.maj(0.1);
    expect(fx.banniere).toBeNull();
    fx.finale.arrete();
    fx.maj(0.1);
    expect(fx.banniere).not.toBeNull();
  });

  it('le zoom retombe, et le point dure assez pour la scène puis le ralenti', () => {
    const fx = new Effets();
    fx.finale.declenche(4, 0, 0);
    fx.maj(0.1);
    expect(fx.finale.zoom).toBeGreaterThan(1.3);
    for (let t = 0; t < FINALE_FIN_S + 0.2; t += 0.05) fx.maj(0.05);
    expect(fx.finale.actif).toBe(false);
    expect(fx.finale.zoom).toBe(1);
    expect(DUREE_POINT_SUPER).toBeGreaterThan(FINALE_SUPER_S + RALENTI_CLIP / RALENTI_RYTHME);
    expect(FINALE_SUPER_S).toBeGreaterThanOrEqual(FINALE_FIN_S);
  });
});

describe('les cratères de la lune', () => {
  it('chaque balle laisse un cratère, les plus anciens finissent par s’effacer', () => {
    let lune: ReturnType<typeof lisCrateres> = [];
    for (let i = 0; i < 55; i++) lune = ajouteCratere(lune, { x: (i % 10) / 10, y: 0.5, r: 16 });
    expect(lune).toHaveLength(40);
    expect(lune[39]).toEqual({ x: 0.4, y: 0.5, r: 16 });
  });

  it('relit les cratères sauvegardés en ignorant tout ce qui est abîmé', () => {
    expect(lisCrateres(null)).toEqual([]);
    expect(lisCrateres('pas du json')).toEqual([]);
    expect(lisCrateres('{"x":1}')).toEqual([]);
    const bon = { x: 0.3, y: 0.6, r: 16 };
    const brut = JSON.stringify([bon, { x: 4, y: 0.6, r: 16 }, { x: 0.3, y: 0.6, r: 500 }, 'x', null]);
    expect(lisCrateres(brut)).toEqual([bon]);
  });

  it('la scène choisit où la balle s’écrase, et ajoute son cratère une seule fois', () => {
    const fx = new Effets();
    fx.finale.declenche(1, 0, 0);
    expect(fx.finale.xLune).toBeGreaterThanOrEqual(0.3);
    expect(fx.finale.xLune).toBeLessThanOrEqual(0.7);
    expect(fx.finale.cratereAjoute).toBe(false);
    fx.finale.ajouteCratereLune(16);
    fx.finale.ajouteCratereLune(16);
    expect(fx.finale.cratereAjoute).toBe(true);
  });
});
