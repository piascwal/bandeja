import { C } from './palette';
import { texte } from './police';
import { dessinePseudo } from './lan-choix';
import { bouton, panneau, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

export interface VueLigne {
  /** `pret` : on choisit ; `recherche` : on cherche le salon ; `connexion` : on y entre ou on le crée ; `erreur` : pas d'Internet */
  phase: 'recherche' | 'pret' | 'erreur' | 'connexion';
  message: string | null;
  pseudo: string;
  /** le code d'un lien d'invitation, s'il y en a un */
  invitation: string | null;
  onCree: () => void;
  onRejoint: () => void;
  onInvitation: () => void;
  onPseudo: () => void;
  onRetour: () => void;
}

const BLEU = { couleur: '#1f7fb3', clair: '#6fd0ff', fonce: '#0f4d73' };
const VERT = { couleur: '#24995c', clair: '#5fe0a0', fonce: '#14603a' };

/** Écran « EN LIGNE » : créer un salon (son code s'affiche dans la salle d'attente) ou rejoindre celui d'un ami. */
export function dessineLigne(v: Vue, zones: ZoneBouton[], e: VueLigne, t: number): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.88);
  const cx = Math.round(W / 2);
  texte(g, 'EN LIGNE', cx, 6, C.blanc, 2, 'c');
  dessinePseudo(v, zones, e.pseudo, 28, e.onPseudo);
  const pw = Math.min(W - 24, 280);
  const py = 52;
  panneau(g, cx - pw / 2, py, pw, 62);
  if (e.phase === 'recherche' || e.phase === 'connexion') {
    const points = '.'.repeat(1 + (Math.floor(t * 2) % 3));
    texte(
      g,
      (e.phase === 'connexion' ? 'CONNEXION' : 'RECHERCHE DU SALON') + points,
      cx,
      py + 26,
      C.or,
      1,
      'c',
    );
  } else if (e.phase === 'erreur') {
    texte(g, e.message ?? 'INTERNET INTROUVABLE', cx, py + 18, '#ff7a90', 1, 'c');
    texte(g, 'VERIFIEZ VOTRE CONNEXION', cx, py + 32, C.grisBleu, 1, 'c');
    bouton(g, zones, 'REESSAYER', cx - 45, py + 44, 90, 13, e.onCree, BLEU);
  } else {
    bouton(g, zones, 'CREER UN SALON', cx - pw / 2 + 8, py + 6, pw - 16, 16, e.onCree, BLEU);
    if (e.invitation)
      bouton(
        g,
        zones,
        `REJOINDRE ${e.invitation}`,
        cx - pw / 2 + 8,
        py + 28,
        pw - 16,
        16,
        e.onInvitation,
        VERT,
      );
    else bouton(g, zones, 'REJOINDRE AVEC UN CODE', cx - pw / 2 + 8, py + 28, pw - 16, 16, e.onRejoint, VERT);
    texte(g, 'LE CODE SE DONNE DE VIVE VOIX OU PAR LIEN', cx, py + 49, C.grisBleu, 1, 'c');
  }
  if (e.message && e.phase !== 'erreur') texte(g, e.message, cx, py + 70, '#ff7a90', 1, 'c');
  if (e.invitation && e.phase === 'pret')
    bouton(g, zones, 'AUTRE CODE', cx - 45, py + 78, 90, 12, e.onRejoint, { couleur: '#232a58' });
  bouton(g, zones, '< RETOUR', cx - 45, H - 17, 90, 14, e.onRetour, { couleur: '#232a58' });
}
