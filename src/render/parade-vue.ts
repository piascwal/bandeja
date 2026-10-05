import { PARADE_DUREE_MAX, ZONE_PARADE } from '@core/constants';
import type { Partie } from '@core/types';
import { curseurParade } from '@core/super-coup';
import { dessineCurseur } from './curseur';
import { zonesBoutons } from '@input/disposition';
import { C } from './palette';
import { texte } from './police';
import { anneau, disque, px } from './primitives';
import type { Vue } from './vue';

/** Les couleurs de la barre de parade : le vert est étroit, entouré d'orange, puis de rouge. */
const SEGMENTS_PARADE = [
  { a: 0, b: 0.3, c: '#c8344a' },
  { a: 0.3, b: ZONE_PARADE.min, c: '#d9a52b' },
  { a: ZONE_PARADE.min, b: ZONE_PARADE.max, c: '#35e07a' },
  { a: ZONE_PARADE.max, b: 0.7, c: '#d9a52b' },
  { a: 0.7, b: 1, c: '#c8344a' },
];

/** Le camp qui doit parer est-il celui de cet écran ? Ses boutons d'action sont alors remplacés par la jauge et un bouton. */
export const defenseurParade = (jeu: Partie): boolean => !!jeu.parade && jeu.humain?.eq === jeu.parade.eq;

/**
 * La parade d'un super coup : le jeu passe au ralenti (environ 2 s) pour laisser
 * le temps de comprendre. Le camp qui subit voit, à la place de ses boutons
 * d'action, la jauge et un gros bouton STOP (n'importe quel appui arrête le
 * curseur) ; les autres voient une petite jauge sous le tableau des scores.
 */
export function dessineParade(v: Vue, jeu: Partie, t: number): void {
  const p = jeu.parade;
  if (!p) return;
  const { g, W, H } = v;
  const defenseur = defenseurParade(jeu);
  const pouls = 0.5 + 0.5 * Math.sin(t * 12);
  // un liseré rouge qui bat : le ralenti se voit sans cacher la piste
  g.globalAlpha = 0.2 + 0.2 * pouls;
  px(g, 0, 0, W, 3, '#ff2a4a');
  px(g, 0, H - 3, W, 3, '#ff2a4a');
  px(g, 0, 0, 3, H, '#ff2a4a');
  px(g, W - 3, 0, 3, H, '#ff2a4a');
  g.globalAlpha = 1;
  const reste = Math.max(0, 1 - p.ecoule / PARADE_DUREE_MAX);
  const jauge = (cx: number, y: number, w: number, h: number) => {
    dessineCurseur(g, {
      x: cx - w / 2,
      y,
      w,
      h,
      valeur: curseurParade(p.t),
      ancienne: (dt) => curseurParade(p.t - dt),
      segments: SEGMENTS_PARADE,
      zone: [ZONE_PARADE.min, ZONE_PARADE.max],
      temps: t,
      intense: true,
    });
    // le temps qui reste (côté hôte et solo : l'écoulé n'est pas transmis aux invités)
    if (p.ecoule > 0) {
      px(g, cx - w / 2, y + h + 5, w, 2, '#0f1328');
      px(g, cx - w / 2, y + h + 5, Math.round(w * reste), 2, reste < 0.3 ? '#ff2a4a' : C.or);
    }
  };
  if (!defenseur) {
    const cx = Math.round(W / 2);
    texte(g, 'SUPER COUP !', cx, 42, pouls > 0.5 ? '#ffffff' : '#ff7a3c', 2, 'c');
    jauge(cx, 56, Math.min(130, W - 40), 10);
    return;
  }
  // à la place des boutons d'action : la jauge au-dessus d'un gros bouton STOP
  const z = zonesBoutons(W, H).plat;
  const bx = z.x - 6;
  const by = z.y - 18;
  const w = Math.min(120, W * 0.35);
  texte(g, 'ARRETE DANS LE VERT !', bx - w / 2 + 40, by - 62, C.or, 1, 'c');
  jauge(bx - w / 2 + 40, by - 50, w, 14);
  disque(g, bx, by, 21, C.contour);
  disque(g, bx, by + 1, 20, '#b3202f');
  disque(g, bx, by, 18, pouls > 0.5 ? '#ff5470' : '#e03a58');
  anneau(g, bx, by, 24 + pouls * 3, '#ffffff', 1, 1);
  texte(g, 'STOP', bx, by - 3, C.blanc, 1, 'c');
}
