import type { Aleatoire } from './aleatoire';

export type Equipe = 0 | 1;
/** Effet donné à la balle : règle son rebond au sol et contre les vitres. */
export type Effet = 'plat' | 'lobe' | 'lift' | 'smash' | 'coupe' | 'vibora';
/** Les coups, tels qu'annoncés à l'écran. */
export type Coup = 'plat' | 'lobe' | 'coupe' | 'amorti' | 'smash' | 'vibora' | 'bandeja' | 'vitre' | 'cote';
/** Les quatre boutons du losange : le SMASH choisit seul entre smash, víbora et bandeja. */
export type Bouton = 'plat' | 'amorti' | 'lobe' | 'smash';
/** Vitre visée pour un rebond voulu : celle du fond, ou celle de côté (haut / bas de l'écran). */
export type Mur = 'fond' | 'haut' | 'bas';
export type TypeService = 'plat' | 'coupe';
export type Surface = 'sol' | 'vitre' | 'grille' | 'filet' | 'sortie';
export type Phase = 'service' | 'jeu' | 'point' | 'fin';
export type Posture = 'fond' | 'filet';
export type PoseCoup = 'attente' | 'smash2';

export interface Niveau {
  nom: string;
  /** multiplicateur de vitesse de course */
  vit: number;
  /** temps de réaction (s) */
  reac: number;
  /** imprécision des coups */
  err: number;
  /** goût du risque (smash, frappes appuyées) */
  agress: number;
  /** imprécision de la jauge de service */
  serv: number;
}

export interface Point2 {
  x: number;
  y: number;
}

export interface Joueur {
  id: number;
  eq: Equipe;
  /** 0 : drive, 1 : revers */
  poste: 0 | 1;
  /** côté habituel en profondeur (2.5 ou 7.5) */
  cote: number;
  /** côté tenu sur le point en cours */
  home: number;
  humain: boolean;
  /**
   * Vue en miroir (x = 0 à droite de l'écran, cas de l'équipe 0) : le sens
   * gauche/droite de sa commande en dépend. Faux pour un humain de l'équipe 1,
   * dont l'écran est retourné pour qu'il joue lui aussi à droite.
   */
  miroir: boolean;
  niv: Niveau;
  err: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** direction voulue (repère de la piste), pour le joueur humain */
  ex: number;
  ey: number;
  /** dernière direction du joystick tenue (repère de la piste) : retenue un instant après son relâchement */
  visee: Point2;
  /** distance à la balle au pas précédent (m), pour frapper au meilleur moment */
  dBalle: number;
  /** temps restant pendant lequel `visee` compte encore (s) */
  tVisee: number;
  cible: Point2;
  posServ: Point2;
  /** 1 au moment du coup, redescend à 0 */
  swing: number;
  haut: boolean;
  poseCoup: PoseCoup;
  /** coup demandé à l'avance par le joueur humain */
  intent: { type: Bouton; t: number } | null;
  /** puissance accumulée par l'appui anticipé (0 → 1) */
  charge: number;
  /** temps de récupération après un coup */
  cd: number;
  /** super coup demandé : secondes pendant lesquelles le joueur court tout seul vers la balle pour le lancer (0 : aucun) */
  auto: number;
  /** distance parcourue, pour l'animation des pas */
  pas: number;
  /** sens de l'attaque à l'écran */
  face: 1 | -1;
  /** temps restant tourné vers sa vitre après un rebond voulu */
  tourne: number;
  faceCoup: 1 | -1;
}

/** Ce que la physique a besoin de connaître de la balle. */
export interface CorpsBalle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: Effet;
  /** sens latéral de l'effet (víbora) */
  spinDir: number;
  roule: boolean;
  dehors: boolean;
  /** smash « por » : le prochain rebond l'envoie hors de la piste */
  portres: boolean;
  /** seule une balle qui a le droit de sortir passe par-dessus les murs : 0 aucune, 3 par les côtés (por 3), 4 par le fond (por 4) */
  por: number;
  /** rebond vif : le prochain rebond au sol relance la balle (0 : aucun, 1 : vers la vitre en hauteur, au-delà : hors de la piste) */
  vif: number;
  /** super coup en vol (0 aucun, 1 météore, 2 comète, 3 phénix, 4 fantôme) : imparable, il gagne le point à son premier rebond */
  super: number;
}

export interface Balle extends CorpsBalle {
  /** équipe qui a frappé */
  eqF: Equipe;
  /** camp où la balle doit être jouée */
  camp: Equipe;
  /** rebonds au sol depuis la frappe */
  sol: number;
  service: boolean;
  /** a touché le filet */
  filet: boolean;
  coup: Coup | null;
  /** a rebondi contre une vitre du camp qui doit jouer */
  mur: boolean;
  /** dernières positions (m), pour la traînée */
  trace: [number, number, number][];
}

