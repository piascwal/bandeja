import { C } from './palette';
import { texte } from './police';
import { px } from './primitives';
import { boutonPasser, LARGEUR_PASSER, type ZoneBouton } from './ui';
import type { Vue } from './vue';

/** Par-dessus le rejeu : bandes de cinéma, pastille REC, avancement. Le bouton PASSER le passe. */
export function dessineRalenti(
  v: Vue,
  zones: ZoneBouton[],
  progression: number,
  t: number,
  onPasse: () => void,
  attend = false,
): void {
  const { g, W, H } = v;
  g.fillStyle = 'rgba(20,30,70,0.18)';
  g.fillRect(0, 0, W, H);
  // le tableau des scores reste visible : pastille en haut à gauche, bande de cinéma en bas
  px(g, 4, 3, 54, 11, C.contour);
  if (Math.floor(t * 2) % 2 === 0) px(g, 8, 7, 4, 4, '#e63a58');
  texte(g, 'RALENTI', 15, 6, C.blanc, 1, 'g');
  px(g, 0, H - 14, W, 14, C.contour);
  px(g, 0, H - 3, W, 3, '#0f1328');
  px(g, 0, H - 3, Math.round(W * progression), 3, C.or);
  boutonPasser(g, zones, W - LARGEUR_PASSER - 6, H - 30, onPasse, attend);
}
