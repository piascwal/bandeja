import type { Equipe } from '@core/types';
import { recoloreTampon } from './couleurs';
import { canvas, miroir } from './primitives';

export type Pose = 'attente' | 'course' | 'droit' | 'revers' | 'smash1' | 'smash2';

export interface InfoPose {
  w: number;
  h: number;
  /** point posé au sol, dans le dessin tourné vers la droite */
  pied: { x: number; y: number };
  /** abscisse du visage : toutes les poses sont calées sur la tête, qui ne saute pas d'une pose à l'autre */
  tete: number;
  /** échelle de la pose : la tête garde la même taille partout */
  ech: number;
}

/**
 * Les joueurs dessinés (public/sprites/) : six poses (attente, course, coup
 * droit, revers, coup aérien armé, coup aérien sauté), fond retiré, tournées
 * vers la droite.
 */
export const POSES: Record<Pose, InfoPose> = {
  attente: { w: 74, h: 111, pied: { x: 34, y: 110 }, tete: 32, ech: 1 },
  course: { w: 90, h: 111, pied: { x: 72.5, y: 110 }, tete: 47.5, ech: 1 },
  // le dessin du coup droit est un peu plus près que les autres : on le réduit légèrement
  droit: { w: 107, h: 116, pied: { x: 61, y: 115 }, tete: 86, ech: 0.88 },
  revers: { w: 75, h: 122, pied: { x: 37.5, y: 121 }, tete: 42.5, ech: 1 },
  smash1: { w: 94, h: 122, pied: { x: 43.5, y: 121 }, tete: 45, ech: 1 },
  // le coup aérien sauté décolle : son point d'appui est sous ses pieds, comme le coup armé
  smash2: { w: 94, h: 124, pied: { x: 43.5, y: 133 }, tete: 46.7, ech: 1 },
};

/** Hauteur à l'écran (pixels du décor) de la pose d'attente. */
export const HAUT_JOUEUR = 36;
/** Taille d'un pixel du dessin : plus fin qu'un pixel du décor, pour garder les détails. */
export const ECH_SPR = HAUT_JOUEUR / POSES.attente.h;
/** Maillot : bleu pour vous, rouge d'origine pour l'ordinateur. */
const TEINTES_EQ: readonly [number | null, number | null] = [195, null];

/** Pour chaque pose : [tourné à droite, tourné à gauche]. */
export type SpritesEquipe = Record<Pose, [HTMLCanvasElement, HTMLCanvasElement]>;

function chargeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error(`sprite introuvable : ${src}`));
    img.src = src;
  });
}

function recolore(img: HTMLImageElement, eq: Equipe): [HTMLCanvasElement, HTMLCanvasElement] {
  const [c, x] = canvas(img.width, img.height);
  x.drawImage(img, 0, 0);
  const teinte = TEINTES_EQ[eq];
  if (teinte !== null) {
    const im = x.getImageData(0, 0, c.width, c.height);
    recoloreTampon(im.data, teinte);
    x.putImageData(im, 0, 0);
  }
  return [c, miroir(c)];
}

/** Charge les six poses et prépare les versions de chaque équipe. */
export async function chargeSprites(base: string): Promise<[SpritesEquipe, SpritesEquipe]> {
  const noms = Object.keys(POSES) as Pose[];
  const images = await Promise.all(noms.map((n) => chargeImage(`${base}sprites/${n}.png`)));
  const pourEquipe = (eq: Equipe) =>
    Object.fromEntries(noms.map((n, i) => [n, recolore(images[i]!, eq)])) as SpritesEquipe;
  return [pourEquipe(0), pourEquipe(1)];
}
