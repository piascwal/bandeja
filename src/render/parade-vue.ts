import { PARADE_DUREE_MAX, ZONE_PARADE } from '@core/constants';
import type { Partie } from '@core/types';
import { curseurParade } from '@core/super-coup';
import { dessineCurseur } from './curseur';
import { C } from './palette';
import { texte } from './police';
import { px } from './primitives';
import type { Vue } from './vue';

/** Les couleurs de la barre de parade : le vert est étroit, entouré d'orange, puis de rouge. */
const SEGMENTS_PARADE = [
  { a: 0, b: 0.3, c: '#c8344a' },
  { a: 0.3, b: ZONE_PARADE.min, c: '#d9a52b' },
  { a: ZONE_PARADE.min, b: ZONE_PARADE.max, c: '#35e07a' },
  { a: ZONE_PARADE.max, b: 0.7, c: '#d9a52b' },
  { a: 0.7, b: 1, c: '#c8344a' },
];

/**
 * La parade d'un super coup : le jeu est figé, l'écran s'assombrit et rougit,
 * et le camp qui subit doit arrêter le curseur dans le vert (n'importe quel
 * appui). Tout le monde voit la scène ; seul ce camp peut agir.
 */
export function dessineParade(v: Vue, jeu: Partie, t: number): void {
  const p = jeu.parade;
  if (!p) return;
  const { g, W, H } = v;
  const moi = jeu.humain?.eq;
  const defenseur = moi === p.eq;
  const pouls = 0.5 + 0.5 * Math.sin(t * 12);
  // l'écran s'assombrit, les bords rougeoient
  g.fillStyle = 'rgba(7,9,20,0.5)';
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.25 + 0.2 * pouls;
  px(g, 0, 0, W, 5, '#ff2a4a');
  px(g, 0, H - 5, W, 5, '#ff2a4a');
  px(g, 0, 0, 5, H, '#ff2a4a');
  px(g, W - 5, 0, 5, H, '#ff2a4a');
  g.globalAlpha = 1;
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  const tremble = Math.round(Math.sin(t * 40) * 1);
  texte(g, 'SUPER COUP !', cx + tremble, cy - 44, pouls > 0.5 ? '#ffffff' : '#ff7a3c', 3, 'c');
  texte(
    g,
    defenseur
      ? 'ARRETE LE CURSEUR DANS LE VERT !'
      : moi === undefined
        ? 'PARADE EN COURS...'
        : 'IL TENTE DE PARER...',
    cx,
    cy - 22,
    defenseur ? C.or : C.gris,
    1,
    'c',
  );
  const w = Math.min(220, W - 40);
  dessineCurseur(g, {
    x: cx - w / 2,
    y: cy - 4,
    w,
    h: 18,
    valeur: curseurParade(p.t),
    ancienne: (dt) => curseurParade(p.t - dt),
    segments: SEGMENTS_PARADE,
    zone: [ZONE_PARADE.min, ZONE_PARADE.max],
    temps: t,
    intense: true,
  });
  if (defenseur) texte(g, 'APPUIE !', cx, cy + 34, pouls > 0.5 ? '#ffffff' : C.or, 2, 'c');
  // le temps qui reste (côté hôte et solo : la phase de l'écoulé n'est pas transmise aux invités)
  if (p.ecoule > 0) {
    const reste = Math.max(0, 1 - p.ecoule / PARADE_DUREE_MAX);
    px(g, cx - w / 2, cy + 24, w, 2, '#0f1328');
    px(g, cx - w / 2, cy + 24, Math.round(w * reste), 2, reste < 0.3 ? '#ff2a4a' : C.or);
  }
}
