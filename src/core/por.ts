import type { Situation } from './qualite';
import type { Coup } from './types';

/**
 * Le por 3 (sortie par les côtés) et le por 4 (sortie par le fond) ne sont pas à la
 * portée de n'importe quel coup, ni de n'importe quel moment : ce sont des coups
 * d'attaque ultimes, qui demandent d'être bien placé sous une balle haute.
 *
 * - **smash** : le seul coup qui les cherche. Au filet, sous une balle haute, bien
 *   armé et bien joué, face à des adversaires collés au filet ou sur un lob. À plat vers
 *   le centre de la vitre du fond : por 4 ; en diagonale, brossé : por 3. Même alors, une
 *   fois sur trois la balle reste en jeu.
 * - **víbora** : très rarement, très forte et très bien jouée, elle sort par le côté (por 3).
 * - **jamais** : bandeja, volée (balle sous la hauteur de smash), lob, amorti, service,
 *   renvois de vitre : la balle qui en sort est simplement retenue par le grillage.
 *
 * Renvoie 0 (la balle ne sortira pas), 3 ou 4. `hasard` : un tirage entre 0 et 1.
 */
export function typeDePor(
  type: Coup,
  p: number,
  score: number,
  sit: Situation,
  subi: boolean,
  ty: number,
  hasard: number,
): 0 | 3 | 4 {
  if (subi) return 0;
  if (type === 'smash') {
    if (p < 0.75 || sit.z <= 2.2 || sit.loin >= 4.5 || score < 0.6) return 0;
    if (!sit.filetAdverse && sit.prev !== 'lobe') return 0;
    if (hasard >= 0.55) return 0;
    return Math.abs(ty - 5) < 2.2 ? 4 : 3;
  }
  if (type === 'vibora') return p >= 0.9 && score >= 0.7 && sit.loin < 6 && hasard < 0.12 ? 3 : 0;
  return 0;
}
