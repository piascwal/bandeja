import { clamp } from '@core/aleatoire';
import { LARG } from '@core/constants';
import { accelerationEchange } from '@core/coups';
import type { Partie } from '@core/types';
import { C, TRAINEES } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/** Les quatre super coups : couleurs de la traînée (queue, milieu, tête), taille et couleur du halo. */
const STYLES_SUPER: Record<number, { couleurs: [string, string, string]; taille: number; halo: string }> = {
  1: { couleurs: ['#ff3b1f', '#ff8a3c', '#fff2b0'], taille: 4, halo: '#ff6a2a' }, // météore : boule de feu
  2: { couleurs: ['#2f6bff', '#7fe9ff', '#ffffff'], taille: 3, halo: '#5fd0ff' }, // comète : filante bleue et blanche
  3: { couleurs: ['#ff3dd0', '#ffb02e', '#fff2b0'], taille: 3, halo: '#ffd35c' }, // phénix : or et magenta, des ailes
  4: { couleurs: ['#6a4cff', '#c9a6ff', '#ffffff'], taille: 3, halo: '#c9a6ff' }, // fantôme : lilas, qui clignote
};

/** La traînée d'un super coup : épaisse, colorée, avec des étincelles ; le phénix ajoute des ailes. */
function traineeSuper(v: Vue, jeu: Partie, variante: number): void {
  const style = STYLES_SUPER[variante]!;
  const { g, K } = v;
  const b = jeu.balle;
  const n = b.trace.length;
  b.trace.forEach(([mx, my, mz], i) => {
    const [tx, ty] = K.proj(mx, my, mz);
    const t = (i + 1) / n;
    g.globalAlpha = (variante === 4 ? 0.25 : 0.4) + 0.55 * t * (variante === 4 && i % 2 ? 0.5 : 1);
    const c = t < 0.35 ? style.couleurs[0] : t < 0.75 ? style.couleurs[1] : style.couleurs[2];
    const taille = Math.max(2, Math.round(style.taille * (0.5 + 0.5 * t)));
    px(g, tx - taille / 2, ty - taille / 2, taille, taille, c);
    if (i % 2 === 0) px(g, tx + Math.round(bruitVisuel(i, jeu.temps)), ty - 2 + (i % 3), 1, 1, '#ffffff');
    if (variante === 3 && i % 3 === 0) {
      // les ailes du phénix
      px(g, tx - 4 - (i % 2), ty - 2, 2, 1, style.couleurs[1]);
      px(g, tx + 3 + (i % 2), ty - 2, 2, 1, style.couleurs[1]);
    }
  });
  g.globalAlpha = 1;
}

/** La balle et sa traînée : violette qui ondule pour la víbora, plateau doré pour la bandeja, feu quand elle accélère. */
export function dessineBalle(v: Vue, jeu: Partie): void {
  const { g, K } = v;
  const b = jeu.balle;
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
    // le fantôme clignote
    if (variante === 4 && Math.floor(jeu.temps * 20) % 2 === 0) g.globalAlpha = 0.45;
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
