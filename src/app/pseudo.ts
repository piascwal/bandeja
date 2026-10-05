import { nettoiePseudo } from '@piascwal/lan-kit';
import { sauvePreferences, type Preferences } from './preferences';
import { ouvreSaisie } from './saisie';

/** Demande un nouveau pseudo au joueur ; il est gardé d'une partie à l'autre et montré aux autres joueurs. */
export function saisitPseudo(pref: Preferences): void {
  ouvreSaisie({
    titre: 'TON PSEUDO',
    valeur: pref.nom,
    max: 14,
    filtre: (t) => nettoiePseudo(t, '').replace(/^$/, ''),
    valide: (t) => (nettoiePseudo(t, '') ? nettoiePseudo(t, '') : null),
    erreur: 'LETTRES ET CHIFFRES SEULEMENT',
    surValide: (nom) => {
      pref.nom = nom;
      sauvePreferences(pref);
    },
  });
}
