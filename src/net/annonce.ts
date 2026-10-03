import type { ValideContenu } from '@piascwal/lan-kit';
import { estFormat, type Format } from './formats';
import { SPECTATEURS_MAX } from './protocole';

/** Ce que l'hôte annonce sur le réseau : de quoi remplir la liste des parties (aucune donnée sensible). */
export interface AnnonceBandeja {
  /** nom de l'hôte */
  nom: string;
  format: Format;
  /** joueurs assis, hôte compris */
  joueurs: number;
  /** spectateurs connectés */
  spect: number;
  /** le match est lancé : on ne peut plus que regarder */
  enCours: boolean;
  /** score du match en cours, ou du dernier */
  score: [number, number];
}

const NOM = /^[A-Z0-9 ]{1,14}$/;
const entier = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Valide le contenu d'une annonce reçue (l'annuaire de lan-kit a déjà validé id, version et date). */
export const valideAnnonceBandeja: ValideContenu<AnnonceBandeja> = (o) => {
  if (typeof o.nom !== 'string' || !NOM.test(o.nom) || !estFormat(o.format)) return null;
  if (!entier(o.joueurs, 0, 4) || !entier(o.spect, 0, SPECTATEURS_MAX) || typeof o.enCours !== 'boolean')
    return null;
  const sc = o.score;
  if (!Array.isArray(sc) || sc.length !== 2 || !entier(sc[0], 0, 99) || !entier(sc[1], 0, 99)) return null;
  return {
    nom: o.nom,
    format: o.format,
    joueurs: o.joueurs,
    spect: o.spect,
    enCours: o.enCours,
    score: [sc[0], sc[1]],
  };
};
