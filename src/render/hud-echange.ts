import { ACCEL_MAX } from '@core/constants';
import { accelerationEchange } from '@core/coups';
import type { Partie } from '@core/types';
import { C } from './palette';
import { texte } from './police';
import { px } from './primitives';
import type { Vue } from './vue';

/** Couleur du compteur d'échange : il chauffe avec la vitesse de la balle. */
function couleurEchange(n: number): string {
  if (n >= 18) return '#ff3b1f';
  if (n >= 12) return '#ff8a3c';
  if (n >= 6) return C.or;
  return C.blanc;
}

/** Un mélange de deux couleurs #rrggbb. */
function melange(a: string, b: string, k: number): string {
  const x = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const m = (i: number) => Math.round(x(a, i) + (x(b, i) - x(a, i)) * k);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

/** Une étoile de 5 px, au bout de la jauge pleine. */
function etoile(g: CanvasRenderingContext2D, x: number, y: number, c: string): void {
  px(g, x + 2, y, 1, 5, c);
  px(g, x, y + 2, 5, 1, c);
  px(g, x + 1, y + 1, 3, 3, c);
}

/**
 * La jauge du super coup d'une équipe : un dégradé qui scintille en se
 * remplissant, des graduations, un halo qui bat dès 75 %, et pleine, un cadre
 * doré qui flashe, des rayons, une étoile et un « SUPER ! » qui rebondit.
 */
function jaugeSuper(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  k: number,
  t: number,
  gauche: boolean,
): void {
  const pleine = k >= 1;
  const h = 7;
  const battement = 0.5 + 0.5 * Math.sin(t * (pleine ? 14 : 8));
  if (k >= 0.75) {
    g.globalAlpha = (pleine ? 0.7 : 0.35) * battement + 0.15;
    px(g, x - 3, y - 3, w + 6, h + 6, pleine ? '#ffd35c' : '#7fe9ff');
    g.globalAlpha = 1;
  }
  px(g, x - 1, y - 1, w + 2, h + 2, pleine && battement > 0.5 ? '#ffffff' : C.contour);
  px(g, x, y, w, h, '#0f1328');
  const rempli = Math.round(w * Math.min(1, k));
  for (let i = 0; i < rempli; i++) {
    // le remplissage part du bord extérieur, comme le tableau des scores
    const cx = gauche ? x + i : x + w - 1 - i;
    px(g, cx, y + 1, 1, h - 2, melange('#2fd0c6', pleine ? '#ffd35c' : '#ffb02e', i / w));
  }
  // un reflet qui parcourt la jauge
  if (rempli > 3) {
    const r = Math.floor((t * 24) % rempli);
    g.globalAlpha = 0.7;
    px(g, gauche ? x + r : x + w - 1 - r, y + 1, 1, h - 2, '#ffffff');
    g.globalAlpha = 1;
  }
  for (const f of [0.25, 0.5, 0.75]) px(g, Math.round(x + w * f), y, 1, h, 'rgba(7,9,20,0.6)');
  if (!pleine) {
    texte(g, 'SUPER', x + w / 2, y + h + 3, k >= 0.75 ? C.or : C.gris, 1, 'c');
    return;
  }
  // pleine : rayons, étoile, texte qui rebondit
  for (let i = 0; i < 6; i++) {
    const a = t * 3 + i * 1.05;
    px(g, x + w / 2 + Math.cos(a) * (w / 2 + 3), y + h / 2 + Math.sin(a) * 6, 1, 1, '#ffffff');
  }
  etoile(g, gauche ? x - 8 : x + w + 3, y + 1, battement > 0.5 ? '#ffffff' : C.or);
  texte(
    g,
    'SUPER !',
    x + w / 2,
    y + h + 3 + Math.round(Math.sin(t * 10)),
    battement > 0.5 ? '#ffffff' : C.or,
    1,
    'c',
  );
}

/**
 * Sous le tableau des scores : la jauge du super coup de chaque équipe (équipe 1
 * à gauche, comme le tableau), et au centre le compteur d'échange.
 */
export function dessineEchange(v: Vue, jeu: Partie): void {
  const { g, W } = v;
  const cx = Math.round(W / 2);
  const y = 24;
  // les jauges de super coup : de part et d'autre du tableau des scores, à hauteur des équipes
  const wj = 52;
  jaugeSuper(g, cx - 84 - 14 - wj, 5, wj, jeu.jaugeSmash[1], jeu.temps, true);
  jaugeSuper(g, cx + 84 + 14, 5, wj, jeu.jaugeSmash[0], jeu.temps, false);
  // le compteur d'échange, au centre : le nombre de coups, puis la vitesse de la balle (×1,0 au service, jusqu'à ×1,9)
  if (jeu.phase !== 'jeu' || jeu.echange < 3) return;
  const facteur = accelerationEchange(jeu.echange);
  const niveau = (facteur - 1) / ACCEL_MAX;
  const couleur = couleurEchange(jeu.echange);
  const pulse = jeu.echange >= 12 && Math.floor(jeu.temps * 8) % 2 === 0;
  texte(g, `ECHANGE ${jeu.echange}`, cx, y - 1, pulse ? '#ffffff' : couleur, 1, 'c');
  if (niveau <= 0) return;
  texte(g, `VITESSE X${facteur.toFixed(1)}`, cx, y + 8, couleur, 1, 'c');
  const w = 66;
  px(g, cx - w / 2 - 1, y + 17, w + 2, 4, C.contour);
  px(g, cx - w / 2, y + 18, w, 2, '#0f1328');
  px(g, cx - w / 2, y + 18, Math.round(w * niveau), 2, couleur);
}
