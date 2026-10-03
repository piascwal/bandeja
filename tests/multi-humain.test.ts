import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { pas } from '@core/partie';
import { finPoint, gagne } from '@core/regles';
import type { Commande, Joueur } from '@core/types';
import { frappeurImmobile, partieTest, simule } from './outils';

const VIDE: Commande = { dx: 0, dy: 0, appuis: [], sprint: false };

describe('plusieurs humains sur la piste', () => {
  it('chaque siège humain pilote son propre joueur', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0, 1, 2, 3] });
    expect(jeu.humains.map((h) => h.id)).toEqual([0, 1, 2, 3]);
    expect(jeu.joueurs.every((j) => j.humain)).toBe(true);
    // la jauge du serveur est lancée par SON siège, pas par un autre
    const serveur = jeu.serveur;
    const appelles: number[] = [];
    for (let i = 0; i < 400; i++) {
      pas(jeu, PAS, (s) => {
        if (!appelles.includes(s.id)) appelles.push(s.id);
        return VIDE;
      });
    }
    expect(appelles.sort()).toEqual([0, 1, 2, 3]);
    expect(serveur.humain).toBe(true);
  });

  it('un seul appel de commande par humain et par pas, aucun pour le CPU', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0, 1] });
    const vus: number[] = [];
    pas(jeu, PAS, (s) => {
      vus.push(s.id);
      return VIDE;
    });
    expect(vus.sort()).toEqual([0, 1]);
  });

  it("la direction d'un humain de l'équipe 1 n'est pas en miroir", () => {
    const jeu = partieTest({ mode: 'match', sieges: [0, 2] });
    const a = jeu.joueurs[0]!;
    const c = jeu.joueurs[2]!;
    expect([a.miroir, c.miroir]).toEqual([true, false]);
    const droite: Commande = { ...VIDE, dx: 1 };
    pas(jeu, PAS, () => droite);
    // les deux poussent vers la droite de LEUR écran : l'un recule, l'autre avance dans x
    expect(Math.sign(a.ex)).toBe(-1);
    expect(Math.sign(c.ex)).toBe(1);
  });

  it("le siège local est celui de l'écran, les autres sont des humains distants", () => {
    const jeu = partieTest({ mode: 'match', sieges: [0, 3], local: 3 });
    expect(jeu.humain?.id).toBe(3);
    expect(jeu.humains).toHaveLength(2);
    expect(partieTest({ mode: 'demo' }).humain).toBeNull();
  });

  it('une équipe avec deux humains joue un match entier (coop contre CPU)', () => {
    const jeu = partieTest({ mode: 'match', niveau: 1, jeux: 0, sieges: [0, 1] }, 5);
    const evs = simule(jeu, 1500, (i) => frappeurImmobile(i));
    // les deux humains tapent la même commande : on vérifie surtout que rien ne casse
    expect(evs.filter((e) => e.type === 'service').length).toBeGreaterThan(5);
    expect(jeu.phase).toBe('fin');
  });

  it('un humain qui sert garde son côté de la piste, jeu après jeu', () => {
    const jeu = partieTest({ mode: 'match', sieges: [0, 1], jeux: 3 }, 9);
    const humainsVus = new Set<number>();
    for (let n = 0; n < 8; n++) {
      const s: Joueur = jeu.serveur;
      if (s.humain) {
        humainsVus.add(s.id);
        expect(s.posServ.y > 5).toBe(s.cote > 5);
      }
      // on passe au jeu suivant : un point gagné par un camp à 40-0
      jeu.pts = [3, 0];
      jeu.phase = 'jeu';
      gagne(jeu, 0, 'POINT');
      finPoint(jeu);
    }
    // sur 8 jeux, les deux humains de l'équipe ont servi
    expect([...humainsVus].sort()).toEqual([0, 1]);
  });
});
