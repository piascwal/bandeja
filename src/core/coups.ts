import { clamp, gauss } from './aleatoire';
import { lance } from './balle';
import { ACCEL_ECHANGE, ACCEL_MAX, HAUT_MAX, HAUT_SMASH, LARG, MIL, PORTEE } from './constants';
import { contreVitre, placementVitre, vitreBrute } from './contre-vitre';
import { typeDePor } from './por';
import { GAIN_JAUGE, GAIN_VITRE, niveauDe, qualite, situationDe } from './qualite';
import { lanceSuper, ouvreParade, type VarianteSuper } from './super-coup';
import { autre, fond, xProf } from './terrain';
import type { Balle, Coup, Effet, Equipe, Joueur, Mur, Partie } from './types';

/** Distance visée par rapport à la vitre adverse, selon le coup. */
export const PROF: Partial<Record<Coup, number>> = {
  plat: 2.8,
  coupe: 2.4,
  lobe: 2.0,
  smash: 5.5,
  bandeja: 2.5,
  vibora: 2.1,
  amorti: 8.4,
  /** le renvoi de vitre vise ~6 m derrière le filet (voir `contreVitre`) */
  vitre: 4,
  cote: 4,
};

/**
 * Un lob qui a passé le joueur (la balle a rebondi, ou il est loin du filet) le
 * met en difficulté : pas de smash, un coup au mieux à mi-puissance, et
 * l'avantage passe à l'équipe qui a lobé.
 */
export const contrainte = (b: Balle, s: Joueur): boolean =>
  b.coup === 'lobe' && b.camp === s.eq && (b.sol >= 1 || Math.abs(s.x - MIL) > 5);

/** Une balle ordinaire retombe au moins à ces distances (m) des vitres adverses : l'erreur ne la sort pas du terrain. */
const MARGE_FOND = 0.9;
const MARGE_COTE = 0.5;

/** Puissance maximale d'un coup ordinaire (1 est réservé au super coup). */
const P_MAX = 0.97;
const P_CONTRAINT = 0.6;
const PRIME_AVANTAGE = 0.2;

/** La jauge du super coup de l'équipe qui frappe : vidée par un super coup, sinon remplie selon la qualité du coup. */
function remplitJauge(jeu: Partie, eq: Equipe, niveau: number, apresVitre: boolean, variante: number): void {
  if (variante) {
    jeu.jaugeSmash[eq] = 0;
    return;
  }
  const gain = (GAIN_JAUGE[niveau] ?? 0) + (apresVitre ? GAIN_VITRE : 0);
  jeu.jaugeSmash[eq] = Math.min(1, jeu.jaugeSmash[eq] + gain);
}

/** Le joueur peut-il frapper la balle maintenant ? (mul agrandit la portée) */
export function frappable(jeu: Partie, s: Joueur, mul = 1): boolean {
  const b = jeu.balle;
  if (jeu.phase !== 'jeu' || b.dehors || b.roule) return false;
  if (b.camp !== s.eq || b.sol >= 2 || s.cd > 0) return false;
  if (b.service && b.sol === 0) return false; // le service doit rebondir
  if (b.super > 0 || b.ace) return false; // un super coup et un ace sont imparables
  if (b.x < MIL !== (s.eq === 0)) return false;
  if (b.z > HAUT_MAX) return false;
  return Math.hypot(b.x - s.x, b.y - s.y) <= PORTEE * mul;
}

/** Vitesse, effet et marge au-dessus du filet d'un coup direct. */
function trajectoire(type: Coup, p: number, dist: number): { v: number; spin: Effet; marge: number } {
  switch (type) {
    case 'plat':
      return { v: 13 + 11 * p, spin: p > 0.75 ? 'lift' : 'plat', marge: 0.15 };
    case 'coupe':
      return { v: 12 + 7 * p, spin: 'coupe', marge: 0.15 };
    case 'lobe':
      return { v: dist / (1.45 + 0.3 * p + dist / 40), spin: 'lobe', marge: 0.6 };
    case 'amorti':
      return { v: 6.5 + 3 * p, spin: 'coupe', marge: 0.1 };
    case 'smash':
      return { v: 19 + 13 * p, spin: 'smash', marge: 0.15 };
    case 'bandeja':
      return { v: 12 + 5 * p, spin: 'coupe', marge: 0.15 };
    default:
      return { v: 15 + 7 * p, spin: 'vibora', marge: 0.15 };
  }
}

/** Facteur de vitesse de la balle après `echange` coups depuis le service. */
export const accelerationEchange = (echange: number): number =>
  1 + Math.min(ACCEL_MAX, ACCEL_ECHANGE * Math.max(0, echange - 2));

/**
 * Rebond vif d'un coup fort ou coupé (voir `Balle.vif`) : plus on charge, plus
 * la balle bondit, file à la vitre et en revient en hauteur ; à fond, elle
 * peut même sortir de la piste. Le coupé bondit à peine, juste de quoi ne pas
 * mourir au fond du court.
 */
