import { clamp } from './aleatoire';
import { LARG, LONG, MIL, VMAX } from './constants';
import type { Joueur, Partie } from './types';

/** Le joueur humain se plante pour armer, et court plus vite avec le bouton COURIR. */
const FREIN_ARME = 0.55;
const BONUS_SPRINT = 1.4;
const ECART_MIN = 0.7;

export function bouge(jeu: Partie, s: Joueur, dt: number): void {
  let dvx = 0;
  let dvy = 0;
  const vmax = VMAX * (s.humain ? 1 : s.niv.vit);
  if (s.humain && jeu.phase !== 'service') {
    let k = s.intent && s.intent.t > 0.15 ? FREIN_ARME : 1;
    if (s.sprint) k *= BONUS_SPRINT;
    dvx = s.ex * vmax * k;
    dvy = s.ey * vmax * k;
  } else {
    const dx = s.cible.x - s.x;
    const dy = s.cible.y - s.y;
    const d = Math.hypot(dx, dy);
    const v = Math.min(vmax * (jeu.phase === 'service' ? 1.6 : 1), d * 6);
    if (d > 0.05) {
      dvx = (dx / d) * v;
      dvy = (dy / d) * v;
    }
  }
  const f = Math.min(1, dt * 12);
  s.vx += (dvx - s.vx) * f;
  s.vy += (dvy - s.vy) * f;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  if (s.eq === 0) s.x = clamp(s.x, 0.25, MIL - 0.3);
  else s.x = clamp(s.x, MIL + 0.3, LONG - 0.25);
  s.y = clamp(s.y, 0.25, LARG - 0.25);
  s.pas += Math.hypot(s.vx, s.vy) * dt;
  s.swing = Math.max(0, s.swing - dt / 0.32);
  s.tourne = Math.max(0, s.tourne - dt);
  s.cd -= dt;
}

/** Deux partenaires ne se marchent pas dessus. */
export function separe(jeu: Partie): void {
  const js = jeu.joueurs;
  for (let i = 0; i < js.length; i++) {
    for (let j = i + 1; j < js.length; j++) {
      const a = js[i]!;
      const b = js[j]!;
      if (a.eq !== b.eq) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < ECART_MIN && d > 0.001) {
        const k = (ECART_MIN - d) / 2 / d;
        a.x -= dx * k;
        a.y -= dy * k;
        b.x += dx * k;
        b.y += dy * k;
      }
    }
  }
}

/**
 * Où regarde le joueur à l'écran (+1 : à droite). Pendant l'échange, c'est la
 * balle qui décide, sauf quand elle est au-dessus de lui ou juste derrière :
 * la pose de smash la couvre, inutile de se retourner. Hors échange, il
 * regarde là où il court, sinon le filet.
 */
export function majRegard(jeu: Partie, s: Joueur): void {
  const b = jeu.balle;
  if (s.tourne > 0) {
    s.regard = -s.faceCoup; // rebond voulu contre sa vitre
    return;
  }
  if (jeu.phase === 'jeu') {
    const dx = -(b.x - s.x); // en mètres, dans le sens de l'écran (vue en miroir)
    const proche = Math.hypot(b.x - s.x, b.y - s.y) < 1.6;
    const auDessus = proche && b.z > 1.6;
    const justeDerriere = Math.sign(dx) === -s.regard && Math.abs(dx) < 1;
    if (!auDessus && !justeDerriere && Math.abs(dx) > 0.15) s.regard = Math.sign(dx);
  } else {
    const vx = -s.vx;
    if (Math.abs(vx) > 0.8) s.regard = Math.sign(vx);
    else if (jeu.phase === 'service') s.regard = -s.face;
  }
}
