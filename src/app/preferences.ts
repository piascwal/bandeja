import { JEUX, NIVEAUX } from '@core/constants';

export interface Preferences {
  /** indice dans NIVEAUX */
  niveau: number;
  /** indice dans JEUX */
  jeux: number;
  son: boolean;
  /** option avancée : le joueur est conduit vers la balle quand le joystick est au repos (désactivée par défaut) */
  aide: boolean;
  /** une ligne de conseils au bas de l'écran pendant le match (activée par défaut) */
  conseils: boolean;
  /** secousses d'écran réduites (confort) */
  secoussesReduites: boolean;
  /** nom affiché aux autres joueurs en réseau : majuscules, chiffres et espaces, 14 caractères au plus */
  nom: string;
  /** par niveau */
  victoires: number[];
  matchs: number[];
}

/** Même clé que le POC : les bilans déjà enregistrés sont repris. */
const CLE = 'padel-arcade-v1';

const NOM_SUR = /^[A-Z0-9 ]{1,14}$/;

/** Un nom par défaut, tiré au sort une fois : JOUEUR 42. */
export const nomAuHasard = (): string => `JOUEUR ${10 + Math.floor(Math.random() * 90)}`;

const DEFAUT = (): Preferences => ({
  niveau: 1,
  jeux: 1,
  son: true,
  aide: false,
  conseils: true,
  secoussesReduites: false,
  nom: nomAuHasard(),
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
    if (typeof o.aide === 'boolean') p.aide = o.aide;
    if (typeof o.conseils === 'boolean') p.conseils = o.conseils;
    if (typeof o.secoussesReduites === 'boolean') p.secoussesReduites = o.secoussesReduites;
    if (typeof o.nom === 'string' && NOM_SUR.test(o.nom)) p.nom = o.nom;
    p.victoires = compteurs(o.victoires);
    p.matchs = compteurs(o.matchs);
  } catch {
    /* sauvegarde illisible : on repart des valeurs par défaut */
  }
  return p;
}

export function chargePreferences(): Preferences {
  try {
    const brut = localStorage.getItem(CLE);
    const p = lisPreferences(brut);
    // le nom tiré au sort est gardé : on le retrouve d'une partie à l'autre
    if (!brut || !brut.includes('"nom"')) sauvePreferences(p);
    return p;
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
