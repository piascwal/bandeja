import { alea, clamp } from './aleatoire';
import { HAUT_SMASH, LARG, MIL } from './constants';
import { contrainte, executeCoup, frappable, PROF } from './coups';
import { jaugeVal, servir } from './service';
import { autre, dir, xProf } from './terrain';
import type { Bouton, Commande, Coup, Joueur, Partie, TypeService } from './types';

/** Au padel on sert surtout coupé, parfois à plat : deux services, sur FRAPPE et sur le bouton de gauche. */
export const TYPES_SERV: Partial<Record<Bouton, TypeService>> = { plat: 'plat', amorti: 'coupe' };

/** Plus on appuie tôt avant l'impact, plus le coup est puissant (durée de la charge, s). */
const DUREE_CHARGE = 0.6;
/** Un appui reste en attente de la balle ce temps-là : le coup part tout seul dès qu'elle est à portée. */
const OUBLI_APPUI = 1.2;
/** Portée généreuse pour un humain : on réussit presque toujours à toucher la balle. */
export const BONUS_PORTEE = 1.3;
/** Après le relâchement du joystick, sa dernière direction compte encore ce temps-là (s). */
const MEMOIRE_VISEE = 0.4;
/** Le joystick est « tenu » au-delà de cette inclinaison. */
const SEUIL_VISEE = 0.3;
/** Jauge pleine : au-delà, et bien placé, c'est un super coup. */
export const SUPER_CHARGE = 0.98;
/** À partir de cette charge, le coup attend le meilleur moment (balle proche) au lieu de partir au bord de la portée. */
const CHARGE_ATTENTE = 0.5;
/** Distance (m) à la balle à partir de laquelle le coup est jugé « bien placé ». */
const DISTANCE_IDEALE = 0.6;
/** Distance de contact de référence pour juger le timing (m). */
const PORTEE_CONTACT = 1.15;
/** Précision minimale du contact pour un super coup (la balle est à moins de ~0,75 m). */
const PRECISION_SUPER = 0.5;

/** Applique au joueur humain ce qu'il demande pendant ce pas. */
export function appliqueCommande(jeu: Partie, s: Joueur, cmd: Commande, dt: number): void {
  // vue en miroir : x = 0 est à droite de l'écran de l'équipe 0
  s.ex = s.miroir ? -cmd.dx : cmd.dx;
  s.ey = cmd.dy;
  if (Math.hypot(s.ex, s.ey) > SEUIL_VISEE) {
    s.visee = { x: s.ex, y: s.ey };
    s.tVisee = MEMOIRE_VISEE;
  } else s.tVisee = Math.max(0, s.tVisee - dt);

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
    // un lob qui nous a passés : le bouton SMASH ne répond pas
    if (a === 'smash' && contrainte(jeu.balle, s)) continue;
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
  if (s.intent && frappable(jeu, s, BONUS_PORTEE)) {
    const b = jeu.balle;
    const d = Math.hypot(b.x - s.x, b.y - s.y);
    // un coup chargé attend que la balle soit tout près (ou qu'elle s'éloigne) : c'est le bon timing qui le rend précis
    const attend = s.charge >= CHARGE_ATTENTE && d > DISTANCE_IDEALE && d <= s.dBalle;
    s.dBalle = d;
    if (!attend) coupHumain(jeu, s);
  } else s.dBalle = 99;
}

/** Précision du contact (0 → 1) : 1 quand la balle est sur la raquette. */
export const precisionContact = (jeu: Partie, s: Joueur): number =>
  clamp(1 - Math.hypot(jeu.balle.x - s.x, jeu.balle.y - s.y) / (PORTEE_CONTACT * BONUS_PORTEE), 0, 1);

/** Jauge pleine, balle bien au contact, pas de lob subi : le coup sera un super coup. */
export function superCoup(jeu: Partie, s: Joueur, bouton: Bouton, charge: number): boolean {
  return (
    (bouton === 'plat' || bouton === 'smash') &&
    charge >= SUPER_CHARGE &&
    precisionContact(jeu, s) >= PRECISION_SUPER &&
    !contrainte(jeu.balle, s)
  );
}

/** Visée du service avec le joystick : -1 au centre, +1 vers la vitre. */
export const viseServ = (s: Joueur): number => clamp(s.ey * (s.y > 5 ? -1 : 1), -1, 1);

