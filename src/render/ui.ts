import { C } from './palette';
import { texte } from './police';
import { px } from './primitives';

/** Un bouton cliquable dessiné pendant l'image : les zones sont recalculées à chaque image. */
export interface ZoneBouton {
  x: number;
  y: number;
  w: number;
  h: number;
  act: () => void;
}

export interface StyleBouton {
  couleur?: string;
  clair?: string;
  fonce?: string;
  texte?: string;
  /** échelle du texte */
  e?: number;
}

export function bouton(
  g: CanvasRenderingContext2D,
  zones: ZoneBouton[],
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  act: () => void,
  st: StyleBouton = {},
): void {
  const e = st.e ?? 1;
  px(g, x - 1, y - 1, w + 2, h + 2, C.contour);
  px(g, x, y, w, h, st.couleur ?? '#1f2650');
  px(g, x, y, w, 1, st.clair ?? '#3a4590');
  px(g, x, y + h - 2, w, 2, st.fonce ?? '#141939');
  texte(g, label, x + w / 2, y + Math.round((h - 7 * e) / 2) - 1, st.texte ?? C.blanc, e, 'c');
  zones.push({ x, y, w, h, act });
}

/**
 * Le bouton PASSER des scènes (fin de super coup, rejeu) : seul lui les coupe, un appui ailleurs ne fait rien (on ne
 * les saute plus par erreur en tapant vite). Une fois touché, en réseau, il laisse place à l'attente des autres joueurs.
 * (x, y) : coin haut gauche du bouton ; la zone tactile déborde de quelques pixels.
 */
export const LARGEUR_PASSER = 58;
export function boutonPasser(
  g: CanvasRenderingContext2D,
  zones: ZoneBouton[],
  x: number,
  y: number,
  act: () => void,
  attend = false,
): void {
  if (attend) {
    texte(g, 'EN ATTENTE DES AUTRES JOUEURS...', x + LARGEUR_PASSER, y + 3, C.or, 1, 'd');
    return;
  }
  bouton(g, zones, 'PASSER >', x, y, LARGEUR_PASSER, 14, act, {
    couleur: '#7a2230',
    clair: '#b8465a',
    fonce: '#45101a',
  });
  zones[zones.length - 1] = { x: x - 8, y: y - 8, w: LARGEUR_PASSER + 16, h: 30, act };
}

export function panneau(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillStyle = 'rgba(7,9,20,0.78)';
  g.fillRect(x, y, w, h);
  px(g, x, y, w, 1, '#2a3160');
  px(g, x, y + h - 1, w, 1, '#2a3160');
  px(g, x, y, 1, h, '#2a3160');
  px(g, x + w - 1, y, 1, h, '#2a3160');
}

/** Le bouton touché par un appui à (x, y), s'il y en a un. */
export const boutonSous = (zones: ZoneBouton[], x: number, y: number): ZoneBouton | undefined =>
  zones.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);

/** Voile sombre sur tout l'écran (menus, pause, fin). */
export function voile(g: CanvasRenderingContext2D, W: number, H: number, a: number): void {
  g.fillStyle = `rgba(7,9,20,${a})`;
  g.fillRect(0, 0, W, H);
}
