import { JEUX, NIVEAUX } from '@core/constants';

export interface Preferences {
  /** indice dans NIVEAUX */
  niveau: number;
  /** indice dans JEUX */
  jeux: number;
  son: boolean;
  /** par niveau */
  victoires: number[];
  matchs: number[];
}

/** Même clé que le POC : les bilans déjà enregistrés sont repris. */
const CLE = 'padel-arcade-v1';

const DEFAUT = (): Preferences => ({
  niveau: 1,
  jeux: 1,
  son: true,
  victoires: [0, 0, 0],
  matchs: [0, 0, 0],
});

const indice = (v: unknown, n: number, defaut: number): number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : defaut;

const compteurs = (v: unknown): number[] =>
  NIVEAUX.map((_, i) => (Array.isArray(v) && Number.isFinite(v[i]) ? Number(v[i]) : 0));

/** Lit les préférences sauvegardées, en ignorant toute valeur abîmée. */
export function lisPreferences(brut: string | null): Preferences {
  const p = DEFAUT();
  if (!brut) return p;
  try {
    const o = JSON.parse(brut) as Record<string, unknown>;
    p.niveau = indice(o.niveau, NIVEAUX.length, p.niveau);
    p.jeux = indice(o.jeux, JEUX.length, p.jeux);
    if (typeof o.son === 'boolean') p.son = o.son;
    p.victoires = compteurs(o.victoires);
    p.matchs = compteurs(o.matchs);
  } catch {
    /* sauvegarde illisible : on repart des valeurs par défaut */
  }
  return p;
}

export function chargePreferences(): Preferences {
  try {
    return lisPreferences(localStorage.getItem(CLE));
  } catch {
    return DEFAUT(); // stockage indisponible
  }
}

export function sauvePreferences(p: Preferences): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(p));
  } catch {
    /* tant pis */
  }
}
