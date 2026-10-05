import { attente, genereCode, lienInvitation, normaliseCode } from '@piascwal/lan-kit';
import type { VueChoix } from '@render/lan-choix';
import type { VueLigne } from '@render/ligne-accueil';
import { CANAL_LOCAL } from '../net/canal';
import type { BandejaApp } from './app';
import type { ParcoursLan } from './parcours-lan';
import { partageLien } from './partage';
import { saisitPseudo } from './pseudo';
import { ouvreSaisie } from './saisie';

/** Temps laissé à la recherche d'un salon avant de conclure qu'il n'existe pas (ms). */
const RECHERCHE_MAX_MS = 9000;

/**
 * Le parcours « multijoueur » avant la salle d'attente : choisir entre le Wi-Fi et
 * Internet, puis, en ligne, créer un salon (son code s'affiche dans la salle) ou
 * rejoindre celui d'un ami par son code ou son lien. Le reste (salle, match,
 * reconnexion) est celui du Wi-Fi : `ParcoursLan`.
 */
export class ParcoursLigne {
  /** le code d'un lien d'invitation, en attente d'un geste pour rejoindre */
  invitation: string | null = null;
  /** message à montrer à la fin de la salle d'attente (lien copié...) */
  copie = false;

  constructor(
    private readonly app: BandejaApp,
    private readonly lan: ParcoursLan,
  ) {}

  /** Menu → choix entre le Wi-Fi et Internet. */
  ouvreChoix(): void {
    this.app.ecranUI = 'multi-choix';
  }

  /** Choix « en ligne » : on n'a encore ni salon ni session. */
  ouvre(): void {
    this.lan.canal = { type: 'ligne', code: '' };
    this.lan.message = null;
    this.lan.phaseListe = 'pret';
    this.app.ecranUI = 'ligne';
  }

  /** Un lien d'invitation a ouvert le jeu : on propose de rejoindre son salon. */
  surInvitation(code: string): void {
    this.invitation = code;
    this.ouvre();
  }

  /** Retour : à la recherche en cours on renonce, sinon on revient au choix. */
  retour(): void {
    if (this.lan.phaseListe !== 'pret' && this.lan.phaseListe !== 'erreur') return this.lan.quitte();
    this.lan.quitte();
    this.ouvreChoix();
  }

  cree(): void {
    this.invitation = null;
    this.lan.cree({ type: 'ligne', code: genereCode() });
  }

  /** Demande le code d'un salon puis le rejoint. */
  saisitCode(): void {
    ouvreSaisie({
      titre: 'CODE DU SALON',
      valeur: '',
      max: 9,
      filtre: (t) => t.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
      valide: normaliseCode,
      erreur: 'CODE INVALIDE (8 CARACTERES)',
      surValide: (code) => this.rejoint(code),
    });
  }

  rejointInvitation(): void {
    if (this.invitation) this.rejoint(this.invitation);
  }

  /** Cherche le salon de ce code et y entre. */
  rejoint(code: string): void {
    this.invitation = null;
    this.lan.ouvre({ type: 'ligne', code });
    void this.attendSalon();
  }

  /** L'hôte s'annonce sur les serveurs de découverte : on attend de le voir, puis on le rejoint. */
  private async attendSalon(): Promise<void> {
    const lan = this.lan;
    const debut = performance.now();
    while (performance.now() - debut < RECHERCHE_MAX_MS) {
      if (this.app.ecranUI !== 'ligne' || lan.phaseListe === 'erreur') return;
      const partie = lan.client?.parties[0];
      if (partie) return lan.rejoint(partie.id);
      await attente(250);
    }
    if (this.app.ecranUI === 'ligne') {
      lan.phaseListe = 'pret';
      lan.message = 'SALON INTROUVABLE : VERIFIEZ LE CODE';
    }
  }

  /** Partage le lien d'invitation du salon en cours. */
  partage(code: string): void {
    const lien = lienInvitation(location.href, code);
    void partageLien(lien, `REJOINS MON SALON BANDEJA : ${code}`).then((ok) => {
      this.copie = ok;
      setTimeout(() => (this.copie = false), 2500);
    });
  }

  saisitPseudo(): void {
    saisitPseudo(this.app.pref);
  }

  vueChoix(): VueChoix {
    return {
      pseudo: this.app.pref.nom,
      onLigne: () => this.ouvre(),
      onLocal: () => this.lan.ouvre(CANAL_LOCAL),
      onPseudo: () => this.saisitPseudo(),
      onRetour: () => (this.app.ecranUI = 'menu'),
    };
  }

  vueLigne(): VueLigne {
    const l = this.lan;
    return {
      phase: l.phaseListe,
      message: l.message,
      pseudo: this.app.pref.nom,
      invitation: this.invitation,
      onCree: () => this.cree(),
      onRejoint: () => this.saisitCode(),
      onInvitation: () => this.rejointInvitation(),
      onPseudo: () => this.saisitPseudo(),
      onRetour: () => this.retour(),
    };
  }
}
