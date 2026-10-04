import type { Evenement, Equipe } from '@core/types';
import { COUPS, SERVICES } from './protocole';

/** Un évènement tel qu'il voyage : daté du temps de simulation où il s'est produit. */
export interface MessageEvenement {
  t: number;
  e: Evenement;
}

const RAISON = /^[A-Z0-9 !'.-]{1,24}$/;
const SURFACES = ['sol', 'vitre', 'grille', 'filet'] as const;

const nombre = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const entier = (v: unknown, min: number, max: number): v is number =>
  nombre(v, min, max) && Number.isInteger(v);
const equipe = (v: unknown): v is Equipe => v === 0 || v === 1;

/**
 * Valide un évènement reçu de l'hôte (JSON sur le canal fiable) : type connu,
 * champs bornés, chaînes sûres. Renvoie un évènement reconstruit champ par
 * champ, jamais l'objet reçu tel quel.
 */
export function lisEvenement(o: unknown): Evenement | null {
  if (!o || typeof o !== 'object') return null;
  const e = o as Record<string, unknown>;
  switch (e.type) {
    case 'impact':
      if (
        !SURFACES.includes(e.surface as never) ||
        !nombre(e.x, -1000, 1000) ||
        !nombre(e.y, -1000, 1000) ||
        !nombre(e.z, -1000, 1000) ||
        !nombre(e.force, 0, 1000)
      )
        return null;
      return {
        type: 'impact',
        surface: e.surface as (typeof SURFACES)[number],
        x: e.x,
        y: e.y,
        z: e.z,
        force: e.force,
      };
    case 'frappe':
      if (
        !COUPS.includes(e.coup as never) ||
        !nombre(e.puissance, 0, 1) ||
        typeof e.portres !== 'boolean' ||
        typeof e.humain !== 'boolean' ||
        !nombre(e.x, -100, 100) ||
        !nombre(e.y, -100, 100) ||
        !entier(e.q, 1, 5) ||
        !entier(e.sv, 0, 4)
      )
        return null;
      return {
        type: 'frappe',
        coup: e.coup as (typeof COUPS)[number],
        puissance: e.puissance,
        portres: e.portres,
        humain: e.humain,
        x: e.x,
        y: e.y,
        q: e.q,
        sv: e.sv,
      };
    case 'service':
      if (
        !SERVICES.includes(e.service as never) ||
        !nombre(e.jauge, 0, 1) ||
        typeof e.humain !== 'boolean' ||
        !nombre(e.x, -100, 100) ||
        !nombre(e.y, -100, 100)
      )
        return null;
      return {
        type: 'service',
        service: e.service as (typeof SERVICES)[number],
        jauge: e.jauge,
        humain: e.humain,
        x: e.x,
        y: e.y,
      };
    case 'jaugeLancee':
      return { type: 'jaugeLancee' };
    case 'point':
      if (!equipe(e.gagnant) || typeof e.raison !== 'string' || !RAISON.test(e.raison)) return null;
      return { type: 'point', gagnant: e.gagnant, raison: e.raison };
    case 'faute':
      if (typeof e.raison !== 'string' || !RAISON.test(e.raison)) return null;
      return { type: 'faute', raison: e.raison };
    case 'let':
      return { type: 'let' };
    case 'jeu':
      if (
        !equipe(e.gagnant) ||
        !Array.isArray(e.jeux) ||
        e.jeux.length !== 2 ||
        !entier(e.jeux[0], 0, 99) ||
        !entier(e.jeux[1], 0, 99)
      )
        return null;
      return { type: 'jeu', gagnant: e.gagnant, jeux: [e.jeux[0], e.jeux[1]] };
    case 'pointEnOr':
      return { type: 'pointEnOr' };
    case 'finMatch':
      if (!equipe(e.gagnant)) return null;
      return { type: 'finMatch', gagnant: e.gagnant };
    default:
      return null;
  }
}

/** Valide l'enveloppe datée d'un évènement. */
export function lisMessageEvenement(o: unknown): MessageEvenement | null {
  if (!o || typeof o !== 'object') return null;
  const m = o as Record<string, unknown>;
  if (!nombre(m.t, 0, 1e7)) return null;
  const e = lisEvenement(m.e);
  return e ? { t: m.t, e } : null;
}
