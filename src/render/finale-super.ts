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

/** Un cratère de la lune, laissé par une balle de padel : position dans le plan (0 → 1) et rayon (pixels logiques). */
export interface CratereLune {
  x: number;
  y: number;
  r: number;
}

const CRATERES_MAX = 40;
const CLE_LUNE = 'bandeja-lune';

/** Relit les cratères sauvegardés, en ignorant tout ce qui est abîmé. */
export function lisCrateres(brut: string | null): CratereLune[] {
  try {
    const o: unknown = brut ? JSON.parse(brut) : [];
    if (!Array.isArray(o)) return [];
    return o
      .filter(
        (c): c is CratereLune =>
          !!c &&
          typeof c === 'object' &&
          [c.x, c.y].every((n: unknown) => typeof n === 'number' && n >= 0 && n <= 1) &&
          typeof c.r === 'number' &&
          c.r >= 4 &&
          c.r <= 30,
      )
      .slice(-CRATERES_MAX);
  } catch {
    return [];
  }
}

/** Ajoute un cratère ; les plus anciens finissent par s'effacer. */
export const ajouteCratere = (liste: readonly CratereLune[], c: CratereLune): CratereLune[] =>
  [...liste, c].slice(-CRATERES_MAX);

let cratereLune: CratereLune[] | null = null;

/** Tous les cratères de la lune, gardés d'une partie à l'autre : ils viennent tous des joueurs de padel. */
export function crateresLune(): CratereLune[] {
  if (!cratereLune) {
    try {
      cratereLune = lisCrateres(localStorage.getItem(CLE_LUNE));
    } catch {
      cratereLune = [];
    }
  }
  return cratereLune;
}

function nouveauCratere(c: CratereLune): void {
  cratereLune = ajouteCratere(crateresLune(), c);
  try {
    localStorage.setItem(CLE_LUNE, JSON.stringify(cratereLune));
  } catch {
    /* tant pis : la lune garde son cratère jusqu'à la fermeture de la page */
  }
}

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
  /** où la balle s'écrase sur la lune (0 → 1) */
  xLune = 0.5;
  yLune = 0.5;
  /** le cratère de cette balle est déjà ajouté à la lune */
  cratereAjoute = false;

  declenche(variante: number, x: number, y: number): void {
    this.variante = variante;
    this.t = 0;
    this.actif = true;
    this.declenchee = true;
    this.xLune = 0.3 + Math.random() * 0.4;
    this.yLune = Math.random();
    this.cratereAjoute = false;
    this.x = x;
    this.y = y;
  }

  maj(dt: number): void {
    if (!this.actif) return;
    this.t += dt;
    if (this.t >= FINALE_FIN_S) this.actif = false;
  }

  /** La balle s'est écrasée sur la lune : son cratère reste pour les prochaines fois. */
  ajouteCratereLune(r: number): void {
    if (this.cratereAjoute) return;
    this.cratereAjoute = true;
    nouveauCratere({ x: this.xLune, y: this.yLune, r });
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
