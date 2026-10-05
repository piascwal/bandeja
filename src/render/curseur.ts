import { C } from './palette';
import { texte } from './police';
import { px } from './primitives';

export interface SegmentCurseur {
  a: number;
  b: number;
  c: string;
}

export interface OptionsCurseur {
  x: number;
  y: number;
  w: number;
  h: number;
  /** position du curseur (0 → 1) */
  valeur: number;
  /** où il était `dt` secondes plus tôt : sa traîne */
  ancienne: (dt: number) => number;
  segments: SegmentCurseur[];
  /** la zone à viser (le vert) */
  zone: [number, number];
  temps: number;
  titre?: string;
  /** vrai : la barre bat plus fort (parade d'un super coup) */
  intense?: boolean;
}

/** Un mélange de deux couleurs #rrggbb. */
function melange(a: string, b: string, k: number): string {
  const x = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const m = (i: number) => Math.round(x(a, i) + (x(b, i) - x(a, i)) * k);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

const eclaircit = (c: string) => (c.startsWith('#') ? melange(c, '#ffffff', 0.45) : c);
const assombrit = (c: string) => (c.startsWith('#') ? melange(c, '#000000', 0.45) : c);

/**
 * Un curseur qui balaie une barre colorée, à arrêter dans la zone verte : cadre en
 * relief, segments en dégradé, zone verte qui brille et scintille, curseur lumineux
 * avec sa traîne, et la barre entière qui s'embrase quand il passe dans le vert.
 * Sert au service et à la parade d'un super coup.
 */
export function dessineCurseur(g: CanvasRenderingContext2D, o: OptionsCurseur): void {
  const { x, y, w, h, temps } = o;
  const [z0, z1] = o.zone;
  const dansVert = o.valeur >= z0 && o.valeur <= z1;
  const pouls = 0.5 + 0.5 * Math.sin(temps * (o.intense ? 16 : 10));
  // halo vert derrière la zone, qui bat ; plus fort quand le curseur est dans le vert
  g.globalAlpha = (dansVert ? 0.55 : 0.18) + 0.2 * pouls;
  px(g, x + w * z0 - 5, y - 5, w * (z1 - z0) + 10, h + 10, '#3dff8a');
  g.globalAlpha = 1;
  // cadre en relief
  px(g, x - 3, y - 3, w + 6, h + 6, C.contour);
  px(g, x - 2, y - 2, w + 4, h + 4, dansVert ? '#ffffff' : '#2a3160');
  px(g, x - 1, y - 1, w + 2, h + 2, '#0f1328');
  for (const s of o.segments) {
    const sx = x + Math.round(s.a * w);
    const sw = Math.max(1, Math.round((s.b - s.a) * w));
    px(g, sx, y, sw, h, s.c);
    px(g, sx, y, sw, Math.max(1, Math.floor(h * 0.3)), eclaircit(s.c)); // reflet du haut
    px(
      g,
      sx,
      y + h - Math.max(1, Math.floor(h * 0.25)),
      sw,
      Math.max(1, Math.floor(h * 0.25)),
      assombrit(s.c),
    );
  }
  // la zone verte scintille : des éclats qui la parcourent
  const zx = Math.round(x + w * z0);
  const zw = Math.round(w * (z1 - z0));
  for (let k = 0; k < 4; k++) {
    const p = (temps * (1.6 + k * 0.4) + k * 0.27) % 1;
    g.globalAlpha = 0.9 * (1 - Math.abs(p - 0.5) * 2);
    px(g, zx + p * zw, y + 1 + ((k * 3) % Math.max(1, h - 3)), 2, 2, '#ffffff');
  }
  g.globalAlpha = 1;
  px(g, zx - 1, y - 1, 1, h + 2, '#b5ffd0');
  px(g, zx + zw, y - 1, 1, h + 2, '#b5ffd0');
  for (let t = 1; t < 10; t++) px(g, x + Math.round((t / 10) * w), y + h - 2, 1, 2, 'rgba(7,9,20,0.55)');
  // la traîne du curseur, puis le curseur : un faisceau blanc avec des pointes
  for (let k = 5; k >= 1; k--) {
    const vx = x + Math.round(o.ancienne(k * 0.03) * w);
    g.globalAlpha = 0.5 / k;
    px(g, vx - 1, y - 2, 3, h + 4, '#ffffff');
  }
  g.globalAlpha = 0.3 + 0.2 * pouls;
  px(g, x + o.valeur * w - 3, y - 7, 7, h + 14, '#ffffff');
  g.globalAlpha = 1;
  const cx = Math.round(x + o.valeur * w);
  px(g, cx - 2, y - 5, 5, h + 10, C.contour);
  px(g, cx - 1, y - 4, 3, h + 8, dansVert ? '#b5ffd0' : '#ffffff');
  for (let i = 0; i < 3; i++) {
    px(g, cx - 3 + i, y - 8 + i, 7 - 2 * i, 1, '#ffffff'); // pointe du haut
    px(g, cx - 3 + i, y + h + 7 - i, 7 - 2 * i, 1, '#ffffff'); // pointe du bas
  }
  if (o.titre) texte(g, o.titre, x + w / 2, y - 16, dansVert ? '#b5ffd0' : C.or, 1, 'c');
  // « PARFAIT » au-dessus du vert
  texte(g, 'PARFAIT', zx + zw / 2, y + h + 6, pouls > 0.5 ? '#b5ffd0' : '#3dff8a', 1, 'c');
}
