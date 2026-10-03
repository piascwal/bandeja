import { C } from './palette';
import { texte } from './police';
import { px } from './primitives';
import type { ZoneBouton } from './ui';
import type { Vue } from './vue';

/** Par-dessus le rejeu : bandes de cinéma, pastille REC, avancement. Toucher l'écran passe le ralenti. */
export function dessineRalenti(
  v: Vue,
  zones: ZoneBouton[],
  progression: number,
  t: number,
  onPasse: () => void,
): void {
  const { g, W, H } = v;
  g.fillStyle = 'rgba(20,30,70,0.18)';
  g.fillRect(0, 0, W, H);
  // le tableau des scores reste visible : pastille en haut à gauche, bande de cinéma en bas
  px(g, 4, 3, 54, 11, C.contour);
  if (Math.floor(t * 2) % 2 === 0) px(g, 8, 7, 4, 4, '#e63a58');
  texte(g, 'RALENTI', 15, 6, C.blanc, 1, 'g');
  px(g, 0, H - 14, W, 14, C.contour);
  texte(g, 'TOUCHEZ POUR PASSER', W - 8, H - 11, C.grisBleu, 1, 'd');
  px(g, 0, H - 3, W, 3, '#0f1328');
  px(g, 0, H - 3, Math.round(W * progression), 3, C.or);
  zones.push({ x: 0, y: 0, w: W, h: H, act: onPasse });
}
