import type { Liaison, Limiteur, Veille } from '@piascwal/lan-kit';
import type { EntreeDistante } from './entrees';

/** Un appareil branché sur l'hôte. */
export interface Membre {
  l: Liaison;
  veille: Veille | null;
  /** connu une fois son « bonjour » reçu */
  appareil: string | null;
  /** secret de son arrivée : seul il rend son siège à un joueur qui revient */
  jeton: string;
  /** code de vérification de sa liaison (le même s'affiche chez lui) */
  code: string | null;
  entree: EntreeDistante;
  limiteCtrl: Limiteur;
  limiteJeu: Limiteur;
}
