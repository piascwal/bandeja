import { JEUX, NIVEAUX } from '@core/constants';
import type { LignePartie, VueListe } from '@render/lan-liste';
import type { VueSalon } from '@render/lan-salon';
import { FORMATS, NOMS_FORMATS, estFormat, peutLancer, siegeOuvert } from '../net/formats';
import { occupes, type EtatSalon } from '../net/salon';
import type { SessionClient } from '../net/session-client';
import type { SessionHote } from '../net/session-hote';

/** Libellés courts des formats, pour la rangée de choix du salon. */
const LIBELLES_FORMATS = {
  coop: 'COOP',
  '1v1': '1 V 1',
  '2v1': '2 V 1',
  '1v2': '1 V 2',
  '2v2': '2 V 2',
} as const;

/** Ce que les écrans du multijoueur ont besoin de savoir et de pouvoir faire. */
export interface ContexteVues {
  hote: SessionHote | null;
  client: SessionClient | null;
  etat: EtatSalon | null;
  phaseListe: VueListe['phase'];
  message: string | null;
  rejoint: (id: string) => void;
  cree: () => void;
  actualise: () => void;
  quitte: () => void;
}

export function construitVueListe(c: ContexteVues): VueListe {
  const parties: LignePartie[] = (c.client?.parties ?? []).map((p) => ({
    id: p.id,
    nom: p.nom,
    format: NOMS_FORMATS[p.format],
    joueurs: p.joueurs,
    spect: p.spect,
    enCours: p.enCours,
    score: p.score,
  }));
  return {
    phase: c.phaseListe,
    message: c.message,
    parties,
    onRejoint: c.rejoint,
    onCree: c.cree,
    onActualise: c.actualise,
    onRetour: c.quitte,
  };
}

export function construitVueSalon(c: ContexteVues): VueSalon | null {
  const e = c.etat;
  if (!e) return null;
  const { hote: h, client: cl } = c;
  const moi = h?.appareil ?? cl?.appareil ?? '';
  const f = e.config.format;
  // le code de vérification : l'hôte voit celui de chaque joueur, un invité le sien
  const code = (appareil: string): string | null =>
    h ? h.codeDe(appareil) : appareil === moi ? (cl?.code ?? null) : null;
  return {
    sieges: e.sieges.map((s, i) =>
      s ? { nom: s.nom, moi: s.appareil === moi, hote: i === 0, code: code(s.appareil) } : null,
    ),
    ouverts: [0, 1, 2, 3].map((i) => siegeOuvert(f, i)),
    spectateurs: e.spectateurs.length,
    formats: FORMATS.map((id) => ({ id, label: LIBELLES_FORMATS[id], actif: id === f })),
    niveau: NIVEAUX[e.config.niveau]!.nom,
    jeux: `${JEUX[e.config.jeux]} JEUX`,
    jeSuisHote: h !== null,
    monSiege: e.sieges.findIndex((s) => s?.appareil === moi),
    peutLancer: peutLancer(f, occupes(e)),
    latenceMs: h?.latenceMs ?? cl?.latenceMs ?? null,
    message: c.message,
    onSiege: (s) => cl?.agit({ a: 'siege', s }),
    onRegarde: () => cl?.agit({ a: 'regarde' }),
    onExclut: (s) => h?.agit({ a: 'exclut', s }),
    onFormat: (id) => estFormat(id) && h?.agit({ a: 'format', f: id }),
    onNiveau: () => h?.agit({ a: 'niveau', n: (e.config.niveau + 1) % NIVEAUX.length }),
    onJeux: () => h?.agit({ a: 'jeux', n: (e.config.jeux + 1) % JEUX.length }),
    onLance: () => h?.agit({ a: 'lance' }),
    onQuitte: c.quitte,
  };
}
