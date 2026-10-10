import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { appliqueCommande, coupPrevu, zoneDuTrait } from '@core/humain';
import { cibleCoup } from '@core/humain';
import { partieTest, simule } from './outils';
import { analyseTrait, SEUIL_LONG, SEUIL_TRAIT, type Point } from '@input/geste';
import { EmetteurEntrees, EntreeDistante } from '../src/net/entrees';

/** Un trait droit de (0,0) à (dx,dy), en n points. */
function droit(dx: number, dy: number, n = 12): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ x: (dx * i) / n, y: (dy * i) / n }));
}

/** Un trait de (0,0) à (dx,0) qui se creuse de `fleche` px (positif : vers le bas de l'écran). */
function courbe(dx: number, fleche: number, n = 16): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return { x: dx * t, y: fleche * 4 * t * (1 - t) };
  });
}

describe('la forme du trait choisit le coup et la zone', () => {
  it('pas de trait : FRAPPE ; tout petit trait : AMORTI', () => {
    expect(analyseTrait([]).type).toBe('plat');
    expect(analyseTrait([{ x: 5, y: 5 }]).type).toBe('plat');
    expect(analyseTrait(droit(SEUIL_TRAIT - 2, 0)).type).toBe('plat');
    expect(analyseTrait(droit(0, -(SEUIL_TRAIT + 8))).type).toBe('amorti');
    expect(analyseTrait(droit(-(SEUIL_LONG - 4), 0)).type).toBe('amorti');
  });

  it('vers le haut : LOB (le côté reste au joystick) ; sinon droit : FORT ; courbé : COURBE', () => {
    const lob = analyseTrait(droit(5, -(SEUIL_LONG + 30)));
    expect(lob.type).toBe('lobe');
    expect(lob.side).toBeNull();
    expect(analyseTrait(droit(-(SEUIL_LONG + 30), 0)).type).toBe('lourd');
    expect(analyseTrait(droit(0, SEUIL_LONG + 30)).type).toBe('lourd'); // vers le bas : pas un lob
    expect(analyseTrait(courbe(-70, -22)).type).toBe('courbe');
    expect(analyseTrait(courbe(-70, 22)).type).toBe('courbe');
    // un trait un peu irrégulier reste droit
    expect(analyseTrait(courbe(-70, 4)).type).toBe('lourd');
    // un lob courbé reste un lob
    expect(analyseTrait(courbe(-70, 22).map((p) => ({ x: p.y, y: p.x }))).type).not.toBe('amorti');
  });

  it('la direction où le trait finit règle le côté : vers le haut de l’écran, haut du terrain', () => {
    const haut = analyseTrait(droit(-60, -40));
    const bas = analyseTrait(droit(-60, 40));
    const plat = analyseTrait(droit(-60, 0));
    expect(haut.type).toBe('lourd');
    expect(haut.side!).toBeLessThan(-0.3);
    expect(bas.side!).toBeGreaterThan(0.3);
    expect(Math.abs(plat.side!)).toBeLessThan(0.1);
  });

  it('la courbure choisit le coin : le trait se creuse vers le haut, coin du haut ; vers le bas, coin du bas', () => {
    expect(analyseTrait(courbe(-70, -22)).side).toBe(-1);
    expect(analyseTrait(courbe(-70, 22)).side).toBe(1);
  });

  it('la longueur règle la profondeur', () => {
    const court = analyseTrait(droit(-(SEUIL_LONG + 4), 0));
    const long = analyseTrait(droit(-120, 0));
    expect(long.prof).toBeGreaterThan(court.prof);
    expect(long.prof).toBeLessThanOrEqual(1);
    expect(court.prof).toBeGreaterThanOrEqual(0);
  });
});

