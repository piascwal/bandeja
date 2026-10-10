import { describe, expect, it } from 'vitest';
import { BANDEAU_S, FINALE_FIN_S, FinaleSuper, RYTHME_FINALE } from '../src/render/finale-super';
import { Effets } from '../src/render/effets';
import { DUREE_POINT_SUPER, FINALE_SUPER_S, RALENTI_CLIP, RALENTI_RYTHME } from '@core/constants';

describe('fin spectaculaire du super coup', () => {
  it('le bandeau du point attend la fin de la scène', () => {
    const fx = new Effets();
    fx.finale.declenche(1, 100, 80);
    fx.differe('METEORE !', null, '#fff');
    for (let t = 0; t < (BANDEAU_S - 0.2) / RYTHME_FINALE; t += 0.05) fx.maj(0.05);
    expect(fx.banniere).toBeNull();
    for (let t = 0; t < 0.6 / RYTHME_FINALE; t += 0.05) fx.maj(0.05);
    expect(fx.banniere).not.toBeNull();
  });

  it('un appui passe la scène : le bandeau tombe aussitôt', () => {
    const fx = new Effets();
    fx.finale.declenche(2, 10, 10);
    fx.differe('VOLCAN !', null, '#fff');
    fx.maj(0.1);
    expect(fx.banniere).toBeNull();
    fx.finale.arrete();
    fx.maj(0.1);
    expect(fx.banniere).not.toBeNull();
  });

  it('le zoom retombe, et le point dure assez pour la scène puis le ralenti', () => {
    const fx = new Effets();
    fx.finale.declenche(3, 0, 0);
    fx.maj(0.1);
    expect(fx.finale.zoom).toBeGreaterThan(1.3);
    for (let t = 0; t < (FINALE_FIN_S + 0.2) / RYTHME_FINALE; t += 0.05) fx.maj(0.05);
    expect(fx.finale.actif).toBe(false);
    expect(fx.finale.zoom).toBe(1);
    expect(DUREE_POINT_SUPER).toBeGreaterThan(FINALE_SUPER_S + RALENTI_CLIP / RALENTI_RYTHME);
    // la scène (temps réel) tient dans l'attente du ralenti (temps de simulation, à 0,8 du réel)
    expect(FINALE_SUPER_S / 0.8).toBeGreaterThanOrEqual(FINALE_FIN_S / RYTHME_FINALE);
    // elle dure plus longtemps qu'avant (3,8 s)
    expect(FINALE_FIN_S / RYTHME_FINALE).toBeGreaterThan(5);
  });
});

describe('cap de la montée', () => {
  it('garde le cap donné, borné entre -1 et 1', () => {
    const f = new FinaleSuper();
    f.declenche(1, 10, 10, 0.4);
    expect(f.cap).toBe(0.4);
    f.declenche(1, 10, 10, -7);
    expect(f.cap).toBe(-1);
    f.declenche(1, 10, 10);
    expect(f.cap).toBe(0);
  });
});
