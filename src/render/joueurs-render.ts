import { HAUT_SMASH } from '@core/constants';
import type { Joueur, Partie } from '@core/types';
import { ECH_SPR, POSES, type Pose, type SpritesEquipe } from './sprites';
import type { Vue } from './vue';

/** Coup droit ou revers selon le côté de la balle. */
const coteCoup = (jeu: Partie, s: Joueur): Pose => (jeu.balle.y >= s.y === s.regard > 0 ? 'droit' : 'revers');

/** La pose à afficher : coup en cours, préparation, course ou attente. */
export function poseJoueur(jeu: Partie, s: Joueur): Pose {
  const b = jeu.balle;
  if (s.swing > 0) return s.poseCoup;
  if (jeu.phase === 'service' && jeu.serveur === s && jeu.jauge) return 'droit';
  const dist = Math.hypot(b.x - s.x, b.y - s.y);
  const plan = jeu.plan[s.eq];
  const prepare =
    jeu.phase === 'jeu' && b.camp === s.eq && (s.intent || (plan && plan.s === s && dist < 2.6));
  if (prepare) return b.z > HAUT_SMASH && dist < 3 ? 'smash1' : coteCoup(jeu, s);
  // la course n'apparaît que pour un vrai déplacement rapide (avec hystérésis,
  // pour ne pas clignoter) ; les petits pas restent en attente
  const v = Math.hypot(s.vx, s.vy);
  if (s.court ? v < 1.8 : v > 2.8) s.court = !s.court;
  return s.court ? 'course' : 'attente';
}

export function dessineJoueur(v: Vue, jeu: Partie, s: Joueur, sprites: SpritesEquipe): void {
  const [sx, sy] = v.K.proj(s.x, s.y, 0);
  const vit = Math.hypot(s.vx, s.vy);
  const f = s.regard || -s.face;
  const nom = poseJoueur(jeu, s);
  const P = POSES[nom];
  const e = ECH_SPR * P.ech;
  const ancre = f > 0 ? P.tete : P.w - P.tete;
  // petits pas : un léger rebond, même dans la pose d'attente
  const bob = vit > 0.6 && s.swing <= 0 ? (Math.floor(s.pas * 2.6) & 1) * 0.7 : 0;
  const img = sprites[nom][f > 0 ? 0 : 1];
  v.g.drawImage(img, sx - ancre * e, sy - (P.pied.y + 1) * e - bob, P.w * e, P.h * e);
}
