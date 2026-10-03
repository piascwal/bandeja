import { JEUX, NIVEAUX } from '@core/constants';
import { estFormat, peutLancer, siegeOuvert, type Format } from './formats';
import { REPRISE_S, SIEGES_MAX, SPECTATEURS_MAX } from './protocole';

/** Un appareil assis à un siège. `appareil` est son identifiant (inconnu des autres joueurs, jamais affiché). */
export interface Occupant {
  nom: string;
  appareil: string;
}

export interface ConfigSalon {
  format: Format;
  /** indice dans NIVEAUX : le niveau du CPU */
  niveau: number;
  /** indice dans JEUX : les jeux à gagner */
  jeux: number;
}

export type PhaseSalon = 'attente' | 'jeu' | 'fin';

/** L'état partagé de la partie : l'hôte en est le seul arbitre, les autres le reçoivent tel quel. */
export interface EtatSalon {
  config: ConfigSalon;
  /** les quatre sièges (voir formats.ts) ; l'hôte est assis d'office au premier */
  sieges: (Occupant | null)[];
  /** tous ceux qui ne jouent pas : arrivants, spectateurs, joueurs sortis de leur siège */
  spectateurs: Occupant[];
  phase: PhaseSalon;
  /** la partie est en pause pour tout le monde */
  pause: boolean;
  /** sièges dont le joueur a perdu la connexion en plein match : l'hôte les garde et fige la partie */
  absents: number[];
  /** secondes qu'il reste aux absents pour revenir (0 : personne n'est absent) */
  reconnexion: number;
  /** secondes avant la reprise du jeu, après une pause ou un retour (0 : le jeu tourne) */
  reprise: number;
}

/** Ce qu'un appareil demande (jamais « lancer » ni le format : ça ne vient pas du réseau). */
export type ActionSalon = { a: 'siege'; s: number } | { a: 'regarde' };

/** Ce que seul l'hôte peut faire sur son propre salon. */
export type ActionHote =
  | { a: 'format'; f: Format }
  | { a: 'niveau'; n: number }
  | { a: 'jeux'; n: number }
  | { a: 'exclut'; s: number }
  | { a: 'lance' }
  | { a: 'rejoue' }
  | { a: 'salon' };

export function nouveauSalon(hote: Occupant, config: ConfigSalon): EtatSalon {
  return {
    config,
    sieges: [hote, null, null, null],
    spectateurs: [],
    phase: 'attente',
    pause: false,
    absents: [],
    reconnexion: 0,
    reprise: 0,
  };
}

/** La simulation tourne-t-elle ? Non en pause, tant qu'un joueur est absent, et pendant le compte à rebours de reprise. */
export const jeuActif = (e: EtatSalon): boolean =>
  e.phase === 'jeu' && !e.pause && e.absents.length === 0 && e.reprise <= 0;

export const occupes = (e: EtatSalon): boolean[] => e.sieges.map((s) => s !== null);

/** Les sièges tenus par un humain, dans l'ordre : ce que la simulation attend. */
export const siegesHumains = (e: EtatSalon): number[] => e.sieges.flatMap((s, i) => (s ? [i] : []));

export const siegeDe = (e: EtatSalon, appareil: string): number =>
  e.sieges.findIndex((s) => s?.appareil === appareil);

const estPresent = (e: EtatSalon, appareil: string): boolean =>
  siegeDe(e, appareil) >= 0 || e.spectateurs.some((x) => x.appareil === appareil);

export const nbPresents = (e: EtatSalon): number => e.sieges.filter(Boolean).length + e.spectateurs.length;

/** Un appareil arrive : il regarde d'abord, et prend ensuite un siège s'il veut jouer. Faux si c'est plein. */
export function arrive(e: EtatSalon, o: Occupant): boolean {
  if (estPresent(e, o.appareil)) return false;
  if (e.spectateurs.length >= SPECTATEURS_MAX) return false;
  e.spectateurs.push(o);
  return true;
}

/** Un appareil part (volontairement ou connexion perdue) : son siège se libère. */
export function part(e: EtatSalon, appareil: string): void {
  e.sieges = e.sieges.map((s) => (s?.appareil === appareil ? null : s));
  e.spectateurs = e.spectateurs.filter((x) => x.appareil !== appareil);
}

/** Un appareil quitte son siège pour regarder. */
function regarde(e: EtatSalon, appareil: string): boolean {
  const i = siegeDe(e, appareil);
  if (i <= 0) return false; // l'hôte reste assis ; qui n'est pas assis regarde déjà
  e.spectateurs.push(e.sieges[i]!);
  e.sieges[i] = null;
  return true;
}

/**
 * Applique l'action d'un appareil (hôte compris) selon les règles du salon.
 * Les sièges ne se prennent ni ne se quittent une fois la partie lancée.
 */
export function appliqueAction(e: EtatSalon, appareil: string, x: ActionSalon): boolean {
  if (e.phase !== 'attente' || !estPresent(e, appareil)) return false;
  if (x.a === 'regarde') return regarde(e, appareil);
  if (!Number.isInteger(x.s) || x.s < 0 || x.s >= SIEGES_MAX || !siegeOuvert(e.config.format, x.s))
    return false;
  if (e.sieges[x.s]) return false; // déjà pris : personne ne vole un siège
  const ici = siegeDe(e, appareil);
  if (ici === 0) return false; // l'hôte garde le premier siège
  const o = ici >= 0 ? e.sieges[ici]! : e.spectateurs.find((v) => v.appareil === appareil)!;
  if (ici >= 0) e.sieges[ici] = null;
  else e.spectateurs = e.spectateurs.filter((v) => v.appareil !== appareil);
  e.sieges[x.s] = o;
  return true;
}