export interface PointPredit {
  t: number;
  x: number;
  y: number;
  z: number;
  sol: number;
  ok: boolean;
  /** la balle a déjà touché une vitre ou un grillage : le point de frappe suit un rebond */
  vitre: boolean;
}

export interface Prediction {
  pts: PointPredit[];
  faute: boolean;
  rebond: Point2 | null;
  eq: Equipe;
}

export interface Plan extends PointPredit {
  s: Joueur;
  score: number;
  sc: number;
}

/** Ce que le joueur humain demande à chaque pas (entrées déjà traduites). */
export interface Commande {
  /** direction à l'écran du joueur, chaque composante entre -1 et 1 */
  dx: number;
  dy: number;
  appuis: Bouton[];
}

/**
 * Effets de bord émis par la simulation (son, particules, annonces...) :
 * la simulation ne les joue jamais elle-même.
 */
export type Evenement =
  | { type: 'impact'; surface: Exclude<Surface, 'sortie'>; x: number; y: number; z: number; force: number }
  | {
      type: 'frappe';
      coup: Coup;
      puissance: number;
      portres: boolean;
      humain: boolean;
      x: number;
      y: number;
      /** qualité du coup (1 très médiocre → 5 parfait) */
      q: number;
      /** variante du super coup (0 : coup ordinaire) */
      sv: number;
    }
  | { type: 'service'; service: TypeService; jauge: number; humain: boolean; x: number; y: number }
  | { type: 'jaugeLancee' }
  | { type: 'parade'; ok: boolean }
  | { type: 'point'; gagnant: Equipe; raison: string }
  | { type: 'faute'; raison: string }
  | { type: 'let' }
  | { type: 'jeu'; gagnant: Equipe; jeux: [number, number] }
  | { type: 'pointEnOr' }
  | { type: 'finMatch'; gagnant: Equipe };

export type Mode = 'match' | 'demo';

/** Le curseur de parade : à qui il s'adresse, où il en est, et quand le CPU l'arrête (null si un humain le fait). */
export interface Parade {
  eq: Equipe;
  /** phase du curseur (s) */
  t: number;
  ecoule: number;
  tCpu: number | null;
}

export interface Partie {
  mode: Mode;
  niv: Niveau;
  /** jeux à gagner pour remporter le match */
  jeuxCible: number;
  joueurs: Joueur[];
  balle: Balle;
  /** tous les joueurs pilotés par un humain (un siège chacun : leur `id`) */
  humains: Joueur[];
  /** le joueur de CET écran : celui dont on affiche les aides (null : démo) */
  humain: Joueur | null;
  jeux: [number, number];
  pts: [number, number];
  nJeu: number;
  /** ordre de service, un joueur par jeu */
  ordre: Joueur[];
  /** 1 après une première faute de service */
  faute: number;
  /** le point se rejoue (faute de service, let) */
  rejoue: boolean;
  phase: Phase;
  /** option : un joueur humain est conduit vers la balle quand son joystick est au repos */
  aide: boolean;
  /** équipe qui a l'avantage sur son prochain coup (elle vient de lober l'adversaire) */
  avantage: Equipe | null;
  /** jauge de smash de chaque équipe (0 → 1) : pleine, le prochain smash en hauteur est garanti par 3 / par 4 */
  jaugeSmash: [number, number];
  /** parade d'un super coup en cours : le jeu est figé, le camp qui subit doit arrêter le curseur */
  parade: Parade | null;
  /** coups joués depuis le service : la balle accélère au fil de l'échange */
  echange: number;
  tPhase: number;
  /** durée de l'annonce d'un point avant de passer au suivant (plus longue s'il est rejoué au ralenti) */
  dureePoint: number;
  temps: number;
  tFrappe: number;
  gagnant: Equipe;
  serveur: Joueur;
  receveur: Joueur;
  /** les joueurs sont en place pour servir */
  pret: boolean;
  jauge: { type: TypeService; t: number } | null;
  cpuServ: { t: number; vise: number } | null;
  posture: [Posture, Posture];
  plan: [Plan | null, Plan | null];
  pred: Prediction | null;
  tPred: number;
  stats: { gagnants: [number, number]; portres: [number, number]; fautes: [number, number]; vitres: number };
  /** évènements du pas en cours, vidés par l'application à chaque image */
  evenements: Evenement[];
  rng: Aleatoire;
}