/** La direction que le joueur vise : le joystick, ou sa dernière position s'il vient de le lâcher. */
export function directionVisee(s: Joueur): { x: number; y: number } {
  if (Math.hypot(s.ex, s.ey) > SEUIL_VISEE) return { x: s.ex, y: s.ey };
  return s.tVisee > 0 ? s.visee : { x: 0, y: 0 };
}

/**
 * Le coup aérien, choisi seul selon la place et le timing : au filet et bien
 * armé, un smash ; entre deux, une víbora (ou en visant un côté) ; au fond, une
 * bandeja pour garder l'échange.
 */
export function coupAerien(s: Joueur, p: number): Coup {
  const loin = Math.abs(s.x - MIL);
  const lateral = Math.abs(directionVisee(s).y) > 0.4;
  if (loin < 4.5) return p >= 0.7 ? 'smash' : lateral ? 'vibora' : 'bandeja';
  if (loin < 7) return p >= 0.55 || lateral ? 'vibora' : 'bandeja';
  return 'bandeja';
}

/** Le coup qui partirait si la balle était à portée maintenant (affiché au-dessus du joueur). */
export function coupPrevu(jeu: Partie, s: Joueur, bouton: Bouton, charge: number): Coup {
  const p = 0.25 + 0.75 * charge;
  const haut = jeu.balle.z > HAUT_SMASH;
  switch (bouton) {
    case 'plat':
      return charge < 0.5 ? 'coupe' : 'plat';
    case 'smash':
      // jauge de smash pleine : toujours un smash sur une balle haute
      if (haut && jeu.jaugeSmash[s.eq] >= 1 && !contrainte(jeu.balle, s)) return 'smash';
      return haut ? coupAerien(s, p) : 'plat';
    default:
      return bouton;
  }
}

/**
 * Où la balle ira : le côté et la profondeur viennent du joystick. Poussé vers
 * le filet, le coup est plus long ; tiré en arrière, plus court. À plat, la
 * balle part en croisé.
 */
export function cibleCoup(s: Joueur, type: Coup): { tx: number; ty: number } {
  const v = directionVisee(s);
  const av = v.x * dir(s.eq); // > 0 : vers le filet
  let m = PROF[type] ?? 3;
  if (type === 'amorti') m += Math.max(0, -av) * 0.6;
  else m -= av > 0 ? av * 1.0 : av * 1.4;
  let ty: number;
  if (Math.abs(v.y) > 0.25) ty = 5 + clamp(v.y * 1.5, -1, 1) * 3.9;
  else ty = clamp(LARG - s.y, 1.4, 8.6);
  if (type === 'vibora') ty = Math.abs(v.y) > 0.25 ? (v.y > 0 ? 8.9 : 1.1) : ty < 5 ? 1.1 : 8.9;
  return { tx: xProf(autre(s.eq), m), ty: clamp(ty, 0.3, LARG - 0.3) };
}

function coupHumain(jeu: Partie, s: Joueur): void {
  const b = jeu.balle;
  const bouton = s.intent!.type;
  const precision = precisionContact(jeu, s);
  const sup = superCoup(jeu, s, bouton, s.charge);
  // SUPER : SMASH donne un smash même sur une balle basse, FRAPPE un boulet à plat
  const type = sup ? (bouton === 'smash' ? 'smash' : 'plat') : coupPrevu(jeu, s, bouton, s.charge);
  // SMASH sur une balle basse : un coup à plat appuyé à fond, plus risqué
  const risque = !sup && bouton === 'smash' && b.z <= HAUT_SMASH;
  const base = 0.25 + 0.75 * s.charge;
  const p = risque ? Math.max(0.85, base) : base;
  const { tx, ty } = cibleCoup(s, type);
  executeCoup(jeu, s, type, p, tx + alea(jeu.rng, -0.2, 0.2), ty, null, {
    precision,
    risque,
    superCoup: sup,
  });
}

/**
 * Un humain quitte la partie : son joueur reste sur la piste, repris par le
 * CPU (un joueur humain n'a pas d'IA : sans cela, il resterait planté).
 */
export function donneAuCpu(jeu: Partie, id: number): void {
  const s = jeu.joueurs[id];
  if (!s || !s.humain) return;
  s.humain = false;
  s.err = s.niv.err;
  s.intent = null;
  s.charge = 0;
  jeu.humains = jeu.humains.filter((h) => h !== s);
  if (jeu.humain === s) jeu.humain = null;
}
