import type { Effet, Niveau } from './types';

/*
 * La simulation travaille en mètres : x le long de la piste (0 → 20, filet à
 * 10), y en profondeur (0 au fond de l'écran → 10 devant), z en hauteur.
 * L'équipe 0 (la vôtre) défend x < 10, l'équipe 1 x > 10.
 */

/** Pas fixe de la simulation (s). */
export const PAS = 1 / 120;
/** Le jeu tourne un peu au ralenti : plus lisible sur téléphone. */
export const VITESSE = 0.8;
export const G = 9.8;
export const LONG = 20;
export const LARG = 10;
export const MIL = 10;
/** Ligne de service, distance au filet. */
export const SERV = 6.95;
/** Vitesse de course (m/s). */
export const VMAX = 4.8;
/** Arcade : un joueur humain court plus vite que le CPU. */
export const BONUS_HUMAIN = 1.1;
/** Portée de la raquette (m). */
export const PORTEE = 1.15;
/** Plus haut, même en sautant, on ne touche pas. */
export const HAUT_MAX = 3.0;
/** Au-dessus : coups d'en haut (smash, víbora, bandeja). */
export const HAUT_SMASH = 1.9;
/** Hauteur des vitres ; au-dessus, grillage (jusqu'à 4 m aux bouts). */
export const HAUT_VITRE = 3;
export const HAUT_GRILLE_FOND = 4;
/** Les vitres de côté ne couvrent que les 4 m près de chaque fond. */
export const VITRE_COTE = 4;
/** Un échange qui traîne au-delà (s) est arrêté. */
export const DUREE_MAX_ECHANGE = 9;
/**
 * La balle accélère au fil de l'échange : +ACCEL_ECHANGE par coup après le
 * deuxième, jusqu'à +ACCEL_MAX, sauf pour le lob et l'amorti (qui restent lents).
 */
export const ACCEL_ECHANGE = 0.06;
export const ACCEL_MAX = 0.9;
/**
 * Parade d'un super coup : le jeu se fige, un curseur balaie une jauge et le camp
 * qui subit doit l'arrêter dans la zone verte (plus étroite et plus rapide qu'au
 * service). C'est le seul moyen d'arrêter un super coup.
 */
export const PERIODE_PARADE = 0.6;
export const ZONE_PARADE = { min: 0.43, max: 0.57 } as const;
/** Au bout de ce délai (s), faute d'avoir arrêté le curseur, la parade est ratée. */
export const PARADE_DUREE_MAX = 1.6;
/** Pendant la parade (environ 2 s réelles) le jeu passe au ralenti : cette fraction de sa vitesse. */
export const PARADE_RALENTI = 0.12;
/**
 * Fin spectaculaire d'un super coup (secondes de simulation) : choc, ascension,
 * plan sur la lune, puis bandeau du point ; le ralenti vient après.
 */
export const FINALE_SUPER_S = 4;
/**
 * Super coup demandé alors que la balle est dans notre camp : le joueur court tout
 * seul vers elle (à ce multiple de sa vitesse) pendant au plus ce délai (s), et la
 * frappe de plus loin que d'ordinaire (multiple de la portée de la raquette).
 */
export const SUPER_COURSE = 2.8;
export const SUPER_DUREE_S = 1.6;
export const SUPER_PORTEE = 2.2;
/** Durée de l'annonce entre deux points (s). */
export const DUREE_POINT = 1.9;

/**
 * Ralenti d'un beau point (durées en secondes de simulation, qui s'écoulent à
 * VITESSE du temps réel). Un échange d'au moins RALENTI_ECHANGE est rejoué
 * après RALENTI_DEBUT : les RALENTI_CLIP dernières secondes, à RALENTI_RYTHME.
 */
export const RALENTI_ECHANGE = 2.5;
export const RALENTI_DEBUT = 1;
export const RALENTI_CLIP = 2.4;
export const RALENTI_RYTHME = 0.6;
/** Durée de l'annonce du point quand il est rejoué : le ralenti, puis un court retour au direct. */
export const DUREE_POINT_RALENTI = RALENTI_DEBUT + RALENTI_CLIP / RALENTI_RYTHME + 0.9;
/** Un point gagné par un super coup : la fin spectaculaire d'abord, puis le ralenti. */
export const DUREE_POINT_SUPER = FINALE_SUPER_S + RALENTI_CLIP / RALENTI_RYTHME + 0.9;

export const NIVEAUX: readonly Niveau[] = [
  { nom: 'FACILE', vit: 0.8, reac: 0.34, err: 0.9, agress: 0.25, serv: 0.13 },
  { nom: 'NORMAL', vit: 0.92, reac: 0.2, err: 0.6, agress: 0.5, serv: 0.08 },
  { nom: 'PRO', vit: 1.02, reac: 0.1, err: 0.4, agress: 0.8, serv: 0.05 },
];

/** Nombre de jeux pour gagner un match, au choix dans le menu. */
export const JEUX: readonly number[] = [2, 3, 4, 6];

export const LIB_PTS = ['0', '15', '30', '40'] as const;

/** [rebond vertical, frein horizontal] au sol selon l'effet. */
export const RESTIT: Record<Effet, readonly [number, number]> = {
  plat: [0.7, 0.84],
  lobe: [0.56, 0.8],
  lift: [0.84, 0.9],
  smash: [0.82, 0.92],
  coupe: [0.5, 0.94],
  vibora: [0.52, 0.8],
};

/** Jauge de service : en dessous, trop faible ; au-dessus, trop fort ; entre, parfait. */
export const JAUGE_PARFAITE = { min: 0.62, max: 0.82 } as const;
/** Période d'un aller (ou d'un retour) de la jauge de service (s). */
export const PERIODE_JAUGE = 0.65;
