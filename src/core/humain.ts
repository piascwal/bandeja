import { alea, clamp } from './aleatoire';
import { HAUT_SMASH, LARG } from './constants';
import { executeCoup, frappable, PROF } from './coups';
import { jaugeVal, servir } from './service';
import { autre, dir, fond, xProf } from './terrain';
import type { Bouton, Commande, Coup, Joueur, Mur, Partie, TypeService } from './types';

/** Au padel on sert surtout coupé, parfois à plat : deux services, sur ✕ et □. */
export const TYPES_SERV: Partial<Record<Bouton, TypeService>> = { plat: 'plat', coupe: 'coupe' };

/** Plus on appuie tôt avant l'impact, plus le coup est puissant ; au-delà, l'appui est oublié. */
const DUREE_CHARGE = 0.75;
const OUBLI_APPUI = 1.6;
/** Portée un peu plus généreuse pour le joueur humain. */
export const BONUS_PORTEE = 1.15;

/** Applique au joueur humain ce qu'il demande pendant ce pas. */
export function appliqueCommande(jeu: Partie, s: Joueur, cmd: Commande, dt: number): void {
  // vue en miroir : x = 0 est à droite de l'écran de l'équipe 0
  s.ex = s.miroir ? -cmd.dx : cmd.dx;
  s.ey = cmd.dy;
  s.sprint = cmd.sprint;

  if (jeu.phase === 'service') {
    s.cible = s.posServ;
    if (s !== jeu.serveur || !jeu.pret) return;
    for (const a of cmd.appuis) {
      if (!jeu.jauge) {
        const type = TYPES_SERV[a];
        if (!type) continue;
        jeu.jauge = { type, t: 0 };
        jeu.evenements.push({ type: 'jaugeLancee' });
      } else if (jeu.jauge.t > 0.12) {
        servir(jeu, s, jeu.jauge.type, jaugeVal(jeu.jauge.t), viseServ(s));
        break;
      }
    }
    return;
  }
  if (jeu.phase !== 'jeu') {
    s.intent = null;
    s.charge = 0;
    return;
  }
  // on peut appuyer en avance : le coup part dès que la balle est à portée,
  // et plus on a appuyé tôt, plus il est puissant
  for (const a of cmd.appuis) {
    if (s.intent) s.intent.type = a;
    else {
      s.intent = { type: a, t: 0 };
      s.charge = 0;
    }
  }
  if (s.intent) {
    s.intent.t += dt;
    s.charge = Math.min(1, s.charge + dt / DUREE_CHARGE);
    if (s.intent.t > OUBLI_APPUI) {
      s.intent = null;
      s.charge = 0;
    }
  }
  if (s.intent && frappable(jeu, s, BONUS_PORTEE)) coupHumain(jeu, s);
}

/** Visée du service avec le joystick : -1 au centre, +1 vers la vitre. */
export const viseServ = (s: Joueur): number => clamp(s.ey * (s.y > 5 ? -1 : 1), -1, 1);

/**
 * Direction du joystick au moment de l'impact (dans le repère de la piste) :
 * vers le filet ou au neutre : coup direct ; vers sa vitre du fond : rebond
 * contre le fond ; en arrière et vers le haut / le bas : rebond contre la
 * vitre de côté.
 */
export function modeTir(s: Joueur): Mur | null {
  const av = s.ex * dir(s.eq);
  if (av > -0.35) return null;
  // les vitres de côté ne couvrent que les 4 m près du fond : au-delà c'est du grillage
  const recul = Math.abs(s.x - fond(s.eq));
  if (recul >= 4.5) return null;
  if (Math.abs(s.ey) > 0.5) return s.ey < 0 ? 'haut' : 'bas';
  return 'fond';
}

function coupHumain(jeu: Partie, s: Joueur): void {
  const b = jeu.balle;
  const eq = s.eq;
  const haut = b.z > HAUT_SMASH;
  let type: Coup | 'aerien' = s.intent!.type;
  const av = s.ex * dir(eq); // > 0 : vers le filet
  const p = 0.25 + 0.75 * s.charge;
  const mur = haut ? null : modeTir(s);
  if (mur) {
    const ty = clamp(LARG - s.y, 1.5, 8.5);
    const t: Coup = type === 'aerien' ? 'coupe' : type;
    executeCoup(jeu, s, mur === 'fond' ? 'vitre' : t, p, xProf(autre(eq), PROF[t] ?? 3), ty, mur);
    return;
  }
  // balle haute : ✕ reste la frappe puissante, le bouton du centre la bandeja ou,
  // joystick vers le haut ou le bas (vers une vitre de côté), la víbora
  if (type === 'aerien') type = haut ? (Math.abs(s.ey) > 0.4 ? 'vibora' : 'bandeja') : 'coupe';
  else if (haut && type === 'plat') type = 'smash';
  let m = PROF[type] ?? 3;
  if (av > 0.3) m -= type === 'amorti' ? -av * 0.6 : av * 1.2;
  let ty: number;
  if (Math.abs(s.ey) > 0.3) ty = 5 + s.ey * 3.9;
  else ty = clamp(LARG - s.y, 1.4, 8.6) + alea(jeu.rng, -0.6, 0.6); // croisé par défaut
  if (type === 'vibora') ty = s.ey > 0.3 ? 8.9 : s.ey < -0.3 ? 1.1 : ty < 5 ? 1.1 : 8.9;
  executeCoup(jeu, s, type, p, xProf(autre(eq), m), clamp(ty, 0.3, LARG - 0.3));
}

/** Balle haute à jouer près du joueur humain : le bouton aérien apparaît. */
export function balleHaute(jeu: Partie): boolean {
  const hum = jeu.humain;
  const b = jeu.balle;
  if (!hum || jeu.phase !== 'jeu') return false;
  return b.camp === hum.eq && b.z > HAUT_SMASH && Math.hypot(b.x - hum.x, b.y - hum.y) < 3.5;
}

/** Le coup aérien proposé : víbora si le joystick pointe vers une vitre de côté. */
export const coupAerien = (s: Joueur): 'vibora' | 'bandeja' => (Math.abs(s.ey) > 0.4 ? 'vibora' : 'bandeja');
