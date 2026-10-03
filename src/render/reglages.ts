import { C } from './palette';
import { texte } from './police';
import { disque } from './primitives';
import { bouton, panneau, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

export type OngletCommandes = 'tactile' | 'clavier';

export interface EtatReglages {
  son: boolean;
  onglet: OngletCommandes;
  onSon: () => void;
  onOnglet: (o: OngletCommandes) => void;
  onRetour: () => void;
}

/** Une commande : sa pastille (couleur du bouton), son nom et ce qu'elle fait. */
interface Ligne {
  pastille?: string;
  touche: string;
  action: string;
}

const COUPS: Ligne[] = [
  { pastille: '#ff5470', touche: 'FRAPPE', action: 'COUP PUISSANT - SMASH SI BALLE HAUTE' },
  { pastille: '#35c47a', touche: 'COUPE', action: 'COUP COUPE - PLUS COURT ET PLUS BAS' },
  { pastille: '#3fb4e8', touche: 'LOBE', action: 'BALLE HAUTE PAR-DESSUS LES ADVERSAIRES' },
  { pastille: '#2fd0c6', touche: 'AMORTI', action: 'BALLE COURTE JUSTE DERRIERE LE FILET' },
  { pastille: C.or, touche: 'CENTRE', action: 'BANDEJA - VIBORA SI JOYSTICK HAUT / BAS' },
];

const TACTILE: Ligne[] = [
  { touche: 'JOYSTICK', action: 'MOITIE GAUCHE : SE DEPLACER' },
  ...COUPS,
  { pastille: '#5a6082', touche: 'COURIR', action: 'COURIR PLUS VITE' },
];

const CLAVIER: Ligne[] = [
  { touche: 'FLECHES', action: 'SE DEPLACER - OU ZQSD / WASD' },
  { pastille: '#ff5470', touche: 'K', action: 'FRAPPE' },
  { pastille: '#35c47a', touche: 'J', action: 'COUPE' },
  { pastille: '#3fb4e8', touche: 'L', action: 'LOBE' },
  { pastille: '#2fd0c6', touche: 'I', action: 'AMORTI' },
  { pastille: C.or, touche: 'ESPACE', action: 'BANDEJA OU VIBORA - BALLE HAUTE' },
  { touche: 'MAJ', action: 'COURIR' },
  { touche: 'ECHAP', action: 'PAUSE' },
];

const ASTUCES = [
  'APPUYEZ AVANT LA BALLE : PLUS TOT - PLUS FORT',
  'JOYSTICK VERS SA VITRE A L IMPACT : REBOND',
  'SERVICE : UN APPUI LANCE LA JAUGE - UN AUTRE SERT',
  'VERT SUR LA JAUGE : SERVICE PARFAIT',
];

/** Réglages : le son, puis l'aide des commandes (tactile ou clavier, au choix par onglet). */
export function dessineReglages(v: Vue, zones: ZoneBouton[], e: EtatReglages): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.88);
  const cx = Math.round(W / 2);
  texte(g, 'REGLAGES', cx, 4, C.blanc, 1, 'c');
  bouton(g, zones, `SON : ${e.son ? 'OUI' : 'NON'}`, cx - 50, 15, 100, 13, e.onSon, { couleur: '#232a58' });

  texte(g, 'COMMANDES', cx, 35, C.gris, 1, 'c');
  const onglet = (o: OngletCommandes, label: string, x: number) => {
    const actif = e.onglet === o;
    bouton(g, zones, label, x, 46, 80, 13, () => e.onOnglet(o), {
      couleur: actif ? '#2d3a8c' : '#151a38',
      texte: actif ? C.or : C.grisBleu,
    });
  };
  onglet('tactile', 'TACTILE', cx - 84);
  onglet('clavier', 'CLAVIER', cx + 4);

  const lignes = e.onglet === 'tactile' ? TACTILE : CLAVIER;
  const pas = 11;
  const pw = Math.min(W - 16, 360);
  const hauteur = lignes.length * pas + ASTUCES.length * 9 + 22;
  const y0 = 64;
  panneau(g, cx - pw / 2, y0, pw, hauteur);
  lignes.forEach((l, i) => {
    const y = y0 + 6 + i * pas;
    if (l.pastille) disque(g, cx - pw / 2 + 10, y + 3, 3, l.pastille);
    texte(g, l.touche, cx - pw / 2 + 20, y, C.or, 1, 'g');
    texte(g, l.action, cx - pw / 2 + 80, y, C.blanc, 1, 'g');
  });
  const ya = y0 + 10 + lignes.length * pas;
  ASTUCES.forEach((a, i) => texte(g, a, cx, ya + i * 9, C.grisBleu, 1, 'c'));
  bouton(g, zones, '< RETOUR', cx - 45, H - 20, 90, 16, e.onRetour, { couleur: '#232a58' });
}
