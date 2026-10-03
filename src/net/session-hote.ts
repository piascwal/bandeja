import {
  Annuaire,
  Liaison,
  Limiteur,
  Veille,
  idAleatoire,
  salonsDuReseau,
  type Signal,
} from '@piascwal/lan-kit';
import { COMMANDE_VIDE } from '@core/partie';
import type { Commande } from '@core/types';
import { valideAnnonceBandeja, type AnnonceBandeja } from './annonce';
import { lisCtrl, type MsgCtrl } from './ctrl';
import { plageStricte, reglagesDev } from './dev';
import { EntreeDistante } from './entrees';
import type { MessageEvenement } from './evenements';
import { encodeInstantane, type Instantane } from './instantane';
import { APP, SPECTATEURS_MAX, VERSION_PROTOCOLE } from './protocole';
import {
  appliqueActionHote,
  arrive,
  appliqueAction,
  nouveauSalon,
  nbPresents,
  part,
  siegeDe,
  siegesHumains,
  type ActionHote,
  type ConfigSalon,
  type EtatSalon,
} from './salon';

/** Débits autorisés par appareil : messages de contrôle, et entrées de jeu (une par image affichée). */
const CTRL_PAR_S = 20;
const CTRL_RAFALE = 40;
const JEU_PAR_S = 240;
const JEU_RAFALE = 480;
/** Un pair qui ouvre la liaison sans jamais se présenter ne bloque rien : on le coupe. */
const PRESENTATION_MAX_MS = 10_000;

/** Un appareil branché sur l'hôte. */
interface Membre {
  l: Liaison;
  veille: Veille | null;
  /** connu une fois son « bonjour » reçu */
  appareil: string | null;
  entree: EntreeDistante;
  limiteCtrl: Limiteur;
  limiteJeu: Limiteur;
}

/**
 * Session de l'hôte : il est le serveur. Il annonce la partie sur le Wi-Fi,
 * accepte les appareils (liaison WebRTC locale), arbitre le salon, simule le
 * match et le diffuse. Un invité ne lui envoie jamais que des intentions.
 */
export class SessionHote {
  readonly etat: EtatSalon;
  /** l'état du salon a changé (un appareil arrive, part, choisit un siège...) */
  onChange: () => void = () => {};
  /** l'hôte a lancé (ou relancé) le match : l'app crée la partie */
  onDebut: () => void = () => {};
  /** un joueur demande la pause (ou la reprise) : l'app fige ou relance la simulation */
  onPause: (oui: boolean) => void = () => {};
  /** un appareil est parti : son nom, pour l'afficher */
  onParti: (nom: string) => void = () => {};

  private membres: Membre[] = [];
  private score: [number, number] = [0, 0];
  private ferme_ = false;

  private constructor(
    private readonly annuaire: Annuaire<AnnonceBandeja>,
    private readonly ips: string[],
    readonly appareil: string,
    nom: string,
    config: ConfigSalon,
  ) {
    this.etat = nouveauSalon({ nom, appareil }, config);
  }

  static async cree(nom: string, config: ConfigSalon): Promise<SessionHote> {
    const dev = reglagesDev();
    const { salons, ipsPubliques } = await salonsDuReseau(APP, dev.reseau);
    const annuaire = new Annuaire<AnnonceBandeja>({
      app: APP,
      salons,
      valideContenu: valideAnnonceBandeja,
      courtiers: dev.courtiers ?? undefined,
      testament: true,
    });
    await annuaire.ouvre();
    const s = new SessionHote(annuaire, ipsPubliques, idAleatoire(8), nom, config);
    annuaire.onSignal = (de, salon, sig) => void s.surSignal(de, salon, sig);
    s.annonce();
    return s;
  }

  private get presents(): Membre[] {
    return this.membres.filter((m) => m.appareil !== null);
  }

  /** La plus mauvaise latence parmi les appareils branchés. */
  get latenceMs(): number | null {
    let pire: number | null = null;
    for (const m of this.presents) {
      const ms = m.veille?.latenceMs ?? null;
      if (ms !== null && (pire === null || ms > pire)) pire = ms;
    }
    return pire;
  }

  /** Annonce la partie, y compris lancée : on peut toujours venir la regarder. */
  private annonce(): void {
    if (this.ferme_) return;
    const e = this.etat;
    this.annuaire.annonce({
      nom: e.sieges[0]!.nom,
      format: e.config.format,
      joueurs: siegesHumains(e).length,
      spect: e.spectateurs.length,
      enCours: e.phase !== 'attente',
      score: [this.score[0], this.score[1]],
    });
  }

  majScore(score: [number, number]): void {
    if (score[0] === this.score[0] && score[1] === this.score[1]) return;
    this.score = [score[0], score[1]];
    this.annonce();
  }

  private envoie(m: Membre, msg: MsgCtrl): void {
    m.l.envoieCtrl(msg);
  }

  /** Envoie l'état du salon à tous les appareils, et prévient l'app. */
  private diffuse(): void {
    const msg: MsgCtrl = { t: 'etat', e: this.etat };
    for (const m of this.presents) this.envoie(m, msg);
    this.annonce();
    this.onChange();
  }

  /** Action de l'hôte lui-même sur son salon. */
  agit(x: ActionHote): void {
    const exclu = x.a === 'exclut' ? this.etat.sieges[x.s]?.appareil : undefined;
    if (!appliqueActionHote(this.etat, x)) return;
    if (exclu) this.retire(this.presents.find((m) => m.appareil === exclu));
    this.diffuse();
    if (x.a === 'lance' || x.a === 'rejoue') this.onDebut();
  }

  /** Le match est fini : on passe à l'écran de fin chez tout le monde. */
  finMatch(): void {
    if (this.etat.phase !== 'jeu') return;
    this.etat.phase = 'fin';
    this.etat.pause = false;
    this.diffuse();
  }

