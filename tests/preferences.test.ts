import { describe, expect, it } from 'vitest';
import { lisPreferences } from '@app/preferences';
import { hslRgb, rgbHsl } from '@render/couleurs';

describe('préférences', () => {
  it('reprend une sauvegarde du POC', () => {
    const p = lisPreferences('{"niveau":2,"jeux":3,"son":false,"victoires":[1,2,3],"matchs":[4,5,6]}');
    expect(p).toEqual({
      niveau: 2,
      jeux: 3,
      son: false,
      nom: expect.any(String),
      victoires: [1, 2, 3],
      matchs: [4, 5, 6],
    });
  });

  it('ignore les valeurs abîmées', () => {
    expect(lisPreferences('pas du json').niveau).toBe(1);
    const p = lisPreferences('{"niveau":9,"jeux":-1,"son":"oui","victoires":"x"}');
    expect(p).toEqual({
      niveau: 1,
      jeux: 1,
      son: true,
      nom: expect.any(String),
      victoires: [0, 0, 0],
      matchs: [0, 0, 0],
    });
  });
});

describe('nom du joueur', () => {
  it('garde un nom valide et en tire un autre quand il est invalide ou absent', () => {
    expect(lisPreferences('{"nom":"LYNX 12"}').nom).toBe('LYNX 12');
    for (const mauvais of ['<script>', 'a'.repeat(40), '', 12, null]) {
      expect(lisPreferences(JSON.stringify({ nom: mauvais })).nom).toMatch(/^JOUEUR \d\d$/);
    }
    expect(lisPreferences(null).nom).toMatch(/^JOUEUR \d\d$/);
  });
});

describe('couleurs', () => {
  it('TSL et RVB font l’aller-retour', () => {
    const essais: [number, number, number][] = [
      [245, 65, 94],
      [46, 200, 245],
      [10, 10, 10],
      [255, 255, 255],
    ];
    for (const [r, g, b] of essais) {
      const [h, s, l] = rgbHsl(r, g, b);
      expect(hslRgb(h, s, l)).toEqual([r, g, b]);
    }
  });
});