function rebondVif(type: Coup, p: number, hasard: number): number {
  if (type === 'plat') {
    if (p < 0.5) return 0.2;
    const k = (p - 0.5) / 0.5;
    return p >= 0.92 && hasard < 0.35 ? 1.25 : k;
  }
  if (type === 'coupe') return 0.3;
  if (type === 'bandeja') return 0.35;
  return 0;
}

/** Réglages d'un coup qui ne vient pas du CPU : timing, intention du bouton, charge, super coup. */
export interface OptionsCoup {
  /** 0 → 1 : la balle est-elle au contact ? (par défaut calculé d'après la distance) */
  precision?: number;
  /** coup forcé (SMASH sur une balle basse) : plus risqué */
  risque?: boolean;
  /** le coup que le bouton voulait jouer, s'il diffère de celui qui part (juge la qualité) */
  intention?: Coup;
  /** charge de l'appui (0 → 1) */
  charge?: number;
  /** variante du super coup (1 → 4) */
  super?: number;
  /** renvoi de vitre voulu par le joueur : dirigé si le coup est bien joué (vert), faussé s'il est moyen, brut s'il est raté */
  vitreLibre?: boolean;
}

/**
 * Frappe la balle : type de coup, puissance p (0 → 1), point visé (tx, ty) et,
 * éventuellement, un rebond voulu contre sa propre vitre. La qualité du coup
 * (voir `qualite.ts`) règle sa trajectoire : un smash bien placé est
 * monstrueux, un lob raté est lent et court, un lob parfait monte haut, loin et
 * vite.
 */
