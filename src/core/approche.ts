import { clamp } from './aleatoire';
import { BONUS_HUMAIN, HAUT_MAX, LARG, LONG, MIL, VMAX } from './constants';
import { executeCoup } from './coups';
import { cibleCoup } from './humain';
import { varianteSuper } from './super-coup';
import type { Joueur, Partie } from './types';

/**
 * L'approche du super coup : dès que la balle est dans notre camp, un appui sur SUPER
 * fige la scène (balle, adversaires, partenaire) ; seul le joueur qui l'a demandé fonce
 * vers la balle et s'envole pour se trouver à son niveau, puis lance le super coup. Le
 * jeu reprend ensuite par la parade de l'adversaire.
 */
const COURSE = 4.2;
/** Hauteur de la raquette d'un joueur debout (m) : au-dessus, il saute. */
const HAUT_RAQUETTE = 1.5;
/** Au plus ce temps (s) pour arriver ; au-delà l'approche est abandonnée (la jauge reste pleine). */
const DUREE_MAX = 1.3;
const ECART_FILET = 0.8;
/** Distance (m) à la balle à laquelle le joueur est « arrivé ». */
const ARRIVEE = 0.25;

/** Le super coup peut-il partir en approche ? Balle à jouer dans notre camp, encore jouable (deux rebonds au plus, pas trop haut). */
export function peutApprocher(jeu: Partie, s: Joueur): boolean {
  const b = jeu.balle;
  return (
    jeu.phase === 'jeu' &&
    !jeu.parade &&
    !jeu.approche &&
    jeu.jaugeSmash[s.eq] >= 1 &&
    b.camp === s.eq &&
    b.sol < 2 &&
    !b.dehors &&
    !b.roule &&
    b.super === 0 &&
    b.z <= HAUT_MAX + HAUT_RAQUETTE
  );
}

export function lanceApproche(jeu: Partie, s: Joueur): void {
  jeu.approche = { id: s.id, t: 0 };
  s.intent = null;
  s.charge = 0;
  s.vx = 0;
  s.vy = 0;
}

function annule(jeu: Partie, s: Joueur): void {
  jeu.approche = null;
  s.swing = 0;
  s.haut = false;
}

/** Un pas d'approche : tout est figé, sauf le joueur qui court vers la balle puis la frappe. */
export function avanceApproche(jeu: Partie, dt: number): void {
  const a = jeu.approche;
  if (!a) return;
  const s = jeu.joueurs[a.id]!;
  const b = jeu.balle;
  a.t += dt;
  if (jeu.phase !== 'jeu' || b.dehors || b.sol >= 2 || a.t > DUREE_MAX) {
    annule(jeu, s);
    return;
  }
  // le point sous la balle, dans notre moitié de terrain
  const cx = clamp(b.x, s.eq === 0 ? 0.25 : MIL + ECART_FILET, s.eq === 0 ? MIL - ECART_FILET : LONG - 0.25);
  const cy = clamp(b.y, 0.25, LARG - 0.25);
  const dx = cx - s.x;
  const dy = cy - s.y;
  const d = Math.hypot(dx, dy);
  const vit = VMAX * BONUS_HUMAIN * COURSE;
  const pas = Math.min(d, vit * dt);
  if (d > 1e-6) {
    s.x += (dx / d) * pas;
    s.y += (dy / d) * pas;
  }
  s.vx = d > ARRIVEE ? (dx / d) * vit : 0;
  s.vy = d > ARRIVEE ? (dy / d) * vit : 0;
  s.pas += pas;
  // il s'envole pour arriver à la hauteur de la balle en même temps qu'à sa verticale
  const cible = Math.max(0, b.z - HAUT_RAQUETTE);
  s.saut += (cible - s.saut) * Math.min(1, dt * 16);
  s.haut = true;
  s.poseCoup = 'smash2';
  s.swing = 0.35;
  if (d <= ARRIVEE && Math.abs(s.saut - cible) < 0.12) {
    jeu.approche = null;
    s.cd = 0;
    const { tx, ty } = cibleCoup(s, 'smash');
    executeCoup(jeu, s, 'smash', 1, tx, ty, null, {
      precision: 1,
      intention: 'smash',
      charge: 1,
      super: varianteSuper(b, Math.abs(s.x - MIL), jeu.rng),
    });
  }
}
