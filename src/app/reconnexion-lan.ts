import { attente } from '@piascwal/lan-kit';
import type { Canal } from '../net/canal';
import { SessionClient, type Identite } from '../net/session-client';

/** Marge au-delà du délai de l'hôte, le temps qu'il constate lui aussi la fin de l'attente. */
const MARGE_MS = 5000;
const PAUSE_ESSAI_MS = 1500;
const ATTENTE_ANNONCES_MS = 1500;

export interface OptionsReconnexion {
  nom: string;
  canal: Canal;
  identite: Identite;
  /** l'identifiant de la partie à retrouver (celui de son annonce) */
  idHote: string;
  /** secondes pendant lesquelles on réessaie */
  delaiS: number;
  /** configure les rappels de la nouvelle session avant la connexion */
  branche: (c: SessionClient) => void;
  reussi: (c: SessionClient) => void;
  echec: () => void;
}

/**
 * Un invité qui a perdu la connexion en plein match essaie de revenir : il
 * relance la découverte, retrouve l'annonce de son hôte et se représente avec
 * le même identifiant et le même jeton secret, qui seuls lui rendent son siège.
 * Au bout du délai, l'hôte a libéré le siège : on abandonne.
 */
export class Reconnexion {
  private actif = true;

  constructor(private readonly o: OptionsReconnexion) {
    void this.boucle();
  }

  arrete(): void {
    this.actif = false;
  }

  private async boucle(): Promise<void> {
    const { o } = this;
    const fin = performance.now() + o.delaiS * 1000 + MARGE_MS;
    while (this.actif && performance.now() < fin) {
      let c: SessionClient | null = null;
      try {
        c = await SessionClient.cree(o.nom, o.identite, o.canal);
        await attente(ATTENTE_ANNONCES_MS);
        const annonce = c.parties.find((p) => p.id === o.idHote);
        if (annonce && this.actif) {
          o.branche(c);
          await c.rejoint(annonce);
          if (this.actif) return o.reussi(c);
        }
        c.ferme();
      } catch {
        c?.ferme();
      }
      await attente(PAUSE_ESSAI_MS);
    }
    if (this.actif) o.echec();
  }
}
