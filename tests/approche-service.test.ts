import { describe, expect, it } from 'vitest';
import { MIL } from '@core/constants';
import { peutApprocher } from '@core/approche';
import { partieTest } from './outils';

describe('le super coup en approche', () => {
  function situation(balle: object) {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 4);
    const s = jeu.joueurs[0]!;
    jeu.phase = 'jeu';
    jeu.jaugeSmash[s.eq] = 1;
    Object.assign(jeu.balle, {
      camp: s.eq,
      z: 1,
      vx: -3,
      vy: 0,
      vz: 0,
      sol: 0,
      roule: false,
      dehors: false,
      super: 0,
      service: false,
      ...balle,
    });
    return { jeu, s };
  }

  it('pas quand l’adversaire sert et que la balle est encore de son côté du filet', () => {
    const { jeu, s } = situation({ x: MIL + 3, service: true, sol: 0 });
    expect(peutApprocher(jeu, s)).toBe(false);
  });

  it('pas avant que le service ait rebondi, même de notre côté', () => {
    const { jeu, s } = situation({ x: MIL - 3, service: true, sol: 0 });
    expect(peutApprocher(jeu, s)).toBe(false);
  });

  it('oui une fois le service rebondi dans notre camp', () => {
    const { jeu, s } = situation({ x: MIL - 3, service: true, sol: 1 });
    expect(peutApprocher(jeu, s)).toBe(true);
  });

  it('oui pour une balle d’échange de notre côté, non si elle est de l’autre côté du filet', () => {
    const { jeu, s } = situation({ x: MIL - 4, sol: 1 });
    expect(peutApprocher(jeu, s)).toBe(true);
    jeu.balle.x = MIL + 2;
    expect(peutApprocher(jeu, s)).toBe(false);
  });
});
