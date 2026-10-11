import { h } from './finale-outils';
import { texte } from './police';
import { px } from './primitives';

/**
 * Les petits personnages des scènes de Pise et du Sphinx : touristes et habitants
 * qui se promènent, prennent des photos, sursautent, montrent du doigt, retiennent la
 * tour... Dessinés en quelques pixels, les pieds en (x, y).
 */
export type Attitude = 'debout' | 'photo' | 'marche' | 'bras' | 'pointe' | 'retient' | 'court';

const PEAUX = ['#f0c8a0', '#d8a070', '#a86a40', '#7a4a2a'];
const HABITS = ['#ff5a5a', '#ffd23a', '#5ab0ff', '#ffffff', '#9a5aff', '#5ad87a', '#ff9a3a', '#2a3a8a'];

export function personnage(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  n: number,
  attitude: Attitude,
  t: number,
  sens: 1 | -1 = 1,
  e = 1,
): void {
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(e, e);
  dessinePersonnage(g, n, attitude, t, sens);
  g.restore();
}

/** Le personnage dans son repère : les pieds en (0, 0), à l'échelle 1. */
function dessinePersonnage(
  g: CanvasRenderingContext2D,
  n: number,
  attitude: Attitude,
  t: number,
  sens: 1 | -1,
): void {
  const x = 0;
  const y = 0;
  const peau = PEAUX[Math.floor(h(n + 900) * PEAUX.length)]!;
  const habit = HABITS[Math.floor(h(n + 910) * HABITS.length)]!;
  const chapeau = h(n + 920) < 0.4;
  const bouge = attitude === 'marche' || attitude === 'court';
  const pas = bouge ? Math.floor(t * (attitude === 'court' ? 14 : 7) + n) % 2 : 0;
  const saut = attitude === 'bras' ? Math.abs(Math.sin(t * 9 + n)) * 2 : 0;
  const yy = y - saut;
  px(g, x, yy - 12, 4, 4, peau); // la tête
  if (chapeau) px(g, x - 1, yy - 13, 6, 2, h(n + 930) < 0.5 ? '#f4efe2' : '#2a2a40');
  px(g, x, yy - 8, 4, 5, habit); // le corps
  px(g, x, yy - 3, 4, 1, '#3a3a5a');
  // les jambes, qui s'écartent quand il marche
  px(g, x + (pas ? -1 : 0), yy - 2, 1, 2, '#2a2a40');
  px(g, x + 3 + (pas ? 1 : 0), yy - 2, 1, 2, '#2a2a40');
  const avant = sens > 0 ? x + 4 : x - 1;
  switch (attitude) {
    case 'photo':
      px(g, sens > 0 ? x + 3 : x - 2, yy - 10, 3, 2, '#2a2a40'); // l'appareil devant les yeux
      if (Math.floor(t * 3 + n) % 4 === 0) px(g, sens > 0 ? x + 5 : x - 2, yy - 11, 1, 1, '#ffffff'); // le flash
      break;
    case 'bras':
      px(g, x - 1, yy - 14, 1, 6, peau);
      px(g, x + 4, yy - 14, 1, 6, peau);
      break;
    case 'pointe':
      px(g, avant, yy - 9, 1, 1, peau);
      px(g, avant + sens, yy - 10, 1, 1, peau);
      px(g, avant + sens * 2, yy - 11, 1, 1, peau);
      break;
    case 'retient':
      // la pose de toutes les photos de Pise : les bras tendus, paumes levées vers la tour
      for (let i = 0; i < 4; i++) px(g, avant + sens * i, yy - 8 - i, 1, 1, peau);
      break;
    default:
      px(g, x - 1, yy - 7, 1, 4, peau);
      px(g, x + 4, yy - 7, 1, 4, peau);
  }
}

/** Un « ! » qui clignote au-dessus d'une tête. */
export function surpris(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  n: number,
  e = 1,
): void {
  if (Math.floor(t * 5 + n) % 3 !== 0) texte(g, '!', x + 2 * e, y - 16 * e - 8, '#ffffff', 1, 'c');
}

/** Des pigeons (ou des ibis) : posés, puis qui s'envolent tous ensemble au moment du choc. */
export function oiseaux(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  nombre: number,
  envol: number,
  t: number,
): void {
  for (let i = 0; i < nombre; i++) {
    const ox = x + (h(i + 940) - 0.5) * 50;
    if (envol < 0) {
      px(g, ox, y - 2, 3, 2, '#8a8aa0');
      px(g, ox + (Math.floor(t * 2 + i) % 2 ? 2 : 0), y - 3, 1, 1, '#5a5a70');
      continue;
    }
    const d = envol * (60 + h(i + 950) * 80);
    const bx = ox + (h(i + 960) - 0.5) * d * 1.6;
    const by = y - 2 - d;
    const aile = Math.floor(t * 16 + i) % 2;
    px(g, bx - 2, by - aile, 2, 1, '#5a5a70');
    px(g, bx, by, 2, 1, '#8a8aa0');
    px(g, bx + 2, by - aile, 2, 1, '#5a5a70');
  }
}

/** Un chameau et son chamelier, qui avancent lentement. */
export function chameau(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  sens: 1 | -1,
  e = 1,
): void {
  const c = '#c08a4a';
  const pas = Math.floor(t * 4) % 2;
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(sens * e, e);
  px(g, -10, -14, 18, 7, c); // le corps
  px(g, -6, -18, 6, 4, c); // la bosse
  px(g, 6, -20, 3, 9, c); // le cou
  px(g, 6, -22, 7, 3, c); // la tête
  for (const [lx, d] of [
    [-9, pas],
    [-5, 1 - pas],
    [2, pas],
    [6, 1 - pas],
  ] as [number, number][])
    px(g, lx + d, -7, 2, 7, '#a87a3a');
  px(g, -7, -24, 4, 6, '#ffffff'); // le cavalier
  px(g, -7, -27, 4, 3, '#d8a070');
  px(g, -8, -28, 6, 1, '#ff5a5a');
  g.restore();
}
