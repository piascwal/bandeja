import { clamp } from './aleatoire';
import { BONUS_HUMAIN, LARG, LONG, MIL, SUPER_COURSE, VMAX } from './constants';
import { dir } from './terrain';
import type { Joueur, Partie, Point2 } from './types';

/** Un humain qui arme son coup trop tôt ralentit fort : il faut d'abord se placer, puis déclencher au bon moment. */
const FREIN_ARME = 0.45;
const ECART_MIN = 0.7;
/** Distance minimale au filet (m) : le dessin du joueur ne le dépasse pas. */
const ECART_FILET = 0.8;
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
  if (!jeu.aide || jeu.phase !== 'jeu' || jeu.balle.camp !== s.eq) return null;
  const plan = jeu.plan[s.eq];
  // la balle va rebondir sur une vitre : le joueur anticipe lui-même (se rapprocher du filet...), on ne le guide pas
  return plan && plan.s === s && !plan.vitre ? { x: plan.x - dir(s.eq) * 0.3, y: plan.y } : null;
}

export function bouge(jeu: Partie, s: Joueur, dt: number): void {
  let dvx = 0;
  let dvy = 0;
  const vmax = VMAX * (s.humain ? BONUS_HUMAIN : s.niv.vit);
  const but = s.humain && jeu.phase !== 'service' ? pointDeFrappe(jeu, s) : null;
  if (s.humain && s.auto > 0 && jeu.phase === 'jeu') {
    // super coup demandé : le joueur fonce vers la balle, sans plus rien demander au joystick
    const b = jeu.balle;
    const cible = {
      x: clamp(b.x, s.eq === 0 ? 0.25 : MIL + ECART_FILET, s.eq === 0 ? MIL - ECART_FILET : LONG - 0.25),
      y: clamp(b.y, 0.25, LARG - 0.25),
    };
    const [gx, gy] = versPoint(s, cible, vmax * SUPER_COURSE);
    dvx = gx;
    dvy = gy;
  } else if (s.humain && jeu.phase !== 'service') {
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
  // le sprite a de la largeur : on ne le laisse pas déborder sur le filet
  if (s.eq === 0) s.x = clamp(s.x, 0.25, MIL - ECART_FILET);
  else s.x = clamp(s.x, MIL + ECART_FILET, LONG - 0.25);
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
