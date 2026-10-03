import {
  Annuaire,
  Liaison,
  Veille,
  attente,
  idAleatoire,
  salonsDuReseau,
  type Annonce,
  type Signal,
} from '@piascwal/lan-kit';
import type { Commande } from '@core/types';
import { valideAnnonceBandeja, type AnnonceBandeja } from './annonce';
import { bonjour, lisCtrl, type MsgCtrl } from './ctrl';
import { plageStricte, reglagesDev } from './dev';
import { EmetteurEntrees } from './entrees';
import type { MessageEvenement } from './evenements';
import { decodeInstantane, type Instantane } from './instantane';
import { APP } from './protocole';
import type { ActionSalon, EtatSalon } from './salon';

export type PartieAnnoncee = Annonce<AnnonceBandeja>;

/** Pourquoi la session s'est terminée. */
export type RaisonFin = 'quitte' | 'perdu' | 'complet' | 'version' | 'spectateurs' | 'injoignable';

/** Une annonce qu'on n'a plus revue depuis ce délai a disparu (l'hôte se ré-annonce toutes les 30 s). */
const PEREMPTION_MS = 75_000;
const REPONSE_MAX_MS = 8_000;

/** Les paramètres d'un début de match reçus de l'hôte. */
export interface DebutMatch {
  /** le siège de cet appareil, -1 s'il regarde */
  siege: number;
  niveau: number;
  jeux: number;
  sieges: number[];
  graine: number;
}

/**
 * Session d'un invité (joueur ou spectateur) : il liste les parties du Wi-Fi,
 * se connecte à une, puis suit l'hôte. Il ne simule rien : il reçoit des
 * instantanés et ne lui envoie que ses commandes.
 */
export class SessionClient {
  readonly appareil = idAleatoire(8);
  /** l'état du salon, tel que l'hôte l'a envoyé en dernier */
  etat: EtatSalon | null = null;
  siege = -1;
  onListe: () => void = () => {};
  onEtat: (e: EtatSalon) => void = () => {};
  onDebut: (d: DebutMatch) => void = () => {};
  onInstantane: (s: Instantane) => void = () => {};
  onEvenement: (m: MessageEvenement) => void = () => {};
  onFin: (raison: RaisonFin) => void = () => {};

  private readonly annonces = new Map<string, { a: PartieAnnoncee; vu: number }>();
  private liaison: Liaison | null = null;
  private veille: Veille | null = null;
  private readonly emetteur = new EmetteurEntrees();
  private attenteReponse: ((s: Signal) => void) | null = null;
  private hote: string | null = null;
  private ferme_ = false;

  private constructor(
    private readonly annuaire: Annuaire<AnnonceBandeja>,
    private readonly ips: string[],
    private readonly nom: string,
  ) {}

  static async cree(nom: string): Promise<SessionClient> {
    const dev = reglagesDev();
    const { salons, ipsPubliques } = await salonsDuReseau(APP, dev.reseau);
    const annuaire = new Annuaire<AnnonceBandeja>({
      app: APP,
      salons,
      valideContenu: valideAnnonceBandeja,
      courtiers: dev.courtiers ?? undefined,
    });
    await annuaire.ouvre();
    const s = new SessionClient(annuaire, ipsPubliques, nom);
    annuaire.onAnnonce = (a) => {
      s.annonces.set(a.id, { a, vu: performance.now() });
      s.onListe();
    };
    annuaire.onRetrait = (id) => {
      if (s.annonces.delete(id)) s.onListe();
    };
    annuaire.onSignal = (de, _salon, sig) => {
      if (de === s.hote) s.attenteReponse?.(sig);
    };
    annuaire.ecouteAnnonces();
    return s;
  }

  /** Les parties vues sur le Wi-Fi, sans celles qui ont disparu. */
  get parties(): PartieAnnoncee[] {
    const maintenant = performance.now();
    for (const [id, x] of this.annonces) if (maintenant - x.vu > PEREMPTION_MS) this.annonces.delete(id);
    return [...this.annonces.values()].map((x) => x.a).sort((a, b) => a.nom.localeCompare(b.nom));
  }

