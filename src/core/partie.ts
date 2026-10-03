import type { Aleatoire } from './aleatoire';
import { nouvelleBalle, physique } from './balle';
import { DUREE_MAX_ECHANGE, DUREE_POINT, JEUX, NIVEAUX, VITESSE } from './constants';
import { bouge, majRegard, separe } from './deplacement';
import { appliqueCommande } from './humain';
import { pilotageIA } from './ia';
import { nouveauJoueur } from './joueurs';
import { prevoir } from './prevision';
import { finPoint, gagne, regle } from './regles';
import { majService, placeService } from './service';
import type { Commande, Mode, Partie } from './types';

export interface OptionsPartie {
  mode: Mode;
  /** indice dans NIVEAUX (le niveau des adversaires) */
  niveau: number;
  /** indice dans JEUX (jeux à gagner) */
  jeux: number;
  rng?: Aleatoire;
}

export const COMMANDE_VIDE: Commande = { dx: 0, dy: 0, appuis: [], sprint: false };

export function nouvellePartie(o: OptionsPartie): Partie {
  const rng = o.rng ?? Math.random;
  const demo = o.mode === 'demo';
  const niv = demo ? NIVEAUX[1]! : NIVEAUX[o.niveau]!;
  // votre partenaire joue au moins au niveau normal ; le niveau choisi règle les adversaires
  const nivP = demo ? niv : NIVEAUX[Math.max(1, o.niveau)]!;
  // vous êtes toujours le joueur en haut à droite : rien ne vous cache sous les commandes
  const a = nouveauJoueur(0, 0, 0, !demo, nivP);
  const b = nouveauJoueur(1, 0, 1, false, nivP);
  const c = nouveauJoueur(2, 1, 0, false, niv);
  const d = nouveauJoueur(3, 1, 1, false, niv);
  const ordre = rng() < 0.5 ? [a, c, b, d] : [c, a, d, b];
  const jeu: Partie = {
    mode: o.mode,
    niv,
    jeuxCible: JEUX[o.jeux] ?? JEUX[1]!,
    joueurs: [a, b, c, d],
    balle: nouvelleBalle(),
    humain: demo ? null : a,
    jeux: [0, 0],
    pts: [0, 0],
    nJeu: 0,
    ordre,
    faute: 0,
    rejoue: false,
    phase: 'service',
    tPhase: 0,
    temps: 0,
    tFrappe: 0,
    gagnant: 0,
    serveur: ordre[0]!,
    receveur: ordre[1]!,
    pret: false,
    jauge: null,
    cpuServ: null,
    posture: ['fond', 'fond'],
    plan: [null, null],
    pred: null,
    tPred: 0,
    stats: { gagnants: [0, 0], portres: [0, 0], fautes: [0, 0], vitres: 0 },
    evenements: [],
    rng,
  };
  placeService(jeu);
  return jeu;
}

/**
 * Avance la simulation d'un pas fixe. lireCommande n'est appelée que s'il y a
 * un joueur humain, une fois par pas.
 */
export function pas(jeu: Partie, dt: number, lireCommande: () => Commande = () => COMMANDE_VIDE): void {
  if (jeu.phase === 'fin') return;
  dt *= VITESSE;
  jeu.temps += dt;
  jeu.tPhase += dt;
  jeu.tFrappe += dt;
  const b = jeu.balle;
  if (jeu.phase === 'jeu') {
    jeu.tPred -= dt;
    if (jeu.tPred <= 0) {
      prevoir(jeu);
      jeu.tPred = 0.1;
    }
  }
  for (const s of jeu.joueurs) {
    if (s.humain) appliqueCommande(jeu, s, lireCommande(), dt);
    else pilotageIA(jeu, s);
    bouge(jeu, s, dt);
    majRegard(jeu, s);
  }
  separe(jeu);
  if (jeu.phase === 'service') {
    majService(jeu, dt);
    return;
  }
  const contact = regle.bind(null, jeu);
  for (let i = 0; i < 2; i++) physique(b, dt / 2, contact);
  b.trace.push([b.x, b.y, b.z]);
  if (b.trace.length > 9) b.trace.shift();
  if (jeu.phase === 'jeu' && jeu.tFrappe > DUREE_MAX_ECHANGE)
    gagne(jeu, b.sol >= 1 ? b.eqF : b.camp, 'POINT');
  if (jeu.phase === 'point' && jeu.tPhase > DUREE_POINT) finPoint(jeu);
}