/**
 * Applique l'action de l'hôte : réglages, exclusion, lancement, revanche.
 * Renvoie true si elle a eu un effet ; « lance » fait passer la phase à `jeu`.
 */
export function appliqueActionHote(e: EtatSalon, x: ActionHote): boolean {
  if (x.a === 'lance') {
    if (e.phase !== 'attente' || !peutLancer(e.config.format, occupes(e))) return false;
    e.phase = 'jeu';
    return true;
  }
  if (x.a === 'rejoue') {
    if (e.phase !== 'fin') return false;
    e.phase = 'jeu';
    return true;
  }
  if (x.a === 'salon') {
    if (e.phase === 'attente') return false;
    e.phase = 'attente';
    e.pause = false;
    return true;
  }
  if (e.phase !== 'attente') return false;
  if (x.a === 'format') {
    if (!estFormat(x.f) || x.f === e.config.format) return false;
    e.config.format = x.f;
    // ceux dont le siège disparaît du format retournent regarder
    e.sieges = e.sieges.map((s, i) => {
      if (s && !siegeOuvert(x.f, i)) e.spectateurs.push(s);
      return s && siegeOuvert(x.f, i) ? s : null;
    });
    return true;
  }
  if (x.a === 'niveau') {
    if (!Number.isInteger(x.n) || x.n < 0 || x.n >= NIVEAUX.length) return false;
    e.config.niveau = x.n;
    return true;
  }
  if (x.a === 'jeux') {
    if (!Number.isInteger(x.n) || x.n < 0 || x.n >= JEUX.length) return false;
    e.config.jeux = x.n;
    return true;
  }
  if (x.a === 'exclut') {
    if (!Number.isInteger(x.s) || x.s <= 0 || x.s >= SIEGES_MAX || !e.sieges[x.s]) return false;
    e.sieges[x.s] = null; // l'appareil exclu est déconnecté par la session
    return true;
  }
  return false;
}

const TEXTE_NOM = /^[A-Z0-9 ]{1,14}$/;
const ID_APPAREIL = /^[0-9a-f]{16}$/;

const valideOccupant = (o: unknown): Occupant | null => {
  if (!o || typeof o !== 'object') return null;
  const v = o as Record<string, unknown>;
  if (typeof v.nom !== 'string' || !TEXTE_NOM.test(v.nom)) return null;
  if (typeof v.appareil !== 'string' || !ID_APPAREIL.test(v.appareil)) return null;
  return { nom: v.nom, appareil: v.appareil };
};

const PHASES: readonly PhaseSalon[] = ['attente', 'jeu', 'fin'];

/** Valide l'état reçu de l'hôte, champ par champ (jamais l'objet reçu tel quel). */
export function valideEtat(o: unknown): EtatSalon | null {
  if (!o || typeof o !== 'object') return null;
  const e = o as Record<string, unknown>;
  const c = e.config as Record<string, unknown> | undefined;
  if (!c || !estFormat(c.format)) return null;
  if (!Number.isInteger(c.niveau) || (c.niveau as number) < 0 || (c.niveau as number) >= NIVEAUX.length)
    return null;
  if (!Number.isInteger(c.jeux) || (c.jeux as number) < 0 || (c.jeux as number) >= JEUX.length) return null;
  if (!Array.isArray(e.sieges) || e.sieges.length !== SIEGES_MAX) return null;
  const sieges: (Occupant | null)[] = [];
  for (const s of e.sieges) {
    if (s === null) sieges.push(null);
    else {
      const o2 = valideOccupant(s);
      if (!o2) return null;
      sieges.push(o2);
    }
  }
  if (!Array.isArray(e.spectateurs) || e.spectateurs.length > SPECTATEURS_MAX) return null;
  const spectateurs: Occupant[] = [];
  for (const s of e.spectateurs) {
    const o2 = valideOccupant(s);
    if (!o2) return null;
    spectateurs.push(o2);
  }
  if (!PHASES.includes(e.phase as PhaseSalon) || typeof e.pause !== 'boolean') return null;
  if (!Array.isArray(e.absents) || e.absents.length > SIEGES_MAX) return null;
  if (!e.absents.every((i) => Number.isInteger(i) && i >= 0 && i < SIEGES_MAX && sieges[i])) return null;
  const compte = (v: unknown, max: number): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
  if (!compte(e.reconnexion, 600) || !compte(e.reprise, REPRISE_S)) return null;
  return {
    config: { format: c.format, niveau: c.niveau as number, jeux: c.jeux as number },
    sieges,
    spectateurs,
    phase: e.phase as PhaseSalon,
    pause: e.pause,
    absents: [...(e.absents as number[])],
    reconnexion: e.reconnexion,
    reprise: e.reprise,
  };
}

/** Valide une action reçue d'un invité. */
export function valideAction(o: unknown): ActionSalon | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (x.a === 'regarde') return { a: 'regarde' };
  if (x.a === 'siege' && Number.isInteger(x.s) && (x.s as number) >= 0 && (x.s as number) < SIEGES_MAX)
    return { a: 'siege', s: x.s as number };
  return null;
}
