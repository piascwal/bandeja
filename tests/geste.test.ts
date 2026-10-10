import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { appliqueCommande, coupPrevu } from '@core/humain';
import { classeGeste, SEUIL_LONG, SEUIL_TRAIT } from '@input/geste';
import { EmetteurEntrees, EntreeDistante } from '../src/net/entrees';
import { partieTest } from './outils';

describe('le trait qui choisit le coup', () => {
  it('pas de trait : FRAPPE ; tout petit trait : AMORTI ; vers le haut : LOB ; autre trait normal : FORT', () => {
    expect(classeGeste(0, 0)).toBe('plat');
    expect(classeGeste(SEUIL_TRAIT - 1, 0)).toBe('plat');
    expect(classeGeste(0, -(SEUIL_TRAIT + 4))).toBe('amorti');
    expect(classeGeste(-(SEUIL_TRAIT + 4), 0)).toBe('amorti');
    expect(classeGeste(0, -(SEUIL_LONG + 10))).toBe('lobe');
    expect(classeGeste(10, -(SEUIL_LONG + 20))).toBe('lobe'); // un peu de travers : toujours vers le haut
    expect(classeGeste(-(SEUIL_LONG + 20), 0)).toBe('lourd');
    expect(classeGeste(-(SEUIL_LONG + 20), -5)).toBe('lourd');
    expect(classeGeste(0, SEUIL_LONG + 20)).toBe('lourd'); // vers le bas : pas un lob
    expect(classeGeste(30, -30)).toBe('lourd'); // à 45° pile : fort
  });
});

describe('la frappe lourde et le doigt qui tient ARMER', () => {
  function armee(type: 'plat' | 'lourd') {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 3);
    jeu.phase = 'jeu';
    const s = jeu.humain!;
    appliqueCommande(jeu, s, { dx: 0, dy: 0, appuis: [type] }, PAS);
    return { jeu, s };
  }

  it('LOURD est armé presque à fond tout de suite, FRAPPE monte peu à peu', () => {
    const lourd = armee('lourd');
    const plat = armee('plat');
    expect(lourd.s.charge).toBeGreaterThanOrEqual(0.9);
    expect(plat.s.charge).toBeLessThan(0.1);
    lourd.jeu.balle.z = 0.8;
    expect(coupPrevu(lourd.jeu, lourd.s, 'lourd', lourd.s.charge)).toBe('plat');
    plat.jeu.balle.z = 0.8;
    expect(coupPrevu(plat.jeu, plat.s, 'plat', plat.s.charge)).toBe('coupe');
  });

  it('le trait remplace le coup armé ; tant que le doigt tient, le coup n’est pas oublié', () => {
    const { jeu, s } = armee('plat');
    appliqueCommande(jeu, s, { dx: 0, dy: 0, appuis: ['amorti'], arme: true }, PAS);
    expect(s.intent!.type).toBe('amorti');
    for (let i = 0; i < 2 / PAS; i++) appliqueCommande(jeu, s, { dx: 0, dy: 0, appuis: [], arme: true }, PAS);
    expect(s.intent).not.toBeNull();
    // le doigt part : l'appui est oublié au bout de 0,7 s
    for (let i = 0; i < 1 / PAS; i++) appliqueCommande(jeu, s, { dx: 0, dy: 0, appuis: [] }, PAS);
    expect(s.intent).toBeNull();
  });

  it('LOURD et « doigt tenu » voyagent jusqu’à l’hôte', () => {
    const e = new EmetteurEntrees();
    e.suit({ dx: 0, dy: 0, appuis: ['lourd'], arme: true });
    const d = new EntreeDistante();
    expect(d.recoit(e.encode(), 0)).toBe(true);
    e.suit({ dx: 0, dy: 0, appuis: ['lourd'], arme: true });
    expect(d.recoit(e.encode(), 0.1)).toBe(true);
    const c = d.commande(0.1);
    expect(c.appuis).toContain('lourd');
    expect(c.arme).toBe(true);
  });
});