  /** Pause (ou reprise) demandée par un joueur, hôte compris. */
  pause(oui: boolean): void {
    if (this.etat.phase !== 'jeu' || this.etat.pause === oui) return;
    this.etat.pause = oui;
    this.diffuse();
    this.onPause(oui);
  }

  /** Le message de début de match de chaque appareil : son siège (-1 : il regarde) et les réglages. */
  envoieDebut(graine: number): void {
    const e = this.etat;
    for (const m of this.presents) {
      this.envoie(m, {
        t: 'debut',
        siege: siegeDe(e, m.appareil!),
        niveau: e.config.niveau,
        jeux: e.config.jeux,
        sieges: siegesHumains(e),
        graine,
      });
    }
  }

  /** Commande d'un siège distant (COMMANDE_VIDE si le siège n'est pas à un humain connecté). */
  commande(siege: number, maintenant: number): Commande {
    const o = this.etat.sieges[siege];
    const m = o && this.presents.find((x) => x.appareil === o.appareil);
    return m ? m.entree.commande(maintenant) : COMMANDE_VIDE;
  }

  diffuseInstantane(s: Instantane): void {
    if (this.etat.phase === 'attente' || this.presents.length === 0) return;
    const buf = encodeInstantane(s);
    for (const m of this.presents) m.l.envoieJeu(buf);
  }

  diffuseEvenement(msg: MessageEvenement): void {
    const m: MsgCtrl = { t: 'evt', m: msg };
    for (const x of this.presents) this.envoie(x, m);
  }

  private async surSignal(de: string, salon: number, sig: Signal): Promise<void> {
    if (sig.type !== 'offre' || this.ferme_) return;
    if (
      nbPresents(this.etat) + this.membres.filter((m) => m.appareil === null).length >=
      4 + SPECTATEURS_MAX
    ) {
      await this.annuaire.signale(de, salon, { type: 'refus', raison: 'complet' });
      return;
    }
    const l = new Liaison(plageStricte(), this.ips);
    const m: Membre = {
      l,
      veille: null,
      appareil: null,
      entree: new EntreeDistante(),
      limiteCtrl: new Limiteur(CTRL_PAR_S, CTRL_RAFALE),
      limiteJeu: new Limiteur(JEU_PAR_S, JEU_RAFALE),
    };
    this.membres.push(m);
    try {
      const sdp = await l.accepteOffre(sig.sdp);
      await this.annuaire.signale(de, salon, { type: 'reponse', sdp });
      await l.ouverte();
    } catch {
      this.retire(m);
      return;
    }
    if (!this.membres.includes(m)) return;
    l.onCtrl = (o) => this.surCtrl(m, o);
    l.onJeu = (d) => {
      if (m.limiteJeu.accepte() && m.entree.recoit(d, performance.now() / 1000)) m.veille?.recuJeu();
    };
    l.onFerme = () => this.retire(m);
    m.veille = new Veille(l, () => l.ferme());
    setTimeout(() => {
      if (m.appareil === null) this.retire(m);
    }, PRESENTATION_MAX_MS);
  }

  private surCtrl(m: Membre, o: unknown): void {
    if (!this.membres.includes(m)) return;
    const msg = lisCtrl(o);
    if (!msg || m.veille?.recu(msg)) return;
    // au-delà de son débit, un appareil est ignoré : il ne sature ni l'hôte ni les autres
    if (!m.limiteCtrl.accepte()) return;
    const e = this.etat;
    if (msg.t === 'bonjour') {
      if (
        msg.v !== VERSION_PROTOCOLE ||
        m.appareil !== null ||
        !arrive(e, { nom: msg.nom, appareil: msg.appareil })
      ) {
        this.retire(m);
        return;
      }
      m.appareil = msg.appareil;
      this.diffuse();
      // un appareil qui arrive en plein match le prend en route, en spectateur
      if (e.phase !== 'attente') this.envoieDebut(Math.floor(Math.random() * 0xffffffff));
      return;
    }
    if (m.appareil === null) return;
    if (msg.t === 'action') {
      if (appliqueAction(e, m.appareil, msg.x)) this.diffuse();
    } else if (msg.t === 'pause') {
      if (siegeDe(e, m.appareil) >= 0) this.pause(msg.oui);
    } else if (msg.t === 'quitte') {
      this.retire(m);
    }
  }

  /** Un appareil part : son siège se libère, tout le monde est prévenu. */
  private retire(m: Membre | undefined): void {
    if (!m || !this.membres.includes(m)) return;
    this.membres = this.membres.filter((x) => x !== m);
    m.veille?.arrete();
    const appareil = m.appareil;
    m.l.onFerme = () => {};
    m.l.ferme();
    if (appareil === null || this.ferme_) return;
    const nom =
      [...this.etat.sieges, ...this.etat.spectateurs].find((o) => o?.appareil === appareil)?.nom ?? '';
    part(this.etat, appareil);
    // un joueur parti en plein match ramène tout le monde au salon : la partie ne peut pas continuer sans lui
    if (
      this.etat.phase !== 'attente' &&
      ![...this.etat.sieges].some((s) => s && s.appareil !== this.appareil)
    )
      this.etat.phase = 'attente';
    this.diffuse();
    this.onParti(nom);
  }

  ferme(): void {
    if (this.ferme_) return;
    this.ferme_ = true;
    for (const m of [...this.membres]) {
      if (m.appareil !== null) this.envoie(m, { t: 'quitte' });
      m.veille?.arrete();
      m.l.onFerme = () => {};
      m.l.ferme();
    }
    this.membres = [];
    this.annuaire.ferme();
  }
}
