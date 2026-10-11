/**
 * La fin spectaculaire d'un super coup, côté affichage (chaque écran la joue pour
 * lui-même) : le choc (zoom sur l'impact, terrain qui casse), puis la scène de la
 * variante (la lune, le volcan, le satellite, la tour de Pise ou le Sphinx), puis
 * le bandeau du point. Voir `finale-vue.ts` pour le dessin. Les temps ci-dessous sont ceux de la scène, qui
 * avance à RYTHME_FINALE du temps réel : elle dure FINALE_FIN_S / RYTHME_FINALE s.
 */
export const RYTHME_FINALE = 0.7;
export const CHOC_S = 0.55;
export const ASCENSION_FIN_S = 1.55;
/** Pise et Sphinx : le voyage au-dessus de la Terre (depuis le choc) finit ici, la destination commence. */
export const VOYAGE_FIN_S = 1.75;
export const LUNE_FIN_S = 3.45;
export const FINALE_FIN_S = 3.8;
/** Le bandeau du point s'affiche à ce moment. */
export const BANDEAU_S = 3.5;

/** Les temps propres à une variante : début du fondu, fin de la scène, et moment où le bandeau du point s'affiche. */
export interface Minutage {
  fondu: number;
  fin: number;
  bandeau: number;
}

/** Le Titanic raconte une histoire (approche, esquive, coup de balle, coque coupée) : sa scène est plus longue. */
export const TITANIC_FIN_S = 5.2;
/** L'erreur 404 : la balle vient fissurer l'écran, il plante (écran bleu), puis s'éteint comme un vieux téléviseur. */
export const ERREUR_FIN_S = 4.3;

const MINUTAGES: Record<number, Minutage> = {
  6: { fondu: TITANIC_FIN_S - 0.35, fin: TITANIC_FIN_S, bandeau: TITANIC_FIN_S - 0.2 },
  7: { fondu: ERREUR_FIN_S, fin: ERREUR_FIN_S, bandeau: ERREUR_FIN_S - 0.2 },
};
const MINUTAGE_STANDARD: Minutage = { fondu: LUNE_FIN_S, fin: FINALE_FIN_S, bandeau: BANDEAU_S };

export const minutage = (variante: number): Minutage => MINUTAGES[variante] ?? MINUTAGE_STANDARD;

export class FinaleSuper {
  variante = 0;
  /** temps de la scène depuis le choc (voir RYTHME_FINALE) */
  t = 0;
  actif = false;
  /** a été déclenchée pour ce point (même si elle est terminée ou passée) */
  declenchee = false;
  /** point d'impact à l'écran (pixels logiques) */
  x = 0;
  y = 0;
  /** inclinaison de la montée : sens et ampleur (-1 à 1) du cap pris par la balle après son rebond, à l'écran */
  cap = 0;
  declenche(variante: number, x: number, y: number, cap = 0): void {
    this.variante = variante;
    this.t = 0;
    this.actif = true;
    this.declenchee = true;
    this.x = x;
    this.y = y;
    this.cap = Math.max(-1, Math.min(1, cap));
  }

  maj(dt: number): void {
    if (!this.actif) return;
    this.t += dt * RYTHME_FINALE;
    if (this.t >= minutage(this.variante).fin) this.actif = false;
  }

  /** Un appui passe la scène. */
  arrete(): void {
    this.actif = false;
  }

  reinitialise(): void {
    this.actif = false;
    this.declenchee = false;
    this.t = 0;
  }

  /** Le zoom de la caméra sur l'impact : un coup de poing, puis il retombe (1 : pas de zoom). */
  get zoom(): number {
    if (!this.actif || this.t > 0.9) return 1;
    if (this.t < 0.1) return 1 + 0.6 * (this.t / 0.1);
    if (this.t < 0.6) return 1.6 - 0.25 * ((this.t - 0.1) / 0.5);
    return 1.35 - 0.35 * ((this.t - 0.6) / 0.3);
  }
}
