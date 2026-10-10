import { clamp } from '@core/aleatoire';
import { LARG } from '@core/constants';
import { accelerationEchange } from '@core/coups';
import type { Partie } from '@core/types';
import { C, TRAINEES } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/** Les trois super coups : couleurs de la traînée (queue, milieu, tête), épaisseur et couleur du halo. */
const STYLES_SUPER: Record<number, { couleurs: [string, string, string]; taille: number; halo: string }> = {
  1: { couleurs: ['#c81e0a', '#ff6a1f', '#fff2b0'], taille: 6, halo: '#ff6a2a' }, // météore : boule de feu
  2: { couleurs: ['#5a0800', '#ff3b12', '#ffd27a'], taille: 6, halo: '#ff3b12' }, // volcan : lave
  3: { couleurs: ['#2a2fb0', '#9ab8ff', '#ffffff'], taille: 5, halo: '#9ab8ff' }, // orbite : feu bleu pâle
};

/**
 * La traînée d'un super coup : une longue queue de feu (large couche sombre,
 * cœur vif, étincelles qui s'échappent).
 */
function traineeSuper(v: Vue, jeu: Partie, variante: number): void {
  const style = STYLES_SUPER[variante]!;
  const { g, K } = v;
  const b = jeu.balle;
  const n = b.trace.length;
  b.trace.forEach(([mx, my, mz], i) => {
    const [px0, py0] = K.proj(mx, my, mz);
    const t = (i + 1) / n;
    const tx = px0;
    const ty = py0 + Math.round(Math.sin(i * 1.3 + jeu.temps * 30) * 1.2);
    const c = t < 0.4 ? style.couleurs[0] : t < 0.8 ? style.couleurs[1] : style.couleurs[2];
    const taille = Math.max(2, Math.round(style.taille * (0.35 + 0.65 * t)));
    // couche large et sombre, puis le cœur de la flamme
    g.globalAlpha = 0.3 * t;
    px(g, tx - taille, ty - taille, taille * 2, taille * 2, style.couleurs[0]);
    g.globalAlpha = 0.45 + 0.5 * t;
    px(g, tx - taille / 2, ty - taille / 2, taille, taille, c);
    // étincelles qui s'échappent de la flamme
    if (i % 2 === 0) {
      g.globalAlpha = 1 - t;
      px(g, tx + Math.round(bruitVisuel(i, jeu.temps) * 2), ty - 2 - (i % 4), 1, 1, '#ffffff');
    }
  });
  g.globalAlpha = 1;
}

/** La balle et sa traînée : violette qui ondule pour la víbora, plateau doré pour la bandeja, feu quand elle accélère. */
export function dessineBalle(v: Vue, jeu: Partie): void {
  const { g, K } = v;
  const b = jeu.balle;
  // le volcan a perforé le court : la balle est sous terre
  if (b.super === 2 && b.dehors) return;
  const [sx, sy] = K.proj(b.x, b.y, b.z);
  const vit = Math.hypot(b.vx, b.vy, b.vz);
  const special = b.coup ? TRAINEES[b.coup] : undefined;
  // la vitesse gagnée au fil de l'échange se voit : halo qui grandit et chauffe, traînée plus tôt
  const facteur = accelerationEchange(jeu.echange);
  const feu = Math.max(clamp((vit - 16) / 12, 0, 1), clamp((facteur - 1.15) / 0.6, 0, 1));
  const variante = b.super;
  if (variante > 0 && jeu.phase !== 'service') traineeSuper(v, jeu, variante);
  else if (feu > 0 && jeu.phase !== 'service' && b.coup !== 'vibora' && b.coup !== 'bandeja') {
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
  if (facteur >= 1.2 && jeu.phase === 'jeu' && !variante) {
    const t = clamp((facteur - 1.2) / 0.7, 0, 1);
    g.globalAlpha = 0.3 + 0.3 * t;
    const r = 3 + Math.round(3 * t);
    px(g, x - r, y - r + 1, r * 2, r * 2 - 2, t < 0.35 ? '#ffe27a' : t < 0.7 ? '#ff8a3c' : '#ff3b1f');
    g.globalAlpha = 1;
  }
  if (variante > 0 && jeu.phase !== 'service') {
    // halo qui bat, de la couleur du super coup
    const style = STYLES_SUPER[variante]!;
    g.globalAlpha = 0.35 + 0.25 * Math.sin(jeu.temps * 40);
    px(g, x - 5, y - 4, 10, 8, style.halo);
    px(g, x - 4, y - 5, 8, 10, '#ffffff');
    g.globalAlpha = 1;
  }
  px(g, x - 2, y - 1, 4, 2, C.contour);
  px(g, x - 1, y - 2, 2, 4, C.contour);
  px(g, x - 1, y - 1, 2, 2, C.balle);
  px(g, x - 1, y - 1, 1, 1, '#f8ffc0');
  g.globalAlpha = 1;
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
