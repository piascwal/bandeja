import type { Evenement } from '@core/types';
import type { BalleInstantane, Instantane, JoueurInstantane } from './instantane';

/** Retard d'affichage minimum (ms) sur un Wi-Fi calme : de quoi toujours avoir deux instantanés à interpoler. */
const RETARD_MIN_MS = 30;
const RETARD_MAX_MS = 250;
/** Au-delà de cette distance (m) entre deux instantanés, c'est une téléportation (service, engagement) : on ne glisse pas. */
const SAUT_M = 3;
const MAX_TAMPON = 64;

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

function joueurInterpole(a: JoueurInstantane, b: JoueurInstantane, k: number): JoueurInstantane {
  const saut = Math.hypot(b.x - a.x, b.y - a.y) > SAUT_M;
  if (saut) return b;
  return {
    ...a,
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    vx: lerp(a.vx, b.vx, k),
    vy: lerp(a.vy, b.vy, k),
    pas: lerp(a.pas, b.pas, k),
  };
}

function balleInterpole(a: BalleInstantane, b: BalleInstantane, k: number): BalleInstantane {
  // un coup (la vitesse change d'un coup) ou un rebond ne s'interpolent pas : on prend le plus récent
  const saut = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > SAUT_M || a.coup !== b.coup || a.sol !== b.sol;
  if (saut) return k < 0.5 ? a : b;
  return {
    ...a,
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    z: lerp(a.z, b.z, k),
    vx: lerp(a.vx, b.vx, k),
    vy: lerp(a.vy, b.vy, k),
    vz: lerp(a.vz, b.vz, k),
  };
}

/** Mélange deux instantanés consécutifs : positions lissées, tout le reste pris du plus récent (k >= 0.5) ou du plus ancien. */
export function interpole(a: Instantane, b: Instantane, k: number): Instantane {
  const base = k < 0.5 ? a : b;
  if (a.phase !== b.phase || a.serveur !== b.serveur) return base;
  return {
    ...base,
    t: lerp(a.t, b.t, k),
    joueurs: a.joueurs.map((j, i) => joueurInterpole(j, b.joueurs[i]!, k)),
    balle: balleInterpole(a.balle, b.balle, k),
  };
}

interface EvenementDate {
  t: number;
  ev: Evenement;
}

/**
 * Tampon d'instantanés côté invité : l'affichage tourne avec un petit retard,
 * adaptatif selon la régularité du Wi-Fi, et interpole entre deux instantanés ;
 * les évènements (sons, effets) sont datés et rendus au moment où l'image
 * correspondante s'affiche. `maintenant` est une horloge en millisecondes
 * (performance.now() en jeu, une valeur choisie dans les tests).
 */
export class Synchro {
  private tampon: Instantane[] = [];
  private evenements: EvenementDate[] = [];
  /** décalage horloge locale / temps de simulation (ms), biaisé vers les arrivées les plus rapides */
  private decalage: number | null = null;
  private dernierArrivee: number | null = null;
  private dernierT: number | null = null;
  private gigue = 0;
  private dernierSeq = -1;
  retardMs = RETARD_MIN_MS;

  /** À appeler pour chaque instantané reçu. Les doublons et les paquets arrivés dans le désordre sont ignorés. */
  recoit(s: Instantane, maintenant: number): void {
    if (this.dernierSeq >= 0 && !plusRecent(s.seq, this.dernierSeq)) return;
    this.dernierSeq = s.seq;
    const echantillon = maintenant - s.t * 1000;
    // décalage : on suit vite les arrivées plus rapides, lentement les plus lentes
    this.decalage =
      this.decalage === null
        ? echantillon
        : this.decalage + (echantillon - this.decalage) * (echantillon < this.decalage ? 0.5 : 0.02);
    if (this.dernierArrivee !== null && this.dernierT !== null) {
      const ecart = Math.abs(maintenant - this.dernierArrivee - (s.t - this.dernierT) * 1000);
      this.gigue += (ecart - this.gigue) * 0.1;
    }
    this.dernierArrivee = maintenant;
    this.dernierT = s.t;
    this.retardMs = Math.min(RETARD_MAX_MS, Math.max(RETARD_MIN_MS, RETARD_MIN_MS + 3 * this.gigue));
    this.tampon.push(s);
    if (this.tampon.length > MAX_TAMPON) this.tampon.shift();
  }

  /** Évènement de la partie, daté du temps de simulation `t` où il s'est produit. */
  recoitEvenement(ev: Evenement, t: number): void {
    this.evenements.push({ t, ev });
  }

  /** Temps de simulation à afficher maintenant, ou null tant qu'on n'a rien reçu. */
  tempsAffiche(maintenant: number): number | null {
    return this.decalage === null ? null : (maintenant - this.decalage - this.retardMs) / 1000;
  }

  /** L'image à dessiner maintenant (jamais d'extrapolation : au bout du tampon, on garde le dernier instantané). */
  echantillon(maintenant: number): Instantane | null {
    const T = this.tempsAffiche(maintenant);
    if (T === null || this.tampon.length === 0) return null;
    const tp = this.tampon;
    // on jette ce qui est trop ancien, en gardant l'instantané juste avant T
    while (tp.length > 2 && tp[1]!.t <= T) tp.shift();
    const a = tp[0]!;
    const b = tp[1];
    if (!b || T >= b.t) return b ?? a;
    if (T <= a.t) return a;
    return interpole(a, b, (T - a.t) / (b.t - a.t));
  }

  /** Les évènements datés d'avant l'image affichée, dans l'ordre : à jouer maintenant (son, effets). */
  evenementsAJouer(maintenant: number): Evenement[] {
    const T = this.tempsAffiche(maintenant);
    if (T === null) return [];
    this.evenements.sort((x, y) => x.t - y.t);
    const prets: Evenement[] = [];
    while (this.evenements.length && this.evenements[0]!.t <= T) prets.push(this.evenements.shift()!.ev);
    return prets;
  }

  /** Après une pause ou une reprise : on repart de zéro. */
  reinitialise(): void {
    this.tampon = [];
    this.evenements = [];
    this.decalage = null;
    this.dernierArrivee = null;
    this.dernierT = null;
    this.gigue = 0;
    this.dernierSeq = -1;
    this.retardMs = RETARD_MIN_MS;
  }
}

/** `a` est-il plus récent que `b` ? Numéros sur 16 bits qui tournent en boucle. */
export function plusRecent(a: number, b: number): boolean {
  const d = (a - b) & 0xffff;
  return d !== 0 && d < 0x8000;
}
