import { C } from './palette';
import { texte } from './police';
import { bouton, panneau, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

export interface VueChoix {
  pseudo: string;
  onLigne: () => void;
  onLocal: () => void;
  onPseudo: () => void;
  onRetour: () => void;
}

const BLEU = { couleur: '#1f7fb3', clair: '#6fd0ff', fonce: '#0f4d73' };
const VERT = { couleur: '#24995c', clair: '#5fe0a0', fonce: '#14603a' };

/** Le pseudo, touchable pour le changer : il s'affiche aux autres joueurs. */
export function dessinePseudo(
  v: Vue,
  zones: ZoneBouton[],
  pseudo: string,
  y: number,
  onPseudo: () => void,
): void {
  const { g, W } = v;
  const cx = Math.round(W / 2);
  texte(g, 'PSEUDO', cx - 70, y + 4, C.gris, 1, 'g');
  bouton(g, zones, `${pseudo} >`, cx - 22, y, 92, 13, onPseudo, { couleur: '#232a58', texte: C.or });
}

/** Écran « MULTIJOUEUR » : en ligne (code de salon) ou sur le même Wi-Fi. */
export function dessineChoix(v: Vue, zones: ZoneBouton[], e: VueChoix): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.88);
  const cx = Math.round(W / 2);
  texte(g, 'MULTIJOUEUR', cx, 6, C.blanc, 2, 'c');
  dessinePseudo(v, zones, e.pseudo, 28, e.onPseudo);
  // deux boutons de même taille, à la largeur d'un bouton
  const bw = 130;
  const bh = 22;
  const py = 52;
  panneau(g, cx - bw / 2 - 10, py, bw + 20, bh * 2 + 24);
  bouton(g, zones, 'EN LIGNE', cx - bw / 2, py + 8, bw, bh, e.onLigne, { ...BLEU, e: 1 });
  bouton(g, zones, 'RESEAU LOCAL', cx - bw / 2, py + 16 + bh, bw, bh, e.onLocal, { ...VERT, e: 1 });
  bouton(g, zones, '< RETOUR', cx - 45, H - 17, 90, 14, e.onRetour, { couleur: '#232a58' });
}
