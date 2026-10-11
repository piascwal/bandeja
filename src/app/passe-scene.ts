import { sceneAttendue, termineScene } from '@core/regles';
import type { Partie } from '@core/types';
import type { Effets } from '@render/effets';
import { siegesHumains } from '../net/salon';
import type { ParcoursLan } from './parcours-lan';
import type { Ralenti } from './ralenti';

/** Ce dont la gestion des scènes a besoin de l'application. */
export interface ContexteScene {
  jeu: Partie;
  ralenti: Ralenti;
  effets: Effets;
  lan: ParcoursLan;
}

/**
 * La fin d'un point avec une scène (fin de super coup, ralenti) : chaque écran la joue pour lui-même,
 * et le point ne finit que lorsque **tous les joueurs** l'ont vue en entier ou ont touché pour la passer.
 * Quelqu'un qui touche reste donc sur sa scène, avec un message d'attente, jusqu'à ce que tous aient
 * touché ; un invité prévient l'hôte, qui décide. Seul (ou avec des CPU), un appui passe tout de suite.
 */
export class PasseScene {
  /** cet appareil a touché l'écran pour passer */
  touche = false;
  private envoye = false;

  /** Un appui sur l'écran pendant une scène. */
  demande(): void {
    this.touche = true;
  }

  private reinitialise(): void {
    this.touche = false;
    this.envoye = false;
  }

  /** Cet écran a-t-il fini de montrer sa scène (ralenti compris) ? */
  private fini(a: ContexteScene): boolean {
    return a.ralenti.termine && !a.effets.finale.actif;
  }

  /** À chaque image, après le suivi du ralenti. */
  maj(a: ContexteScene): void {
    const j = a.jeu;
    if (j.phase !== 'point') {
      this.reinitialise();
      a.lan.hote?.passes.raz();
      // le nouveau point commence : plus aucune scène à l'écran
      if (j.phase === 'service' && a.effets.finale.actif) a.effets.finale.arrete();
      return;
    }
    if (j.mode !== 'match' || !(this.touche || this.fini(a))) return;
    if (a.lan.actif && !a.lan.hote) {
      // invité : l'hôte attend son signe, une seule fois par point
      if (!this.envoye) a.lan.client?.passe();
      this.envoye = true;
      return;
    }
    // hôte, ou partie seule : le point reprend dès que chacun a vu ou passé la scène
    const hote = a.lan.hote;
    if (!hote || hote.passes.tousInvites(siegesHumains(hote.etat))) {
      if (sceneAttendue(j)) {
        a.effets.finale.arrete();
        a.ralenti.arrete();
      }
      termineScene(j);
    }
  }
}
