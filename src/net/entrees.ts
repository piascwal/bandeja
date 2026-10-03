import type { Bouton, Commande } from '@core/types';
import { Ecrivain, Lecteur } from './binaire';
import { BOUTONS, VERSION_PROTOCOLE } from './protocole';
import { plusRecent } from './synchro';

/** Un joueur distant qui se tait plus longtemps s'arrête : sinon un paquet perdu le ferait courir tout droit. */
export const SILENCE_ENTREE_S = 0.5;
/** Appuis pris en compte par bouton et par lecture : une rafale de compteurs truqués ne mitraille pas. */
const APPUIS_MAX = 2;
const TAILLE_ENTREE = 3 + 2 + BOUTONS.length;

/**
 * Côté invité : transforme la commande de chaque pas en message. Les appuis
 * voyagent comme des COMPTEURS cumulés (modulo 256), pas comme des booléens :
 * même si un paquet se perd, l'appui arrive quand même dans le suivant, et une
 * seule fois.
 */
export class EmetteurEntrees {
  private seq = 0;
  private readonly compteurs = new Map<Bouton, number>();
  private dx = 0;
  private dy = 0;

  /** À appeler à chaque pas avec la commande lue (les appuis sont comptés, la direction retenue). */
  suit(c: Commande): void {
    for (const a of c.appuis) this.compteurs.set(a, ((this.compteurs.get(a) ?? 0) + 1) & 0xff);
    this.dx = c.dx;
    this.dy = c.dy;
  }

  /** Le message à envoyer maintenant (une dizaine d'octets). */
  encode(): ArrayBuffer {
    const w = new Ecrivain(TAILLE_ENTREE);
    w.u8(VERSION_PROTOCOLE).u16(this.seq++ & 0xffff);
    w.i8(this.dx * 100).i8(this.dy * 100);
    for (const b of BOUTONS) w.u8(this.compteurs.get(b) ?? 0);
    return w.fin();
  }
}

/**
 * Côté hôte : un siège distant. Reçoit les messages (dans n'importe quel ordre,
 * avec doublons et pertes) et rend, à chaque pas de simulation, la commande de
 * ce joueur : direction actuelle et appuis NOUVEAUX depuis la dernière lecture.
 * L'hôte est autoritaire : rien ne passe sans validation.
 */
export class EntreeDistante {
  private dx = 0;
  private dy = 0;
  private dernierSeq = -1;
  private dernierRecu: number | null = null;
  /** compteurs d'appuis déjà vus ; null tant qu'aucun message n'est arrivé (pas de rejeu à la connexion) */
  private vus: number[] | null = null;
  private readonly aRendre: number[] = BOUTONS.map(() => 0);

  /** Renvoie false si le message est invalide ou périmé. `maintenant` en secondes. */
  recoit(buf: ArrayBuffer, maintenant: number): boolean {
    if (buf.byteLength !== TAILLE_ENTREE) return false;
    try {
      const r = new Lecteur(buf);
      if (r.u8() !== VERSION_PROTOCOLE) return false;
      const seq = r.u16();
      if (this.dernierSeq >= 0 && !plusRecent(seq, this.dernierSeq)) return false;
      const dx = Math.max(-1, Math.min(1, r.i8() / 100));
      const dy = Math.max(-1, Math.min(1, r.i8() / 100));
      const compteurs = BOUTONS.map(() => r.u8());
      r.fini();
      this.dernierSeq = seq;
      this.dernierRecu = maintenant;
      // direction ramenée à la longueur 1 au plus
      const n = Math.hypot(dx, dy);
      this.dx = n > 1 ? dx / n : dx;
      this.dy = n > 1 ? dy / n : dy;
      if (this.vus) {
        compteurs.forEach((c, i) => {
          this.aRendre[i] = Math.min(APPUIS_MAX, this.aRendre[i]! + ((c - this.vus![i]!) & 0xff));
        });
      }
      this.vus = compteurs;
      return true;
    } catch {
      return false;
    }
  }

  /** La commande de ce pas ; les appuis ne sont rendus qu'une fois. */
  commande(maintenant: number): Commande {
    const silence = this.dernierRecu === null || maintenant - this.dernierRecu > SILENCE_ENTREE_S;
    const appuis: Bouton[] = [];
    BOUTONS.forEach((b, i) => {
      for (let k = 0; k < this.aRendre[i]!; k++) appuis.push(b);
      this.aRendre[i] = 0;
    });
    return silence ? { dx: 0, dy: 0, appuis } : { dx: this.dx, dy: this.dy, appuis };
  }
}
