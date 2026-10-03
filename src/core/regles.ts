import { clamp } from './aleatoire';
import { DUREE_POINT, DUREE_POINT_RALENTI, LARG, LONG, MIL, RALENTI_ECHANGE, SERV } from './constants';
import { placeService } from './service';
import { autre } from './terrain';
import type { Equipe, Partie, Surface } from './types';

/** Raisons de point qui sont des fautes du perdant, pas des coups gagnants. */
const FAUTES = new Set(['FILET', 'DEHORS', 'GRILLE !', 'VITRE DIRECTE']);

/** Arbitre un contact de la balle (appelé par la physique pendant le jeu). */
export function regle(jeu: Partie, type: Surface, cote: Equipe, force = 0): void {
  const b = jeu.balle;
  if (type !== 'sortie') {
    jeu.evenements.push({ type: 'impact', surface: type, x: b.x, y: clamp(b.y, 0, LARG), z: b.z, force });
  }
  if (type === 'vitre' && jeu.phase === 'jeu') {
    jeu.stats.vitres++;
    if (cote === b.camp) b.mur = true;
  }
  if (jeu.phase !== 'jeu') return;
  if (type === 'filet') b.filet = true;
  else if (type === 'sol') regleSol(jeu, cote);
  else if (type === 'vitre' || type === 'grille') regleMur(jeu, type, cote);
  else regleSortie(jeu, cote);
}

function regleSol(jeu: Partie, cote: Equipe): void {
  const b = jeu.balle;
  if (cote !== b.camp) {
    // rebond du côté de celui qui a frappé : dans le filet... ou revenue après rebond
    if (b.sol >= 1) gagne(jeu, b.eqF, 'ELLE REVIENT !');
    else if (b.service) fauteService(jeu, 'FILET');
    else gagne(jeu, b.camp, 'FILET');
    return;
  }
  b.sol++;
  if (b.service && b.sol === 1) {
    if (!dansCarre(jeu)) {
      fauteService(jeu, 'FAUTE');
      return;
    }
    if (b.filet) {
      let_(jeu);
      return;
    }
  }
  if (b.sol >= 2) gagne(jeu, b.eqF, 'POINT');
}

function regleMur(jeu: Partie, type: 'vitre' | 'grille', cote: Equipe): void {
  const b = jeu.balle;
  if (cote !== b.camp) return;
  if (b.sol === 0) {
    if (b.service) fauteService(jeu, type === 'grille' ? 'GRILLE' : 'VITRE');
    else gagne(jeu, b.camp, type === 'grille' ? 'GRILLE !' : 'VITRE DIRECTE');
    return;
  }
  if (b.service && type === 'grille') fauteService(jeu, 'GRILLE');
}

function regleSortie(jeu: Partie, cote: Equipe): void {
  const b = jeu.balle;
  if (cote === b.camp && b.sol >= 1) {
    jeu.stats.portres[b.eqF]++;
    gagne(jeu, b.eqF, b.x < 0 || b.x > LONG ? 'POR CUATRO !' : 'POR TRES !');
  } else if (cote !== b.camp && b.sol >= 1) {
    // rebondie chez l'adversaire, puis revenue (vitre) de son côté d'où elle sort : comme un rebond chez soi
    gagne(jeu, b.eqF, 'ELLE REVIENT !');
  } else if (b.service) fauteService(jeu, 'DEHORS');
  else gagne(jeu, b.camp, 'DEHORS');
}

/** Le service est-il tombé dans le carré en diagonale du serveur ? */
export function dansCarre(jeu: Partie): boolean {
  const b = jeu.balle;
  if (Math.abs(b.x - MIL) > SERV) return false;
  return jeu.serveur.y > 5 ? b.y < 5 : b.y > 5;
}

export function gagne(jeu: Partie, eq: Equipe, raison: string): void {
  if (jeu.phase !== 'jeu') return;
  // un échange assez long sera rejoué au ralenti : l'annonce du point dure plus
  jeu.dureePoint = jeu.mode === 'match' && jeu.tPhase >= RALENTI_ECHANGE ? DUREE_POINT_RALENTI : DUREE_POINT;
  jeu.phase = 'point';
  jeu.tPhase = 0;
  jeu.gagnant = eq;
  jeu.rejoue = false;
  jeu.faute = 0;
  if (FAUTES.has(raison)) jeu.stats.fautes[autre(eq)]++;
  else jeu.stats.gagnants[eq]++;
  jeu.evenements.push({ type: 'point', gagnant: eq, raison });
}

export function fauteService(jeu: Partie, raison: string): void {
  if (jeu.phase !== 'jeu') return;
  if (jeu.faute === 0) {
    jeu.faute = 1;
    jeu.phase = 'point';
    jeu.tPhase = 0.6;
    jeu.dureePoint = DUREE_POINT;
    jeu.rejoue = true;
    jeu.evenements.push({ type: 'faute', raison });
  } else {
    jeu.faute = 0;
    gagne(jeu, autre(jeu.serveur.eq), 'DOUBLE FAUTE');
  }
}

function let_(jeu: Partie): void {
  jeu.phase = 'point';
  jeu.tPhase = 0.6;
  jeu.dureePoint = DUREE_POINT;
  jeu.rejoue = true;
  jeu.evenements.push({ type: 'let' });
}

/** Après l'annonce : compte le point, le jeu, le match, puis replace pour servir. */
export function finPoint(jeu: Partie): void {
  if (jeu.rejoue) {
    jeu.rejoue = false;
    placeService(jeu);
    return;
  }
  const e = jeu.gagnant;
  const p = jeu.pts;
  // point en or à 40-40 : pas d'avantage, qui le prend gagne le jeu
  const jeuFini = (p[0] === 3 && p[1] === 3) || p[e] === 3;
  if (!jeuFini) p[e]++;
  else {
    jeu.jeux[e]++;
    jeu.pts = [0, 0];
    jeu.nJeu++;
    if (jeu.mode === 'match' && jeu.jeux[e] >= jeu.jeuxCible) {
      jeu.phase = 'fin';
      jeu.evenements.push({ type: 'finMatch', gagnant: e });
      return;
    }
    // la démo du menu tourne en boucle
    if (jeu.mode !== 'match' && jeu.jeux[e] >= 4) jeu.jeux = [0, 0];
    jeu.evenements.push({ type: 'jeu', gagnant: e, jeux: [jeu.jeux[0], jeu.jeux[1]] });
  }
  if (!jeuFini && jeu.pts[0] === 3 && jeu.pts[1] === 3) jeu.evenements.push({ type: 'pointEnOr' });
  placeService(jeu);
}