export function executeCoup(
  jeu: Partie,
  s: Joueur,
  type: Coup,
  p: number,
  tx: number,
  ty: number,
  mur?: Mur | null,
  opts?: OptionsCoup,
): void {
  const b = jeu.balle;
  const eq = s.eq;
  const variante = opts?.super ?? 0;
  // une balle qui revient de la vitre qu'on joue : beau renvoi
  const apresVitre = b.mur;
  // lob subi : coup limité, sans smash ; l'avantage passe au lobeur. Avantage reçu : coup plus fort.
  const subi = contrainte(b, s);
  const prime = jeu.avantage === eq;
  jeu.avantage = subi ? autre(eq) : null;
  if (subi) {
    p = Math.min(p, P_CONTRAINT);
    if (type === 'smash') type = 'bandeja';
  }
  if (prime) p += PRIME_AVANTAGE;
  // la qualité du coup, d'après la situation de jeu
  const precision = opts?.precision ?? clamp(1 - Math.hypot(b.x - s.x, b.y - s.y) / (PORTEE * 1.3), 0, 1);
  const libre = !!mur && !!opts?.vitreLibre;
  const situation = situationDe(b, s, precision, opts?.charge ?? p, jeu.posture[autre(eq)] === 'filet');
  if (libre) situation.vitre = placementVitre(b, s, mur);
  const brut = qualite(opts?.intention ?? type, situation).score;
  const score = variante ? 1 : clamp(brut * (subi && !libre ? 0.75 : 1) * (prime ? 1.1 : 1), 0, 1);
  const niveau = variante ? 5 : niveauDe(score);
  p = variante ? 1 : Math.min(p, P_MAX) * (0.55 + 0.45 * score);
  const rng = jeu.rng;
  const vin = Math.hypot(b.vx, b.vy, b.vz);
  // la pose de smash n'est que pour les coups aériens : FRAPPE sur une balle haute reste un coup normal
  const haut = b.z > HAUT_SMASH && (type === 'smash' || type === 'bandeja' || type === 'vibora');
  // rebond voulu contre sa propre vitre (du fond ou de côté) : sinon coup direct
  if (mur) {
    const cote = mur === 'fond' ? 'vitre' : 'cote';
    if (libre) {
      // le joueur a choisi sa vitre : elle part chez l'adversaire, à peine faussée si le coup est médiocre ; brute seulement si aucun élan n'existe
      if (!contreVitre(b, eq, ty, mur, rng, niveau >= 3 ? 0 : niveau === 2 ? 0.06 : 0.14))
        vitreBrute(b, eq, mur, rng);
      type = cote;
    } else if (contreVitre(b, eq, ty, mur, rng)) type = cote;
    else if (type === 'vitre') {
      type = 'lobe';
      tx = xProf(autre(eq), PROF.lobe!);
    }
  }
  if (variante) {
    type = lanceSuper(jeu, s, variante as VarianteSuper);
    b.portres = false;
    b.por = 0;
    b.vif = 1; // le premier rebond déclenche la suite du super coup (voir `superRebond`)
  } else if (type !== 'vitre' && type !== 'cote') {
    const versFond = eq === 0 ? 1 : -1; // sens de x vers la vitre adverse
    let e = s.err * (0.45 + 0.8 * p + vin / 34 + (b.mur ? 0.3 : 0));
    // un coup bien joué est net, un coup médiocre ou forcé est incertain
    e *= 1.6 - 1.2 * score + (opts?.risque ? 0.35 : 0);
    if (type === 'bandeja' || type === 'lobe') e *= 0.7;
    if (type === 'amorti') e *= 0.45; // court et lent : l'erreur se joue sur le filet
    // la forme du coup selon sa qualité
    let vitesse = 0.85 + 0.3 * score;
    let marge: number | null = null;
    const raté = clamp((0.4 - score) / 0.4, 0, 1);
    const parfait = clamp((score - 0.8) / 0.2, 0, 1);
    if (type === 'lobe') {
      // raté : lent, haut et court ; parfait : haut, loin, mais vite
      tx += versFond * (0.6 * parfait - 3 * raté);
      vitesse = 1 - 0.2 * raté + 0.3 * parfait;
      marge = 0.6 + 0.3 * raté + 0.5 * parfait;
    } else if (type === 'amorti') {
      // raté : trop long et trop vif ; parfait : meurt derrière le filet
      tx += versFond * (2.5 * raté - 0.5 * parfait);
      vitesse = 1 + 0.3 * raté;
    }
    tx += gauss(rng) * e * 1.4;
    ty += gauss(rng) * e * 1.15;
    // arcade : l'erreur ne sort pas la balle du terrain (sauf le coup voulu long, par 3 / par 4) : plus d'échanges
    const fondAdv = fond(autre(eq));
    if (Math.abs(tx - fondAdv) < MARGE_FOND) tx = fondAdv + (eq === 0 ? -MARGE_FOND : MARGE_FOND);
    ty = clamp(ty, MARGE_COTE, LARG - MARGE_COTE);
    const t = trajectoire(type, p, Math.hypot(tx - b.x, ty - b.y));
    t.v *= vitesse;
    if (type !== 'lobe' && type !== 'amorti') t.v *= accelerationEchange(jeu.echange);
    // quelques fautes directes dans le filet, surtout en forçant et en jouant mal
    const risque = type === 'plat' || type === 'smash' ? 0.01 + 0.05 * p * e : 0.006 * e;
    lance(b, tx, ty, t.v, t.spin, rng() < risque ? -0.3 : (marge ?? t.marge));
    b.spinDir = ty < 5 ? -1 : 1;
    // por 3 / por 4 : réservés à certains coups, dans certaines situations (voir `por.ts`)
    b.por = typeDePor(type, p, score, situation, subi, ty, rng());
    b.portres = b.por > 0;
    b.vif = rebondVif(type, p, rng());
  } else {
    b.vif = 0;
    b.por = 0;
    b.portres = false;
  }
  b.eqF = eq;
  b.camp = autre(eq);
  b.sol = 0;
  b.rebonds = 0;
  b.service = false;
  b.filet = false;
  b.mur = false;
  b.coup = type;
  b.super = variante;
  b.trace.length = 0;
  // le sprite pieds en l'air est réservé au smash et aux super coups ; bandeja et víbora gardent la pose d'armé, les deux pieds au sol
  s.poseCoup = variante > 0 || (haut && type === 'smash') ? 'smash2' : haut ? 'smash1' : 'attente';
  // le joueur se tourne vers là où part la balle (y compris vers sa vitre)
  if (type === 'vitre' || type === 'cote') {
    s.faceCoup = b.vx >= 0 ? 1 : -1;
    s.tourne = 0.45;
  }
  s.swing = 1;
  s.haut = haut || variante > 0;
  s.cd = 0.35;
  s.intent = null;
  s.charge = 0;
  jeu.tFrappe = 0;
  jeu.echange++;
  remplitJauge(jeu, eq, niveau, apresVitre, variante);
  if (variante) ouvreParade(jeu, autre(eq));
  jeu.plan = [null, null];
  jeu.pred = null;
  jeu.tPred = 0;
  replaceEquipe(jeu, s, type, p);
  jeu.evenements.push({
    type: 'frappe',
    coup: type,
    puissance: p,
    portres: b.portres,
    humain: s.humain,
    x: s.x,
    y: s.y,
    q: niveau,
    sv: variante,
  });
}

/** Positionnement des deux équipes (au filet ou au fond) après le coup. */
function replaceEquipe(jeu: Partie, s: Joueur, type: Coup, p: number): void {
  const eq = s.eq;
  const camp = autre(eq);
  if (type === 'lobe' || type === 'vitre' || type === 'cote') {
    jeu.posture[eq] = 'filet';
    jeu.posture[camp] = 'fond';
  } else if (type === 'smash' || type === 'bandeja' || type === 'vibora') {
    jeu.posture[eq] = 'filet';
    if (type === 'smash') jeu.posture[camp] = 'fond';
  } else if (Math.abs(s.x - MIL) < 5) jeu.posture[eq] = 'filet';
  else jeu.posture[eq] = p > 0.7 && jeu.rng() < 0.5 ? 'filet' : 'fond';
}
