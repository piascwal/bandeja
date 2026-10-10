import type { Bouton } from '@core/types';

/**
 * Le geste tactile : le doigt qui se pose arme le coup (implicitement), puis il trace un trait ; à
 * son relâchement, la FORME du trait choisit le coup et la zone visée.
 *
 * - pas de trait (moins de `SEUIL_TRAIT` px) : FRAPPE ;
 * - un tout petit trait (moins de `SEUIL_LONG` px) : AMORTI ;
 * - un trait vers le haut (à moins de 45° de la verticale) : LOB ;
 * - un autre trait, droit : frappe LOURDE ; courbé (`SEUIL_COURBE`) : COURBE, un coup à effet (víbora)
 *   qui part dans le coin vers lequel le trait se courbe.
 *
 * La zone : pour la frappe lourde et l'amorti, le côté suit la direction où le trait finit (vers le
 * haut de l'écran : haut du terrain) ; pour la courbe, le coin vers lequel il se courbe ; la
 * longueur du trait règle la profondeur (long : profond). Le lob garde la visée du joystick.
 */
export const SEUIL_TRAIT = 6;
export const SEUIL_LONG = 26;
export const SEUIL_COURBE = 0.2;
/** Longueur (px) au-delà de laquelle un trait est « à fond » pour la profondeur. */
const LONGUEUR_PROFONDE = 86;

export interface Point {
  x: number;
  y: number;
}

export type TypeGeste = Extract<Bouton, 'plat' | 'amorti' | 'lobe' | 'lourd' | 'courbe'>;

export interface Geste {
  type: TypeGeste;
  /** côté visé, de -1 (haut du terrain à l'écran) à 1 (bas) ; null : la visée du joystick */
  side: number | null;
  /** profondeur, de 0 (court) à 1 (profond) */
  prof: number;
  /** courbure signée du trait (flèche / corde) */
  courbure: number;
}

const borne = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Analyse un trait (points dans l'ordre du tracé, y vers le bas) : le coup, le côté, la profondeur. */
export function analyseTrait(pts: readonly Point[]): Geste {
  const p0 = pts[0];
  const pn = pts[pts.length - 1];
  if (!p0 || !pn || pts.length < 2) return { type: 'plat', side: null, prof: 0.5, courbure: 0 };
  const cx = pn.x - p0.x;
  const cy = pn.y - p0.y;
  const l = Math.hypot(cx, cy);
  if (l < SEUIL_TRAIT) return { type: 'plat', side: null, prof: 0.5, courbure: 0 };
  const ux = cx / l;
  const uy = cy / l;
  // la courbure : le point le plus écarté de la corde, et de quel côté (positif : à gauche de la marche, y vers le bas)
  let dev = 0;
  for (const p of pts) {
    const c = ux * (p.y - p0.y) - uy * (p.x - p0.x);
    if (Math.abs(c) > Math.abs(dev)) dev = c;
  }
  const courbure = l >= SEUIL_LONG ? dev / l : 0;
  // la direction où le trait finit : le dernier segment d'au moins 8 px
  let k = pts.length - 2;
  while (k > 0 && Math.hypot(pn.x - pts[k]!.x, pn.y - pts[k]!.y) < 8) k--;
  const fin = pts[k]!;
  const fl = Math.hypot(pn.x - fin.x, pn.y - fin.y) || 1;
  const uyFin = (pn.y - fin.y) / fl;
  const prof = borne((l - SEUIL_LONG) / (LONGUEUR_PROFONDE - SEUIL_LONG), 0, 1);
  if (l < SEUIL_LONG) return { type: 'amorti', side: borne(uy * 1.3, -1, 1), prof, courbure };
  if (uy < 0 && Math.abs(ux) < -uy) return { type: 'lobe', side: null, prof, courbure };
  if (Math.abs(courbure) >= SEUIL_COURBE) {
    // le côté vers lequel le trait se courbe : le sens vertical du renflement (normale à la corde, côté du point le plus écarté)
    const bulge = ux * Math.sign(dev);
    const side = Math.abs(bulge) > 0.15 ? Math.sign(bulge) : Math.sign(uyFin) || 1;
    return { type: 'courbe', side, prof, courbure };
  }
  return { type: 'lourd', side: borne(uyFin * 1.3, -1, 1), prof, courbure };
}

/** Le même coup, pour l'affichage en cours de tracé (la couleur du trait). */
export const typeDuTrait = (pts: readonly Point[]): TypeGeste => analyseTrait(pts).type;

export const NOMS_GESTE: Record<TypeGeste, string> = {
  plat: 'FRAPPE',
  amorti: 'AMORTI',
  lobe: 'LOB',
  lourd: 'FORT',
  courbe: 'COURBE',
};

/** La couleur du trait à l'écran, selon le coup qu'il dessine. */
export const COULEURS_GESTE: Record<TypeGeste, string> = {
  plat: '#ffffff',
  amorti: '#2fd0c6',
  lobe: '#3fb4e8',
  lourd: '#ff5470',
  courbe: '#ffa24a',
};
