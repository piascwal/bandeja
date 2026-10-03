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
  if ((vit > 13 || special) && jeu.phase !== 'service' && b.sol === 0) {
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

/** Ombre portée au sol, aplatie par la perspective. */
export function ombre(v: Vue, x: number, y: number, rx: number, a: number): void {
  const [sx, sy] = v.K.proj(x, clamp(y, 0, LARG), 0);
  v.g.fillStyle = `rgba(4,10,40,${a})`;
  v.g.fillRect(Math.round(sx - rx), Math.round(sy), rx * 2 + 1, 1);
  v.g.fillRect(Math.round(sx - rx + 1), Math.round(sy) - 1, rx * 2 - 1, 3);
}
