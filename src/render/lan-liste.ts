import { C } from './palette';
import { texte } from './police';
import { bouton, panneau, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

/** Une partie vue sur le Wi-Fi, prête à afficher. */
export interface LignePartie {
  id: string;
  nom: string;
  format: string;
  joueurs: number;
  spect: number;
  enCours: boolean;
  score: [number, number];
}

export interface VueListe {
  /** `recherche` : on cherche le réseau ; `pret` : la liste est à jour ; `erreur` : pas de réseau ; `connexion` : on rejoint une partie */
  phase: 'recherche' | 'pret' | 'erreur' | 'connexion';
  message: string | null;
  parties: LignePartie[];
  onRejoint: (id: string) => void;
  onCree: () => void;
  onActualise: () => void;
  onRetour: () => void;
}

const BLEU = { couleur: '#1f7fb3', clair: '#6fd0ff', fonce: '#0f4d73' };
const VERT = { couleur: '#24995c', clair: '#5fe0a0', fonce: '#14603a' };
const PAS = 20;
const Y0 = 36;

/** Écran « MULTI WIFI » : les parties du réseau, ou en créer une. */
export function dessineListe(v: Vue, zones: ZoneBouton[], e: VueListe, t: number): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.88);
  const cx = Math.round(W / 2);
  texte(g, 'MULTI WIFI', cx, 4, C.blanc, 2, 'c');
  const pw = Math.min(W - 16, 380);
  const x0 = cx - pw / 2;
  const maxLignes = Math.max(1, Math.floor((H - Y0 - 52) / PAS));
  panneau(g, x0, Y0 - 4, pw, maxLignes * PAS + 8);

  if (e.phase === 'erreur') {
    texte(g, e.message ?? 'RESEAU INTROUVABLE', cx, Y0 + 14, '#ff7a90', 1, 'c');
    texte(g, 'VERIFIEZ LE WI-FI : PAS DE RESEAU INVITE', cx, Y0 + 28, C.grisBleu, 1, 'c');
  } else if (e.phase === 'recherche' || e.phase === 'connexion') {
    const points = '.'.repeat(1 + (Math.floor(t * 2) % 3));
    texte(g, (e.phase === 'connexion' ? 'CONNEXION' : 'RECHERCHE') + points, cx, Y0 + 20, C.or, 1, 'c');
  } else if (e.parties.length === 0) {
    texte(g, 'AUCUNE PARTIE SUR CE WI-FI', cx, Y0 + 14, C.gris, 1, 'c');
    texte(g, 'CREEZ-EN UNE : LES AUTRES LA VERRONT', cx, Y0 + 28, C.grisBleu, 1, 'c');
  } else {
    e.parties.slice(0, maxLignes).forEach((p, i) => {
      const y = Y0 + i * PAS;
      texte(g, p.nom.slice(0, 14), x0 + 8, y + 1, C.blanc, 1, 'g');
      const detail = p.enCours ? `EN COURS ${p.score[0]}-${p.score[1]}` : `${p.format} - ${p.joueurs}/4`;
      texte(g, detail, x0 + 8, y + 10, C.grisBleu, 1, 'g');
      const label = p.enCours ? 'REGARDER' : 'REJOINDRE';
      bouton(
        g,
        zones,
        label,
        x0 + pw - 78,
        y,
        72,
        16,
        () => e.onRejoint(p.id),
        p.enCours ? { couleur: '#232a58' } : VERT,
      );
    });
  }
  if (e.message && e.phase !== 'erreur') texte(g, e.message, cx, H - 46, '#ff7a90', 1, 'c');
  bouton(g, zones, 'CREER UNE PARTIE', cx - 108, H - 36, 104, 16, e.onCree, BLEU);
  bouton(g, zones, 'ACTUALISER', cx + 4, H - 36, 104, 16, e.onActualise, { couleur: '#232a58' });
  bouton(g, zones, '< RETOUR', cx - 45, H - 17, 90, 14, e.onRetour, { couleur: '#232a58' });
}
