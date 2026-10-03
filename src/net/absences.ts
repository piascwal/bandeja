import { REPRISE_S } from './protocole';
import { part, type EtatSalon } from './salon';

/**
 * Règles d'absence en plein match (fonctions pures, testées). Un joueur qui
 * perd la connexion (Wi-Fi qui décroche, téléphone en veille) ne fait pas
 * tomber la partie : l'hôte garde son siège, fige le match et attend son
 * retour pendant `delai` secondes. Au retour de tous, un compte à rebours
 * relance le jeu ; au bout du délai, les absents sont remplacés par le CPU.
 */

/** Un joueur assis vient de perdre la connexion. Faux s'il n'est pas assis (ou est l'hôte), ou si le match n'est pas en cours. */
export function marqueAbsent(e: EtatSalon, siege: number, delai: number): boolean {
  if (e.phase !== 'jeu' || !e.sieges[siege] || siege === 0) return false;
  if (e.absents.includes(siege)) return false;
  e.absents.push(siege);
  // le délai court depuis la PREMIÈRE absence : un deuxième absent ne le prolonge pas
  if (e.reconnexion <= 0) e.reconnexion = delai;
  e.reprise = 0;
  return true;
}

/** Le joueur du siège est revenu : la partie repart après le compte à rebours quand plus personne n'est absent. */
export function revient(e: EtatSalon, siege: number): boolean {
  if (!e.absents.includes(siege)) return false;
  e.absents = e.absents.filter((s) => s !== siege);
  if (e.absents.length === 0) {
    e.reconnexion = 0;
    e.reprise = REPRISE_S;
  }
  return true;
}

/** Le délai est écoulé (ou l'hôte n'attend plus) : les sièges absents sont libérés, le CPU reprend la main. */
export function finAbsence(e: EtatSalon): string[] {
  const noms: string[] = [];
  for (const s of e.absents) {
    const o = e.sieges[s];
    if (o) {
      noms.push(o.nom);
      part(e, o.appareil);
    }
  }
  e.absents = [];
  e.reconnexion = 0;
  e.reprise = e.phase === 'jeu' ? REPRISE_S : 0;
  return noms;
}

/** Pause (ou reprise) : la reprise passe, elle aussi, par le compte à rebours. */
export function basculePause(e: EtatSalon, oui: boolean): boolean {
  if (e.phase !== 'jeu' || e.pause === oui) return false;
  e.pause = oui;
  e.reprise = oui ? 0 : REPRISE_S;
  return true;
}

export type EvenementTemps = 'rien' | 'seconde' | 'fini';

/**
 * Les comptes à rebours de l'hôte : l'état partagé ne porte que des secondes
 * entières (ce qu'on affiche), les fractions vivent ici.
 */
export class Minuteries {
  private reconnexion = 0;
  private reprise = 0;

  /**
   * Fait avancer de dt secondes. `seconde` : l'entier affiché a changé (à
   * rediffuser) ; `fini` : le délai de reconnexion est écoulé (l'hôte appelle
   * alors `finAbsence`). Une valeur posée de l'extérieur (nouvelle absence,
   * nouvelle reprise) est reprise telle quelle.
   */
  avance(e: EtatSalon, dt: number): EvenementTemps {
    if (Math.ceil(this.reconnexion) !== e.reconnexion) this.reconnexion = e.reconnexion;
    if (Math.ceil(this.reprise) !== e.reprise) this.reprise = e.reprise;
    if (e.absents.length > 0 && e.reconnexion > 0) {
      this.reconnexion = Math.max(0, this.reconnexion - dt);
      if (this.reconnexion <= 0) return 'fini';
      const n = Math.ceil(this.reconnexion);
      if (n === e.reconnexion) return 'rien';
      e.reconnexion = n;
      return 'seconde';
    }
    if (e.reprise > 0 && !e.pause && e.phase === 'jeu') {
      this.reprise = Math.max(0, this.reprise - dt);
      const n = Math.ceil(this.reprise);
      if (n === e.reprise) return 'rien';
      e.reprise = n;
      return 'seconde';
    }
    return 'rien';
  }
}
