import { describe, expect, it } from 'vitest';
import { graine } from '@core/aleatoire';
import { ACE_PROBA, JAUGE_PARFAITE, PAS, ZONE_ACE } from '@core/constants';
import { frappable } from '@core/coups';
import { appliqueCommande, changeDeJoueur, changePossible } from '@core/humain';
import { partenaire } from '@core/joueurs';
import { servir } from '@core/service';
import { partieTest, simule } from './outils';

describe('CHANGE : prendre la main sur le partenaire', () => {
  it('disponible pour un seul humain face au CPU, pas à deux humains', () => {
    const solo = partieTest({ mode: 'match', sieges: [0] }, 3);
    expect(changePossible(solo)).toBe(true);
    const duo = partieTest({ mode: 'match', sieges: [0, 1] }, 3);
    expect(changePossible(duo)).toBe(false);
    const adversaires = partieTest({ mode: 'match', sieges: [0, 2] }, 3);
    expect(changePossible(adversaires)).toBe(false);
  });

  it('pendant un point : le partenaire devient le joueur, l’ancien repasse au CPU', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 3);
    jeu.phase = 'jeu';
    const moi = jeu.humain!;
    const autre = partenaire(jeu, moi);
    expect(changeDeJoueur(jeu, moi)).toBe(true);
    expect(jeu.humain).toBe(autre);
    expect(autre.humain).toBe(true);
    expect(moi.humain).toBe(false);
    expect(jeu.humains).toEqual([autre]);
    expect(changePossible(jeu)).toBe(true); // et on peut rechanger
    expect(changeDeJoueur(jeu, autre)).toBe(true);
    expect(jeu.humain).toBe(moi);
  });

  it('refusé au service, et seulement par le joueur actuel', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 3);
    expect(jeu.phase).toBe('service');
    expect(changeDeJoueur(jeu, jeu.humain!)).toBe(false);
    jeu.phase = 'jeu';
    expect(changeDeJoueur(jeu, partenaire(jeu, jeu.humain!))).toBe(false);
  });

  it('l’appui sur CHANGE passe par la commande ; le CPU joue pour l’autre pendant ce temps', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0] }, 3);
    jeu.phase = 'jeu';
    const moi = jeu.humain!;
    appliqueCommande(jeu, moi, { dx: 0, dy: 0, appuis: ['change'] }, PAS);
    expect(moi.humain).toBe(false);
    // le point continue sans plantage, le nouvel humain est piloté par la commande
    simule(jeu, 3, () => ({ dx: 0, dy: 0, appuis: [] }));
    expect(jeu.humains.length).toBe(1);
  });
});

describe('ACE : la zone or au milieu du vert', () => {
  it('est fine et au milieu du vert', () => {
    expect(ZONE_ACE.min).toBeGreaterThan(JAUGE_PARFAITE.min);
    expect(ZONE_ACE.max).toBeLessThan(JAUGE_PARFAITE.max);
    expect(ZONE_ACE.max - ZONE_ACE.min).toBeLessThan((JAUGE_PARFAITE.max - JAUGE_PARFAITE.min) / 3);
    expect((ZONE_ACE.min + ZONE_ACE.max) / 2).toBeCloseTo((JAUGE_PARFAITE.min + JAUGE_PARFAITE.max) / 2, 1);
  });

  /** Un service avec cette jauge, sur beaucoup de graines : combien d'aces. */
  function aces(gv: number, n = 80) {
    let nb = 0;
    for (let i = 0; i < n; i++) {
      const jeu = partieTest({ mode: 'match', sieges: [0] }, 100 + i);
      jeu.rng = graine(1000 + i);
      servir(jeu, jeu.serveur, 'plat', gv, 0);
      if (jeu.balle.ace) nb++;
    }
    return nb / n;
  }

  it('au centre : presque toujours un ace ; ailleurs dans le vert ou en dehors : jamais', () => {
    expect(aces((ZONE_ACE.min + ZONE_ACE.max) / 2)).toBeGreaterThan(ACE_PROBA - 0.15);
    expect(aces(JAUGE_PARFAITE.min + 0.01)).toBe(0);
    expect(aces(JAUGE_PARFAITE.max - 0.01)).toBe(0);
    expect(aces(0.3)).toBe(0);
  });

  it('un ace est imparable et gagne le point à son rebond dans le carré', () => {
    let gagne = 0;
    let essais = 0;
    for (let i = 0; i < 20; i++) {
      const jeu = partieTest({ mode: 'match', sieges: [0] }, 200 + i);
      jeu.humain = null;
      jeu.rng = graine(2000 + i);
      servir(jeu, jeu.serveur, 'plat', (ZONE_ACE.min + ZONE_ACE.max) / 2, 0);
      if (!jeu.balle.ace) continue;
      essais++;
      expect(frappable(jeu, jeu.receveur, 3)).toBe(false);
      const evs = simule(jeu, 3);
      const p = evs.find((e) => e.type === 'point' || e.type === 'faute');
      if (p && p.type === 'point' && p.raison === 'ACE !' && p.gagnant === jeu.serveur.eq) gagne++;
    }
    expect(essais).toBeGreaterThan(10);
    expect(gagne).toBe(essais);
  });
});
