import { describe, expect, it } from 'vitest';
import type { Instantane } from '../src/net/instantane';
import { instantaneDe } from '../src/net/instantane';
import { interpole, plusRecent, Synchro } from '../src/net/synchro';
import { partieTest } from './outils';

/** Un instantané à l'instant `t` (s), la balle et le premier joueur en x. */
function snap(
  t: number,
  x: number,
  seq = Math.round(t * 1000),
  mod: (s: Instantane) => void = () => {},
): Instantane {
  const s = instantaneDe(partieTest(), seq);
  s.t = t;
  s.joueurs[0]!.x = x;
  s.balle.x = x;
  mod(s);
  return s;
}

describe('numéros qui tournent en boucle', () => {
  it('compare des numéros sur 16 bits', () => {
    expect(plusRecent(5, 4)).toBe(true);
    expect(plusRecent(4, 5)).toBe(false);
    expect(plusRecent(4, 4)).toBe(false);
    expect(plusRecent(2, 65534)).toBe(true); // le compteur a bouclé
    expect(plusRecent(65534, 2)).toBe(false);
  });
});

describe('interpolation', () => {
  it('lisse les positions entre deux instantanés', () => {
    const m = interpole(snap(1, 4), snap(1.05, 5), 0.5);
    expect(m.joueurs[0]!.x).toBeCloseTo(4.5);
    expect(m.balle.x).toBeCloseTo(4.5);
    expect(m.t).toBeCloseTo(1.025);
  });

  it('ne glisse pas à travers une téléportation (service, engagement)', () => {
    const m = interpole(snap(1, 3), snap(1.05, 12), 0.5);
    expect(m.joueurs[0]!.x).toBe(12);
    expect(m.balle.x).toBe(12);
  });

  it("ne mélange pas deux phases de jeu : on prend l'instantané le plus proche", () => {
    const b = snap(1.05, 5, undefined, (s) => (s.phase = 'point'));
    expect(interpole(snap(1, 4), b, 0.2).phase).not.toBe('point');
    expect(interpole(snap(1, 4), b, 0.8).phase).toBe('point');
  });
});

describe('tampon de l’invité', () => {
  it("ne rend rien tant qu'on n'a rien reçu", () => {
    expect(new Synchro().echantillon(1000)).toBeNull();
    expect(new Synchro().evenementsAJouer(1000)).toEqual([]);
  });

  it('affiche avec un léger retard et interpole', () => {
    const s = new Synchro();
    s.recoit(snap(1, 4), 1000);
    s.recoit(snap(1.05, 5), 1050);
    // 55 ms plus tard sur l'horloge locale, avec 30 ms de retard : on affiche t = 1,025
    expect(s.echantillon(1055)!.joueurs[0]!.x).toBeCloseTo(4.5, 1);
    expect(s.retardMs).toBeCloseTo(30, 5);
  });

  it("n'extrapole jamais : au bout du tampon, on garde le dernier instantané", () => {
    const s = new Synchro();
    s.recoit(snap(1, 4), 1000);
    s.recoit(snap(1.05, 5), 1050);
    expect(s.echantillon(5000)!.joueurs[0]!.x).toBe(5);
  });

  it('ignore les doublons et les paquets arrivés dans le désordre', () => {
    const s = new Synchro();
    s.recoit(snap(1.1, 6), 1100);
    s.recoit(snap(1.05, 5), 1110); // plus vieux, arrivé après
    s.recoit(snap(1.1, 6), 1120); // doublon
    s.recoit(snap(1.15, 7), 1150);
    expect(s.echantillon(9999)!.joueurs[0]!.x).toBe(7);
  });

  it('allonge son retard quand le Wi-Fi est irrégulier, et le garde borné', () => {
    const calme = new Synchro();
    const agite = new Synchro();
    for (let i = 0; i < 100; i++) {
      calme.recoit(snap(i * 0.016, 4), i * 16);
      agite.recoit(snap(i * 0.016, 4), i * 16 + (i % 2 ? 70 : 0));
    }
    expect(calme.retardMs).toBeLessThan(40);
    expect(agite.retardMs).toBeGreaterThan(calme.retardMs + 50);
    expect(agite.retardMs).toBeLessThanOrEqual(250);
  });

  it("rend les évènements datés au moment où l'image correspondante s'affiche, dans l'ordre", () => {
    const s = new Synchro();
    s.recoit(snap(1, 4), 1000);
    s.recoitEvenement({ type: 'let' }, 1.2);
    s.recoitEvenement({ type: 'pointEnOr' }, 1.1);
    expect(s.evenementsAJouer(1100)).toEqual([]); // l'image affichée est encore à t = 1,07
    expect(s.evenementsAJouer(1150).map((e) => e.type)).toEqual(['pointEnOr']);
    expect(s.evenementsAJouer(1300).map((e) => e.type)).toEqual(['let']);
    expect(s.evenementsAJouer(1300)).toEqual([]);
  });

  it('repart de zéro après une réinitialisation', () => {
    const s = new Synchro();
    s.recoit(snap(1, 4), 1000);
    s.reinitialise();
    expect(s.echantillon(1100)).toBeNull();
    s.recoit(snap(0.5, 9, 3), 1100); // même un numéro plus ancien est accepté de nouveau
    expect(s.echantillon(1200)!.joueurs[0]!.x).toBe(9);
  });
});
