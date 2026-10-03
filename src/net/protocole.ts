import type { AppLan } from '@piascwal/lan-kit';
import type { Bouton, Coup, Effet, Phase, PoseCoup, TypeService } from '@core/types';

/**
 * Version du protocole : à incrémenter à CHAQUE modification incompatible des
 * messages (instantané, évènements, entrées). Elle sert de nom de salon : un
 * appareil qui n'a pas la même version ne voit simplement pas la partie. Un
 * octet de version en tête de l'instantané protège en plus d'un décodage de
 * travers.
 */
export const VERSION_PROTOCOLE = 1;

/** Identité de Bandeja sur le réseau local (voir lan-kit). */
export const APP: AppLan = { id: 'bandeja', version: VERSION_PROTOCOLE };

/** Quatre sièges (un par joueur de la piste) et huit spectateurs au plus. */
export const SIEGES_MAX = 4;
export const SPECTATEURS_MAX = 8;

/** L'hôte garde le siège d'un joueur déconnecté pendant ce délai (s). */
export const RECONNEXION_S = 60;

// Les listes ci-dessous donnent l'indice transmis pour chaque valeur : on n'en
// retire ni n'en réordonne jamais sans changer VERSION_PROTOCOLE.
export const PHASES: readonly Phase[] = ['service', 'jeu', 'point', 'fin'];
export const EFFETS: readonly Effet[] = ['plat', 'lobe', 'lift', 'smash', 'coupe', 'vibora'];
export const COUPS: readonly Coup[] = [
  'plat',
  'lobe',
  'coupe',
  'amorti',
  'smash',
  'vibora',
  'bandeja',
  'vitre',
  'cote',
];
export const BOUTONS: readonly Bouton[] = ['plat', 'coupe', 'lobe', 'amorti', 'aerien'];
export const POSES_COUP: readonly PoseCoup[] = ['attente', 'smash2'];
export const SERVICES: readonly TypeService[] = ['plat', 'coupe'];

/** Indice d'une valeur dans une de ces listes (jamais -1 pour une valeur du jeu). */
export const indice = <T>(liste: readonly T[], v: T): number => liste.indexOf(v);
