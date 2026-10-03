import { C } from './palette';
import { texte } from './police';
import { bouton, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

/** Ce qui fige le match et qu'on explique à l'écran, par-dessus la piste. */
export type AttenteLan =
  /** un ou plusieurs joueurs ont perdu la connexion : la partie les attend */
  | { type: 'absents'; noms: string[]; reste: number; jeSuisHote: boolean; onNePlusAttendre: () => void }
  /** compte à rebours avant la reprise (après une pause ou un retour) */
  | { type: 'reprise'; n: number }
  /** CET appareil a perdu la connexion et essaie de revenir */
  | { type: 'reconnexion'; onQuitte: () => void };

export function dessineAttente(v: Vue, zones: ZoneBouton[], a: AttenteLan, t: number): void {
  const { g, W, H } = v;
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  if (a.type === 'reprise') {
    voile(g, W, H, 0.35);
    texte(g, 'ON REPREND', cx, cy - 34, C.gris, 1, 'c');
    texte(g, a.n, cx, cy - 20, C.or, 4, 'c');
    return;
  }
  voile(g, W, H, 0.7);
  const points = '.'.repeat(1 + (Math.floor(t * 2) % 3));
  texte(g, 'CONNEXION PERDUE', cx, cy - 36, '#ff7a90', 2, 'c');
  if (a.type === 'reconnexion') {
    texte(g, `RECONNEXION${points}`, cx, cy - 8, C.or, 1, 'c');
    texte(g, 'LA PARTIE VOUS ATTEND', cx, cy + 6, C.gris, 1, 'c');
    bouton(g, zones, 'QUITTER', cx - 45, cy + 26, 90, 16, a.onQuitte, { couleur: '#232a58' });
    return;
  }
  texte(g, `EN ATTENTE DE ${a.noms.join(' ET ').slice(0, 30)}${points}`, cx, cy - 8, C.or, 1, 'c');
  texte(g, `${a.reste} S`, cx, cy + 4, C.blanc, 2, 'c');
  if (a.jeSuisHote)
    bouton(g, zones, 'NE PLUS ATTENDRE', cx - 60, cy + 28, 120, 16, a.onNePlusAttendre, {
      couleur: '#d12f4c',
      clair: '#ff7a90',
      fonce: '#8c1b3a',
    });
  else texte(g, 'LE MATCH REPREND AU RETOUR', cx, cy + 28, C.grisBleu, 1, 'c');
}
