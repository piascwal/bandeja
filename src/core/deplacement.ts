import { clamp } from './aleatoire';
import { BONUS_HUMAIN, LARG, LONG, MIL, VMAX } from './constants';
import { dir } from './terrain';
import type { Joueur, Partie, Point2 } from './types';

/** Arcade : un humain court plus vite que le CPU, et ralentit à peine quand il arme un coup. */
const FREIN_ARME = 0.9;
const ECART_MIN = 0.7;
/** Joystick au repos en dessous de cette inclinaison : le joueur est guidé vers la balle. */
const REPOS = 0.2;

/** Vitesse pour rejoindre un point, qui ralentit à l'approche. */
function versPoint(s: Joueur, p: Point2, vmax: number): [number, number] {
  const dx = p.x - s.x;
  const dy = p.y - s.y;
  const d = Math.hypot(dx, dy);
  if (d <= 0.05) return [0, 0];
  const v = Math.min(vmax, d * 6);
  return [(dx / d) * v, (dy / d) * v];
}

/** Le point où il doit être pour frapper, s'il est celui qui va jouer la balle. */
function pointDeFrappe(jeu: Partie, s: Joueur): Point2 | null {
  if (jeu.phase !== 'jeu' || jeu.balle.camp !== s.eq) return null;
  const plan = jeu.plan[s.eq];
  return plan && plan.s === s ? { x: plan.x - dir(s.eq) * 0.3, y: plan.y } : null;
}

export function bouge(jeu: Partie, s: Joueur, dt: number): void {
  let dvx = 0;
  let dvy = 0;
  const vmax = VMAX * (s.humain ? BONUS_HUMAIN : s.niv.vit);
  const but = s.humain && jeu.phase !== 'service' ? pointDeFrappe(jeu, s) : null;
  if (s.humain && jeu.phase !== 'service') {
    const k = s.intent && s.intent.t > 0.15 ? FREIN_ARME : 1;
    dvx = s.ex * vmax * k;
    dvy = s.ey * vmax * k;
    if (but) {
      // le joueur qui va jouer la balle y est conduit ; le joystick ne décale qu'un peu (et sert à viser)
      const [gx, gy] = versPoint(s, but, vmax);
      const tenu = Math.hypot(s.ex, s.ey) >= REPOS;
      dvx = gx * (tenu ? 0.8 : 1) + (tenu ? dvx * 0.45 : 0);
      dvy = gy * (tenu ? 0.8 : 1) + (tenu ? dvy * 0.45 : 0);
    }
  } else {
    const [gx, gy] = versPoint(s, s.cible, vmax * (jeu.phase === 'service' ? 1.6 : 1));
    dvx = gx;
    dvy = gy;
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
