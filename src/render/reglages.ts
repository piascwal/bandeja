import { C } from './palette';
import { texte } from './police';
import { bouton, panneau, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

export interface EtatReglages {
  son: boolean;
  aide: boolean;
  bandeCommandes: boolean;
  secoussesReduites: boolean;
  onSon: () => void;
  onAide: () => void;
  onBande: () => void;
  onSecousses: () => void;
  onCommandes: () => void;
  onRetour: () => void;
}

/**
 * Réglages avancés, comme dans Face-Off : un réglage par ligne, le nom à
 * gauche et sa valeur (qu'on touche pour la changer) à droite ; les commandes
 * ont leur propre écran.
 */
export function dessineReglages(v: Vue, zones: ZoneBouton[], e: EtatReglages): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.88);
  const cx = Math.round(W / 2);
  texte(g, 'REGLAGES AVANCES', cx, 4, C.blanc, 1, 'c');
  const lignes: [string, string, () => void][] = [
    ['SON', e.son ? 'OUI' : 'NON', e.onSon],
    ['AIDE AU DEPLACEMENT', e.aide ? 'OUI' : 'NON', e.onAide],
    ['COMMANDES HORS TERRAIN', e.bandeCommandes ? 'OUI' : 'NON', e.onBande],
    ['SECOUSSES ECRAN', e.secoussesReduites ? 'REDUITES' : 'NORMALES', e.onSecousses],
  ];
  const pw = 250;
  const ph = lignes.length * 16 + 12;
  const py = Math.max(14, Math.round(H * 0.18) - 10);
  panneau(g, cx - pw / 2, py, pw, ph);
  lignes.forEach(([k, val, act], i) => {
    const y = py + 6 + i * 16;
    texte(g, k, cx - pw / 2 + 10, y + 4, C.gris, 1, 'g');
    bouton(g, zones, `< ${val} >`, cx + pw / 2 - 106, y, 96, 13, act, { couleur: '#232a58' });
  });
  texte(g, 'AIDE : LE JOUEUR VA SEUL VERS LA BALLE', cx, py + ph + 4, C.grisBleu, 1, 'c');
  bouton(g, zones, '< RETOUR', cx - 80, py + ph + 18, 76, 16, e.onRetour, { couleur: '#232a58', e: 1 });
  bouton(g, zones, 'COMMANDES', cx + 4, py + ph + 18, 76, 16, e.onCommandes, { couleur: '#2d3a8c', e: 1 });
}
