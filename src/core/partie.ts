import type { Aleatoire } from './aleatoire';
import { nouvelleBalle, physique } from './balle';
import { DUREE_MAX_ECHANGE, DUREE_POINT, JEUX, NIVEAUX, VITESSE } from './constants';
import { bouge, separe } from './deplacement';
import { appliqueCommande } from './humain';
import { pilotageIA } from './ia';
import { nouveauJoueur } from './joueurs';
import { prevoir } from './prevision';
import { finPoint, gagne, regle } from './regles';
import { majService, placeService } from './service';
import type { Commande, Joueur, Mode, Partie } from './types';

/** Un siège = un joueur de la piste (son `id`) : 0 et 1 pour l'équipe 0, 2 et 3 pour l'équipe 1. */
export const SIEGES = [0, 1, 2, 3] as const;

export interface OptionsPartie {
  mode: Mode;
  /**
   * Sièges tenus par un humain ; les autres sont au CPU. Par défaut : le
   * siège 0 en match, aucun en démo (le menu).
   */
  sieges?: number[];
  /** le siège de cet écran (par défaut le premier siège humain) */
  local?: number;
  /** indice dans NIVEAUX (le niveau des adversaires) */
  niveau: number;
  /** indice dans JEUX (jeux à gagner) */
  jeux: number;
  rng?: Aleatoire;
  /** aide au déplacement des humains (désactivée par défaut) */
  aide?: boolean;
}

export const COMMANDE_VIDE: Commande = { dx: 0, dy: 0, appuis: [] };

export function nouvellePartie(o: OptionsPartie): Partie {
  const rng = o.rng ?? Math.random;
  const demo = o.mode === 'demo';
  const sieges = (o.sieges ?? (demo ? [] : [0])).filter((i) => SIEGES.includes(i as 0));
  const niv = demo ? NIVEAUX[1]! : NIVEAUX[o.niveau]!;
  // votre partenaire joue au moins au niveau normal ; le niveau choisi règle les adversaires
  const nivP = demo ? niv : NIVEAUX[Math.max(1, o.niveau)]!;
  // un humain de l'équipe 1 voit la piste retournée : il joue lui aussi à droite
  const joueur = (id: number, eq: 0 | 1, poste: 0 | 1) =>
    nouveauJoueur(id, eq, poste, sieges.includes(id), eq === 0 ? nivP : niv);
  const a = joueur(0, 0, 0);
  const b = joueur(1, 0, 1);
  const c = joueur(2, 1, 0);
  const d = joueur(3, 1, 1);
  const ordre = rng() < 0.5 ? [a, c, b, d] : [c, a, d, b];
  const jeu: Partie = {
    mode: o.mode,
    niv,
    jeuxCible: JEUX[o.jeux] ?? JEUX[1]!,
    joueurs: [a, b, c, d],
    balle: nouvelleBalle(),
    humains: [a, b, c, d].filter((j) => j.humain),
    humain: null,
    jeux: [0, 0],
    pts: [0, 0],
    nJeu: 0,
    ordre,
    faute: 0,
    rejoue: false,
    phase: 'service',
    aide: o.aide ?? false,
    echange: 0,
    jaugeSmash: [0, 0],
    avantage: null,
    tPhase: 0,
    dureePoint: DUREE_POINT,
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
  const local = o.local ?? sieges[0];
  jeu.humain = jeu.humains.find((j) => j.id === local) ?? null;
  placeService(jeu);
  return jeu;
}

/**
 * Avance la simulation d'un pas fixe. lireCommande est appelée une fois par
 * pas pour chaque joueur humain : c'est à l'appelant de dire qui commande quoi
 * (les touches de cet écran, ou ce qu'un invité a envoyé par le réseau).
 */
export function pas(
  jeu: Partie,
  dt: number,
  lireCommande: (s: Joueur) => Commande = () => COMMANDE_VIDE,
): void {
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
    if (s.humain) appliqueCommande(jeu, s, lireCommande(s), dt);
    else pilotageIA(jeu, s);
    bouge(jeu, s, dt);
  }
  separe(jeu);
  if (jeu.phase === 'service') {
    majService(jeu, dt);
    return;
  }
  const contact = regle.bind(null, jeu);
  for (let i = 0; i < 2; i++) physique(b, dt / 2, contact);
  b.trace.push([b.x, b.y, b.z]);
  if (b.trace.length > 16) b.trace.shift();
  if (jeu.phase === 'jeu' && jeu.tFrappe > DUREE_MAX_ECHANGE)
    gagne(jeu, b.sol >= 1 ? b.eqF : b.camp, 'POINT');
  if (jeu.phase === 'point' && jeu.tPhase > jeu.dureePoint) finPoint(jeu);
}
