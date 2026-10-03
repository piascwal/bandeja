import type { Projection } from './projection';

/** Ce dont toutes les fonctions de dessin ont besoin : le contexte, l'écran logique et la projection. */
export interface Vue {
  g: CanvasRenderingContext2D;
  /** taille logique de l'écran (gros pixels du décor) */
  W: number;
  H: number;
  K: Projection;
}
