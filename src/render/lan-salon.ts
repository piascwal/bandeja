import { C, EQUIPES } from './palette';
import { texte } from './police';
import { bouton, panneau, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

export interface SiegeVue {
  nom: string;
  /** c'est cet appareil */
  moi: boolean;
  hote: boolean;
}

export interface VueSalon {
  /** les quatre sièges : null = libre ; `ouverts` dit s'ils existent dans le format */
  sieges: (SiegeVue | null)[];
  ouverts: boolean[];
  spectateurs: number;
  format: string;
  niveau: string;
  jeux: string;
  jeSuisHote: boolean;
  /** le siège de cet appareil, -1 s'il regarde */
  monSiege: number;
  peutLancer: boolean;
  latenceMs: number | null;
  message: string | null;
  onSiege: (s: number) => void;
  onRegarde: () => void;
  onExclut: (s: number) => void;
  onFormat: () => void;
  onNiveau: () => void;
  onJeux: () => void;
  onLance: () => void;
  onQuitte: () => void;
}

const NOMS = ['A1', 'A2', 'B1', 'B2'];
const VERT = { couleur: '#24995c', clair: '#5fe0a0', fonce: '#14603a' };
const ROUGE = { couleur: '#d12f4c', clair: '#ff7a90', fonce: '#8c1b3a' };
const CARTE_H = 40;
const Y_CARTES = 16;

/** La salle d'attente : quatre sièges (A1 A2 contre B1 B2), les réglages, le lancement. */
export function dessineSalon(v: Vue, zones: ZoneBouton[], e: VueSalon): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.88);
  const cx = Math.round(W / 2);
  texte(g, 'SALLE D ATTENTE', cx, 3, C.blanc, 1, 'c');
  if (e.latenceMs !== null) texte(g, `${Math.round(e.latenceMs)} MS`, 4, 3, C.grisBleu, 1, 'g', null);

  const cw = Math.min(84, Math.floor((W - 28) / 4));
  const xs = [cx - 6 - 2 * cw - 2, cx - 6 - cw, cx + 6, cx + 6 + cw + 2];
  texte(g, 'EQUIPE A', xs[0]! + cw, Y_CARTES - 4, EQUIPES[0].clair, 1, 'c', null);
  texte(g, 'EQUIPE B', xs[2]! + cw, Y_CARTES - 4, EQUIPES[1].clair, 1, 'c', null);
  texte(g, 'VS', cx, Y_CARTES + 20, C.gris, 1, 'c', null);
  e.sieges.forEach((s, i) => carte(v, zones, e, s, i, xs[i]!, Y_CARTES + 4, cw));

  const yS = Y_CARTES + 4 + CARTE_H + 6;
  texte(
    g,
    e.spectateurs ? `${e.spectateurs} SPECTATEUR${e.spectateurs > 1 ? 'S' : ''}` : 'AUCUN SPECTATEUR',
    cx,
    yS,
    C.grisBleu,
    1,
    'c',
    null,
  );
  if (e.monSiege > 0)
    bouton(g, zones, 'REGARDER', cx - 40, yS + 9, 80, 12, e.onRegarde, { couleur: '#232a58' });

  // les réglages : à l'hôte, les autres voient les valeurs
  const yR = yS + 25;
  const pw = Math.min(W - 16, 250);
  panneau(g, cx - pw / 2, yR - 3, pw, 3 * 14 + 4);
  const lignes: [string, string, () => void][] = [
    ['FORMAT', e.format, e.onFormat],
    ['CPU', e.niveau, e.onNiveau],
    ['MATCH', e.jeux, e.onJeux],
  ];
  lignes.forEach(([k, val, act], i) => {
    const y = yR + i * 14;
    texte(g, k, cx - pw / 2 + 6, y + 3, C.gris, 1, 'g');
    if (e.jeSuisHote) bouton(g, zones, `< ${val} >`, cx - 10, y, pw / 2 + 4, 12, act, { couleur: '#232a58' });
    else texte(g, val, cx + 6, y + 3, C.blanc, 1, 'g');
  });

  const yB = H - 36;
  if (e.message) texte(g, e.message, cx, yB - 9, '#ff7a90', 1, 'c');
  if (e.jeSuisHote)
    bouton(
      g,
      zones,
      e.peutLancer ? 'LANCER' : 'EN ATTENTE DE JOUEURS',
      cx - 90,
      yB,
      180,
      18,
      e.peutLancer ? e.onLance : () => {},
      e.peutLancer ? ROUGE : { couleur: '#151a38', texte: C.grisBleu },
    );
  else texte(g, 'EN ATTENTE DE L HOTE', cx, yB + 6, C.or, 1, 'c');
  bouton(g, zones, '< QUITTER', cx - 45, H - 15, 90, 13, e.onQuitte, { couleur: '#232a58' });
}

function carte(
  v: Vue,
  zones: ZoneBouton[],
  e: VueSalon,
  s: SiegeVue | null,
  i: number,
  x: number,
  y: number,
  w: number,
): void {
  const { g } = v;
  const equipe = EQUIPES[i < 2 ? 0 : 1];
  const ouvert = e.ouverts[i]!;
  panneau(g, x, y, w, CARTE_H);
  g.fillStyle = ouvert ? equipe.maillot : '#2a3160';
  g.fillRect(x + 1, y + 1, w - 2, 3);
  texte(g, NOMS[i]!, x + 4, y + 7, ouvert ? equipe.clair : C.grisBleu, 1, 'g', null);
  if (!ouvert) {
    texte(g, 'FERME', x + w / 2, y + 22, C.grisBleu, 1, 'c', null);
    return;
  }
  if (s) {
    texte(
      g,
      s.nom.slice(0, Math.floor((w - 4) / 6)),
      x + w / 2,
      y + 18,
      s.moi ? C.or : C.blanc,
      1,
      'c',
      null,
    );
    texte(g, s.hote ? 'HOTE' : s.moi ? 'VOUS' : 'JOUEUR', x + w / 2, y + 28, C.grisBleu, 1, 'c', null);
    if (e.jeSuisHote && !s.hote) bouton(g, zones, 'X', x + w - 13, y + 5, 11, 10, () => e.onExclut(i), ROUGE);
    return;
  }
  texte(g, 'CPU', x + w / 2, y + 17, C.gris, 1, 'c', null);
  if (!e.jeSuisHote || e.monSiege !== 0)
    bouton(g, zones, 'PRENDRE', x + 4, y + 26, w - 8, 11, () => e.onSiege(i), VERT);
}
