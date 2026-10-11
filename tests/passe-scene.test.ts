import { describe, expect, it } from 'vitest';
import { DUREE_POINT, DUREE_POINT_RALENTI, PAS, SCENE_MARGE_S } from '@core/constants';
import { pas } from '@core/partie';
import { dureeMaxPoint, sceneAttendue, termineScene } from '@core/regles';
import { Passes } from '../src/net/passes';
import { PasseScene, type ContexteScene } from '../src/app/passe-scene';
import { partieTest } from './outils';

/** Un point avec scène (ralenti), à t secondes de son début. */
function pointAvecScene(t: number) {
  const jeu = partieTest({ mode: 'match', jeux: 3, sieges: [] }, 3);
  jeu.phase = 'point';
  jeu.dureePoint = DUREE_POINT_RALENTI;
  jeu.tPhase = t;
  return jeu;
}

/** Une application factice : seul ce que PasseScene lit ou appelle. */
function contexte(
  jeu: ReturnType<typeof pointAvecScene>,
  o: { fini?: boolean; invites?: number[]; invite?: boolean },
) {
  const appels = { passe: 0, finale: 0, ralenti: 0 };
  const passes = new Passes();
  const hote = o.invite
    ? null
    : {
        passes,
        etat: { sieges: [{}, ...(o.invites ?? []).map(() => ({}))].concat([null, null, null]).slice(0, 4) },
      };
  const a = {
    jeu,
    ralenti: { termine: o.fini ?? false, arrete: () => appels.ralenti++ },
    effets: { finale: { actif: false, arrete: () => appels.finale++ } },
    lan: {
      actif: o.invite || !!o.invites,
      hote,
      client: o.invite ? { passe: () => appels.passe++ } : null,
    },
  } as unknown as ContexteScene;
  return { a, appels, passes };
}

describe('la fin du point avec une scène', () => {
  it('une scène allonge le point de la marge de sécurité, pas un point ordinaire', () => {
    const jeu = pointAvecScene(1);
    expect(sceneAttendue(jeu)).toBe(true);
    expect(dureeMaxPoint(jeu)).toBe(DUREE_POINT_RALENTI + SCENE_MARGE_S);
    jeu.dureePoint = DUREE_POINT;
    expect(sceneAttendue(jeu)).toBe(false);
    expect(dureeMaxPoint(jeu)).toBe(DUREE_POINT);
  });

  it('sans personne pour la passer, le point finit à la marge, pas avant', () => {
    const jeu = pointAvecScene(DUREE_POINT_RALENTI + 0.5);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('point');
    jeu.tPhase = DUREE_POINT_RALENTI + SCENE_MARGE_S + 0.1;
    pas(jeu, PAS);
    expect(jeu.phase).toBe('service');
  });

  it('termineScene fait finir le point au pas suivant, mais jamais avant la fin de l’annonce', () => {
    const jeu = pointAvecScene(DUREE_POINT - 0.5);
    termineScene(jeu);
    expect(jeu.tPhase).toBe(DUREE_POINT - 0.5);
    jeu.tPhase = 3;
    termineScene(jeu);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('service');
  });
});

describe('passer une scène : tous les joueurs doivent avoir touché', () => {
  it('seul, un appui passe tout de suite', () => {
    const jeu = pointAvecScene(3);
    const { a, appels } = contexte(jeu, {});
    const p = new PasseScene();
    p.maj(a);
    expect(jeu.tPhase).toBe(3);
    p.demande();
    p.maj(a);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('service');
    expect(appels.finale + appels.ralenti).toBe(2);
  });

  it('un invité qui touche prévient l’hôte une seule fois, et ne finit pas le point', () => {
    const jeu = pointAvecScene(3);
    const { a, appels } = contexte(jeu, { invite: true });
    const p = new PasseScene();
    p.demande();
    p.maj(a);
    p.maj(a);
    expect(appels.passe).toBe(1);
    expect(appels.ralenti).toBe(0);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('point');
  });

  it('l’hôte qui touche attend que ses invités aient touché ou fini leur scène', () => {
    const jeu = pointAvecScene(3);
    const { a, passes } = contexte(jeu, { invites: [1, 2] });
    const p = new PasseScene();
    p.demande();
    p.maj(a);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('point');
    passes.ajoute(1);
    p.maj(a);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('point');
    passes.ajoute(2);
    p.maj(a);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('service');
  });

  it('une scène vue en entier compte comme un appui : le point reprend sans attendre la fin du délai', () => {
    const jeu = pointAvecScene(3);
    const { a, passes } = contexte(jeu, { invites: [1], fini: true });
    const p = new PasseScene();
    p.maj(a);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('point');
    passes.ajoute(1);
    p.maj(a);
    pas(jeu, PAS);
    expect(jeu.phase).toBe('service');
  });

  it('un spectateur (sans siège) ne compte pas', () => {
    const passes = new Passes();
    passes.ajoute(-1);
    expect(passes.tousInvites([0, 1])).toBe(false);
    passes.ajoute(1);
    expect(passes.tousInvites([0, 1])).toBe(true);
    passes.raz();
    expect(passes.tousInvites([0, 1])).toBe(false);
  });
});
