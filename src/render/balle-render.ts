import { clamp } from '@core/aleatoire';
import { LARG } from '@core/constants';
import type { Partie } from '@core/types';
import { C, TRAINEES } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/** La balle et sa traînée : violette qui ondule pour la víbora, plateau doré pour la bandeja. */
export function dessineBalle(v: Vue, jeu: Partie): void {
  const { g, K } = v;
  const b = jeu.balle;
  const [sx, sy] = K.proj(b.x, b.y, b.z);
  const vit = Math.hypot(b.vx, b.vy, b.vz);
  const special = b.coup ? TRAINEES[b.coup] : undefined;
  // un coup très fort laisse une traînée de feu, même après le rebond : plus il est rapide, plus elle est vive
  const feu = clamp((vit - 16) / 12, 0, 1);
  if (feu > 0 && jeu.phase !== 'service' && b.coup !== 'vibora' && b.coup !== 'bandeja') {
    const n = b.trace.length;
    b.trace.forEach(([mx, my, mz], i) => {
      const [tx, ty] = K.proj(mx, my, mz);
      const t = (i + 1) / n;
      g.globalAlpha = 0.35 + 0.6 * t;
      const taille = t > 0.7 && feu > 0.5 ? 3 : 2;
      px(g, tx - 1, ty - 1, taille, taille, t < 0.35 ? '#ff3b1f' : t < 0.75 ? '#ff8a3c' : '#ffe27a');
      if (feu > 0.6 && i % 3 === 0)
        px(g, tx + Math.round(bruitVisuel(i, jeu.temps)), ty - 2, 1, 1, '#fff2b0');
    });
    g.globalAlpha = 1;
  } else if ((vit > 13 || special) && jeu.phase !== 'service' && b.sol === 0) {
    b.trace.forEach(([mx, my, mz], i) => {
      const [tx, ty] = K.proj(mx, my, mz);
      g.globalAlpha = ((i + 1) / b.trace.length) * (special ? 0.8 : 0.45);
      if (b.coup === 'vibora') {
        const o = Math.round(Math.sin(i * 1.7 + jeu.temps * 25) * 2);
        px(g, tx - 1, ty - 1 + o, 2, 2, TRAINEES.vibora!);
      } else if (b.coup === 'bandeja') {
        px(g, tx - 2, ty - 1, 4, 1, TRAINEES.bandeja!);
        px(g, tx - 1, ty, 2, 1, '#fff2b0');
      } else px(g, tx - 1, ty - 1, 2, 2, special ?? C.balle);
    });
    g.globalAlpha = 1;
  }
  const x = Math.round(sx);
  const y = Math.round(sy);
  px(g, x - 2, y - 1, 4, 2, C.contour);
  px(g, x - 1, y - 2, 2, 4, C.contour);
  px(g, x - 1, y - 1, 2, 2, C.balle);
  px(g, x - 1, y - 1, 1, 1, '#f8ffc0');
}

/** Petit décalage vif et reproductible pour les étincelles de la traînée. */
const bruitVisuel = (i: number, t: number): number => Math.sin(i * 12.9 + Math.floor(t * 30) * 7.1) * 2;

/** Ombre portée au sol, aplatie par la perspective. */
export function ombre(v: Vue, x: number, y: number, rx: number, a: number): void {
  const [sx, sy] = v.K.proj(x, clamp(y, 0, LARG), 0);
  v.g.fillStyle = `rgba(4,10,40,${a})`;
  v.g.fillRect(Math.round(sx - rx), Math.round(sy), rx * 2 + 1, 1);
  v.g.fillRect(Math.round(sx - rx + 1), Math.round(sy) - 1, rx * 2 - 1, 3);
}
