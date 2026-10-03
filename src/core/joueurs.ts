import { dir, xProf } from './terrain';
import type { Equipe, Joueur, Niveau, Partie } from './types';

export function nouveauJoueur(id: number, eq: Equipe, poste: 0 | 1, humain: boolean, niv: Niveau): Joueur {
  // le drive joue à droite : en haut de l'écran (y < 5) pour votre équipe, en bas pour l'autre
  const cote = (eq === 0) === (poste === 0) ? 2.5 : 7.5;
  const face = dir(eq);
  return {
    id,
    eq,
    poste,
    cote,
    home: cote,
    humain,
    niv,
    err: humain ? 0.4 : niv.err,
    x: xProf(eq, 2),
    y: cote,
    vx: 0,
    vy: 0,
    ex: 0,
    ey: 0,
    sprint: false,
    cible: { x: xProf(eq, 3), y: cote },
    posServ: { x: xProf(eq, 3), y: cote },
    swing: 0,
    haut: false,
    poseCoup: 'attente',
    intent: null,
    charge: 0,
    cd: 0,
    pas: 0,
    face,
    tourne: 0,
    faceCoup: face,
    regard: -face,
    court: false,
  };
}

export const equipe = (jeu: Partie, eq: Equipe): Joueur[] => jeu.joueurs.filter((s) => s.eq === eq);

export function partenaire(jeu: Partie, s: Joueur): Joueur {
  const p = jeu.joueurs.find((o) => o.eq === s.eq && o !== s);
  if (!p) throw new Error('joueur sans partenaire');
  return p;
}
