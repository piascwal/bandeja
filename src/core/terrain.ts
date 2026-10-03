import { LONG } from './constants';
import type { Equipe } from './types';

/** Sens de l'attaque de l'équipe, vers le filet. */
export const dir = (eq: Equipe): 1 | -1 => (eq === 0 ? 1 : -1);

/** x de la vitre du fond de l'équipe. */
export const fond = (eq: Equipe): number => (eq === 0 ? 0 : LONG);

/** x à m mètres de la vitre du fond de l'équipe. */
export const xProf = (eq: Equipe, m: number): number => (eq === 0 ? m : LONG - m);

/** Hauteur du filet à la profondeur y : un peu plus haut aux poteaux qu'au centre. */
export const filetH = (y: number): number => 0.88 + (0.04 * Math.abs(y - 5)) / 5;

export const autre = (eq: Equipe): Equipe => (eq === 0 ? 1 : 0);