describe('la zone du trait sur la balle', () => {
  it('le côté et la profondeur du trait remplacent ceux du joystick, sauf pour le lob', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 3);
    const s = jeu.humain!;
    const base = cibleCoup(s, 'plat');
    const haut = zoneDuTrait(s.eq, 'plat', base, { side: -1, prof: 0.5 });
    const bas = zoneDuTrait(s.eq, 'plat', base, { side: 1, prof: 0.5 });
    expect(haut.ty).toBeLessThan(2);
    expect(bas.ty).toBeGreaterThan(8);
    // profond (trait long) : plus près de la vitre adverse que court
    const profond = zoneDuTrait(s.eq, 'plat', base, { side: 0, prof: 1 });
    const court = zoneDuTrait(s.eq, 'plat', base, { side: 0, prof: 0 });
    expect(Math.abs(profond.tx - 20)).toBeLessThan(Math.abs(court.tx - 20));
    // lob : le côté reste celui du joystick
    const lob = zoneDuTrait(s.eq, 'lobe', cibleCoup(s, 'lobe'), { side: null, prof: 0.5 });
    expect(lob.ty).toBe(cibleCoup(s, 'lobe').ty);
    // víbora : le coin
    expect(zoneDuTrait(s.eq, 'vibora', cibleCoup(s, 'vibora'), { side: -1, prof: 0.5 }).ty).toBeLessThan(2);
    expect(zoneDuTrait(s.eq, 'vibora', cibleCoup(s, 'vibora'), { side: 1, prof: 0.5 }).ty).toBeGreaterThan(8);
    // sans trait : rien ne change
    expect(zoneDuTrait(s.eq, 'plat', base, null)).toEqual(base);
  });
});

describe('armer en posant le doigt, déclencher au relâchement', () => {
  /** Un humain en place, la balle à portée de sa raquette, un doigt posé (arme). */
  function pose() {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 3);
    jeu.phase = 'jeu';
    const s = jeu.humain!;
    s.x = 6;
    s.y = 5;
    Object.assign(jeu.balle, { x: 6.4, y: 5, z: 0.9, vx: -1, vy: 0, vz: 0, camp: 0, sol: 0, coup: 'plat' });
    return { jeu, s };
  }

  it('tant que le doigt est posé, aucun coup ne part ; le trait fini le déclenche, avec son type et sa zone', () => {
    const { jeu, s } = pose();
    const evs: { coup: string; humain: boolean }[] = [];
    const lis = () => {
      for (const e of jeu.evenements) if (e.type === 'frappe' && e.humain) evs.push(e);
      jeu.evenements.length = 0;
    };
    // le doigt se pose : armé, mais rien ne part malgré la balle à portée
    simule(jeu, 0.05, () => ({ dx: 0, dy: 0, appuis: ['plat'], arme: true }));
    lis();
    simule(jeu, 0.6, () => ({ dx: 0, dy: 0, appuis: [], arme: true }));
    lis();
    expect(evs).toHaveLength(0);
    expect(s.intent).not.toBeNull();
    // le trait fini : un petit trait, AMORTI, vers le haut du terrain
    appliqueCommande(
      jeu,
      s,
      { dx: 0, dy: 0, appuis: ['amorti'], arme: false, trait: { side: -0.8, prof: 0.2 } },
      PAS,
    );
    lis();
    expect(evs.map((e) => e.coup)).toEqual(['amorti']);
    expect(jeu.balle.vy).toBeLessThan(0); // vers le haut du terrain
    expect(s.trait).toBeNull();
  });

  it('un trait courbe est une víbora, à toute hauteur', () => {
    const { jeu, s } = pose();
    jeu.balle.z = 0.8;
    expect(coupPrevu(jeu, s, 'courbe', 0.5)).toBe('vibora');
    expect(coupPrevu(jeu, s, 'lourd', 0.9)).toBe('plat');
  });

  it('le trait voyage jusqu’à l’hôte avec l’appui du coup ; un simple appui efface la zone', () => {
    const e = new EmetteurEntrees();
    const d = new EntreeDistante();
    e.suit({ dx: 0, dy: 0, appuis: ['plat'], arme: true });
    expect(d.recoit(e.encode(), 0)).toBe(true);
    e.suit({ dx: 0, dy: 0, appuis: ['courbe'], arme: false, trait: { side: -1, prof: 0.7 } });
    expect(d.recoit(e.encode(), 0.1)).toBe(true);
    const c = d.commande(0.1);
    expect(c.appuis).toContain('courbe');
    expect(c.trait?.side).toBe(-1);
    expect(c.trait?.prof).toBeCloseTo(0.7, 1);
    // le trait « côté du joystick » (lob)
    e.suit({ dx: 0, dy: 0, appuis: ['lobe'], trait: { side: null, prof: 0.3 } });
    d.recoit(e.encode(), 0.2);
    expect(d.commande(0.2).trait?.side).toBeNull();
    // un doigt qui se pose (sans trait) efface la zone
    e.suit({ dx: 0, dy: 0, appuis: ['plat'], arme: true });
    d.recoit(e.encode(), 0.3);
    expect(d.commande(0.3).trait).toBeUndefined();
  });
});
