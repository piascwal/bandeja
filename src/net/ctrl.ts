import { JEUX, NIVEAUX } from '@core/constants';
import { lisMessageEvenement, type MessageEvenement } from './evenements';
import { estFormat } from './formats';
import { VERSION_PROTOCOLE } from './protocole';
import { valideAction, valideEtat, type ActionSalon, type EtatSalon } from './salon';

/**
 * Messages du canal fiable (JSON). Dans les deux sens, ni ordre ni débit ne
 * sont à craindre ; tout est tout de même validé à la réception.
 *
 * Invité → hôte : `bonjour` (se présente), `action` (siège), `pause`, `quitte`.
 * Hôte → invité : `etat` (le salon), `debut` (le match commence), `evt`, `pings` (la latence de chaque siège vue par l'hôte, en ms).
 * Dans les deux sens : `ping` / `pong` (latence et coupure, voir lan-kit).
 */
export type MsgCtrl =
  | { t: 'bonjour'; v: number; nom: string; appareil: string; jeton: string }
  | { t: 'action'; x: ActionSalon }
  | { t: 'pause'; oui: boolean }
  | { t: 'quitte' }
  | { t: 'etat'; e: EtatSalon }
  | { t: 'debut'; siege: number; niveau: number; jeux: number; sieges: number[]; graine: number }
  | { t: 'evt'; m: MessageEvenement }
  | { t: 'pings'; p: (number | null)[] }
  | { t: 'ping'; k: number }
  | { t: 'pong'; k: number };

const NOM = /^[A-Z0-9 ]{1,14}$/;
const APPAREIL = /^[0-9a-f]{16}$/;
const entier = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * Se présenter à l'hôte. Le jeton est un secret tiré à l'arrivée : il ne voyage
 * que dans la liaison chiffrée, et lui seul rend son siège à un joueur qui
 * revient après une coupure.
 */
export const bonjour = (nom: string, appareil: string, jeton: string): MsgCtrl => ({
  t: 'bonjour',
  v: VERSION_PROTOCOLE,
  nom,
  appareil,
  jeton,
});

/** Valide un message du canal fiable, champ par champ. Renvoie null si quoi que ce soit cloche. */
export function lisCtrl(o: unknown): MsgCtrl | null {
  if (!o || typeof o !== 'object') return null;
  const m = o as Record<string, unknown>;
  switch (m.t) {
    case 'bonjour':
      if (!entier(m.v, 0, 1000) || typeof m.nom !== 'string' || !NOM.test(m.nom)) return null;
      if (typeof m.appareil !== 'string' || !APPAREIL.test(m.appareil)) return null;
      if (typeof m.jeton !== 'string' || !APPAREIL.test(m.jeton)) return null;
      return { t: 'bonjour', v: m.v, nom: m.nom, appareil: m.appareil, jeton: m.jeton };
    case 'action': {
      const x = valideAction(m.x);
      return x ? { t: 'action', x } : null;
    }
    case 'pause':
      return typeof m.oui === 'boolean' ? { t: 'pause', oui: m.oui } : null;
    case 'quitte':
      return { t: 'quitte' };
    case 'etat': {
      const e = valideEtat(m.e);
      return e ? { t: 'etat', e } : null;
    }
    case 'debut': {
      if (
        !entier(m.siege, -1, 3) ||
        !entier(m.niveau, 0, NIVEAUX.length - 1) ||
        !entier(m.jeux, 0, JEUX.length - 1) ||
        !entier(m.graine, 0, 0xffffffff)
      )
        return null;
      if (!Array.isArray(m.sieges) || m.sieges.length > 4 || !m.sieges.every((s) => entier(s, 0, 3)))
        return null;
      return {
        t: 'debut',
        siege: m.siege,
        niveau: m.niveau,
        jeux: m.jeux,
        sieges: [...(m.sieges as number[])],
        graine: m.graine,
      };
    }
    case 'evt': {
      const e = lisMessageEvenement(m.m);
      return e ? { t: 'evt', m: e } : null;
    }
    case 'pings': {
      const p = m.p;
      if (!Array.isArray(p) || p.length !== 4) return null;
      if (!p.every((x) => x === null || entier(x, 0, 10_000))) return null;
      return { t: 'pings', p: [...(p as (number | null)[])] };
    }
    case 'ping':
    case 'pong':
      return typeof m.k === 'number' && Number.isFinite(m.k) ? { t: m.t, k: m.k } : null;
    default:
      return null;
  }
}

export { estFormat };
