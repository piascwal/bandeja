import { describe, expect, it } from 'vitest';
import { MIL } from '@core/constants';
import { fauteService, finPoint, gagne, regle } from '@core/regles';
import type { Equipe, Evenement, Partie } from '@core/types';
import { partieTest } from './outils';

/** Une partie en plein échange, la balle à jouer par l'équipe `camp`. */
function enJeu(o: Parameters<typeof partieTest>[0] = {}, camp: Equipe = 1): Partie {
  const jeu = partieTest(o);
  jeu.phase = 'jeu';
  jeu.balle.camp = camp;
  jeu.balle.eqF = camp === 1 ? 0 : 1;
  jeu.balle.service = false;
  jeu.evenements.length = 0;
  return jeu;
}

/** L'équipe eq gagne un point, annonce comprise. */
function point(jeu: Partie, eq: Equipe): void {
  jeu.phase = 'jeu';
  gagne(jeu, eq, 'POINT');
  finPoint(jeu);
}

const types = (evs: Evenement[]) => evs.map((e) => e.type);

describe('arbitrage', () => {
  it('deux rebonds dans le camp adverse : point pour le frappeur', () => {
    const jeu = enJeu();
    jeu.balle.x = MIL + 3;
    regle(jeu, 'sol', 1, 5);
    expect(jeu.phase).toBe('jeu');
    regle(jeu, 'sol', 1, 2);
    expect(jeu.phase).toBe('point');
    expect(jeu.gagnant).toBe(0);
  });

  it('vitre directe avant tout rebond : point pour le camp qui reçoit', () => {
    const jeu = enJeu();
    regle(jeu, 'vitre', 1, 10);
    expect(jeu.gagnant).toBe(1);
    expect(jeu.evenements.find((e) => e.type === 'point')).toMatchObject({ raison: 'VITRE DIRECTE' });
    expect(jeu.stats.fautes[0]).toBe(1);
  });

  it('après un rebond, la vitre est en jeu', () => {
    const jeu = enJeu();
    regle(jeu, 'sol', 1, 5);
    regle(jeu, 'vitre', 1, 10);
    expect(jeu.phase).toBe('jeu');
    expect(jeu.balle.mur).toBe(true);
  });

  it('sortie après rebond par le côté : por tres', () => {
    const jeu = enJeu();
    jeu.balle.x = MIL + 4;
    regle(jeu, 'sol', 1, 5);
    regle(jeu, 'sortie', 1);
    expect(jeu.evenements.find((e) => e.type === 'point')).toMatchObject({
      raison: 'POR TRES !',
      gagnant: 0,
    });
    expect(jeu.stats.portres[0]).toBe(1);
  });

  it('deux fautes de service : double faute', () => {
    const jeu = enJeu();
    jeu.balle.service = true;
    fauteService(jeu, 'FILET');
    expect(jeu.rejoue).toBe(true);
    expect(types(jeu.evenements)).toContain('faute');
    jeu.phase = 'jeu';
    fauteService(jeu, 'FILET');
    expect(jeu.evenements.find((e) => e.type === 'point')).toMatchObject({ raison: 'DOUBLE FAUTE' });
    expect(jeu.gagnant).not.toBe(jeu.serveur.eq);
  });
});

describe('compte des points', () => {
  it('15, 30, 40, jeu', () => {
    const jeu = enJeu();
    point(jeu, 0);
    point(jeu, 0);
    point(jeu, 0);
    expect(jeu.pts).toEqual([3, 0]);
    point(jeu, 0);
    expect(jeu.pts).toEqual([0, 0]);
    expect(jeu.jeux).toEqual([1, 0]);
    expect(jeu.nJeu).toBe(1);
  });

  it('à 40-40, point en or : qui le prend gagne le jeu', () => {
    const jeu = enJeu();
    for (let i = 0; i < 3; i++) {
      point(jeu, 0);
      point(jeu, 1);
    }
    expect(types(jeu.evenements)).toContain('pointEnOr');
    point(jeu, 1);
    expect(jeu.jeux).toEqual([0, 1]);
  });

  it('le match se termine au nombre de jeux choisi', () => {
    const jeu = enJeu({ mode: 'match', jeux: 0 }); // 2 jeux
    for (let i = 0; i < 8; i++) point(jeu, 1);
    expect(jeu.phase).toBe('fin');
    expect(jeu.evenements.find((e) => e.type === 'finMatch')).toMatchObject({ gagnant: 1 });
  });

  it('le serveur change à chaque jeu, dans l’ordre de service', () => {
    const jeu = enJeu();
    const serveurs = [jeu.serveur];
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) point(jeu, 0);
      serveurs.push(jeu.serveur);
    }
    expect(serveurs.slice(0, 4)).toEqual(jeu.ordre);
    expect(serveurs[4]).toBe(serveurs[0]);
  });
});
