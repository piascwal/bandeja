import { graine } from '@core/aleatoire';
import { PAS } from '@core/constants';
import { nouvellePartie, pas, type OptionsPartie } from '@core/partie';
import type { Commande, Evenement, Partie } from '@core/types';

/** Une partie reproductible (graine fixe). */
export function partieTest(o: Partial<OptionsPartie> = {}, seed = 1): Partie {
  return nouvellePartie({ mode: 'demo', niveau: 1, jeux: 1, rng: graine(seed), ...o });
}

/** Fait tourner la partie et renvoie tous les évènements émis. */
export function simule(jeu: Partie, secondes: number, commande?: (i: number) => Commande): Evenement[] {
  const evs: Evenement[] = [];
  for (let i = 0; i < secondes / PAS; i++) {
    pas(jeu, PAS, commande ? () => commande(i) : undefined);
    evs.push(...jeu.evenements);
    jeu.evenements.length = 0;
  }
  return evs;
}

/** Un joueur humain planté au milieu, qui appuie sur FRAPPE toutes les 0,3 s. */
export const frappeurImmobile = (i: number): Commande => ({
  dx: 0,
  dy: 0,
  appuis: i % 36 === 0 ? ['plat'] : [],
});