  /** Relance la recherche : les annonces retenues par les serveurs reviennent aussitôt. */
  actualise(): void {
    this.annuaire.ecouteAnnonces();
  }

  get latenceMs(): number | null {
    return this.veille?.latenceMs ?? null;
  }

  /** Se connecte à une partie. Rejette avec la raison si l'hôte refuse ou ne répond pas. */
  async rejoint(a: PartieAnnoncee): Promise<void> {
    this.hote = a.id;
    const l = new Liaison(plageStricte(), this.ips);
    this.liaison = l;
    try {
      const sdp = await l.creeOffre();
      const reponse = new Promise<Signal>((ok) => (this.attenteReponse = ok));
      await this.annuaire.signale(a.id, a.salon, { type: 'offre', sdp, nom: this.nom, spect: false });
      const sig = await Promise.race([reponse, attente(REPONSE_MAX_MS).then(() => null)]);
      if (!sig) throw new Error('injoignable');
      if (sig.type === 'refus') throw new Error(sig.raison);
      if (sig.type !== 'reponse') throw new Error('injoignable');
      await l.accepteReponse(sig.sdp);
      await l.ouverte();
    } catch (e) {
      l.ferme();
      this.liaison = null;
      const raison = e instanceof Error ? e.message : '';
      throw new Error(['complet', 'version', 'spectateurs'].includes(raison) ? raison : 'injoignable');
    }
    this.attenteReponse = null;
    // plus rien ne passe par les serveurs de découverte : on s'en déconnecte
    this.annuaire.ferme();
    l.onCtrl = (o) => this.surCtrl(o);
    l.onJeu = (d) => {
      const s = decodeInstantane(d);
      if (s) {
        this.veille?.recuJeu();
        this.onInstantane(s);
      }
    };
    l.onFerme = () => this.finir('perdu');
    this.veille = new Veille(l, () => l.ferme());
    l.envoieCtrl(bonjour(this.nom, this.appareil));
  }

  private surCtrl(o: unknown): void {
    const msg = lisCtrl(o);
    if (!msg || this.veille?.recu(msg)) return;
    switch (msg.t) {
      case 'etat':
        this.etat = msg.e;
        this.siege = msg.e.sieges.findIndex((s) => s?.appareil === this.appareil);
        this.onEtat(msg.e);
        break;
      case 'debut':
        this.siege = msg.siege;
        this.onDebut({
          siege: msg.siege,
          niveau: msg.niveau,
          jeux: msg.jeux,
          sieges: msg.sieges,
          graine: msg.graine,
        });
        break;
      case 'evt':
        this.onEvenement(msg.m);
        break;
      case 'quitte':
        this.finir('quitte');
        break;
      default:
        break;
    }
  }

  private envoie(m: MsgCtrl): void {
    this.liaison?.envoieCtrl(m);
  }

  /** Demande un siège, ou à regarder. */
  agit(x: ActionSalon): void {
    this.envoie({ t: 'action', x });
  }

  pause(oui: boolean): void {
    this.envoie({ t: 'pause', oui });
  }

  /** À appeler à chaque pas ou presque : retient la commande et l'envoie à l'hôte (joueurs seulement). */
  envoieCommande(c: Commande): void {
    this.emetteur.suit(c);
    if (this.siege >= 0 && this.liaison?.ouverteMaintenant) this.liaison.envoieJeu(this.emetteur.encode());
  }

  private finir(raison: RaisonFin): void {
    if (this.ferme_) return;
    this.ferme();
    this.onFin(raison);
  }

  /** Quitte la partie (ou arrête la recherche). */
  quitte(): void {
    if (this.ferme_) return;
    this.envoie({ t: 'quitte' });
    this.ferme();
  }

  ferme(): void {
    this.ferme_ = true;
    this.veille?.arrete();
    if (this.liaison) this.liaison.onFerme = () => {};
    this.liaison?.ferme();
    this.annuaire.ferme();
  }
}
