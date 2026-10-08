/**
 * La fin spectaculaire d'un super coup, côté affichage (chaque écran la joue pour
 * lui-même, en temps réel) : le choc (zoom sur l'impact, terrain ou vitre qui
 * casse), l'ascension (la balle part dans l'espace), le plan sur la lune, puis
 * le bandeau du point. Voir `finale-vue.ts` pour le dessin.
 */
export const CHOC_S = 0.55;
export const ASCENSION_FIN_S = 1.55;
export const LUNE_FIN_S = 3.45;
export const FINALE_FIN_S = 3.8;
/** Le bandeau du point s'affiche à ce moment. */
export const BANDEAU_S = 3.5;

export class FinaleSuper {
  variante = 0;
  /** secondes depuis le choc */
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
    this.t += dt;
    if (this.t >= FINALE_FIN_S) this.actif = false;
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
