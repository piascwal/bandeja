import { Annuaire, Limiteur, idAleatoire, type Signal } from '@piascwal/lan-kit';
import { COMMANDE_VIDE } from '@core/partie';
import type { Commande } from '@core/types';
import { basculePause, finAbsence, marqueAbsent, Minuteries, revient } from './absences';
import { valideAnnonceBandeja, type AnnonceBandeja } from './annonce';
import { lisCtrl, type MsgCtrl } from './ctrl';
import { CANAL_LOCAL, creeLiaison, creeVeille, ouvreReseau, type Canal, type Reseau } from './canal';
import { delaiReconnexion, reglagesDev } from './dev';
import type { Membre } from './membre';
import { EntreeDistante } from './entrees';
import type { MessageEvenement } from './evenements';
import { encodeInstantane, type Instantane } from './instantane';
import { calculePings, PINGS_VIDES, type Pings } from './pings';
import { APP, SPECTATEURS_MAX, VERSION_PROTOCOLE } from './protocole';
import {
  appliqueAction,
  appliqueActionHote,
  arrive,
  nbPresents,
  nouveauSalon,
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

/**
 * Session de l'hôte : il est le serveur. Il annonce la partie sur le Wi-Fi,
 * accepte les appareils (liaison WebRTC locale), arbitre le salon, simule le
 * match et le diffuse. Un invité ne lui envoie jamais que des intentions.
 * Un joueur qui perd la connexion en plein match garde son siège un moment.
 */
export class SessionHote {
  readonly etat: EtatSalon;
  /** l'état du salon a changé (un appareil arrive, part, choisit un siège...) */
  onChange: () => void = () => {};
  /** l'hôte a lancé (ou relancé) le match : l'app crée la partie */
  onDebut: () => void = () => {};
  /** un joueur demande la pause (ou la reprise) : l'app fige ou relance la simulation */
  onPause: (oui: boolean) => void = () => {};
  /** un appareil est parti pour de bon : son nom, pour l'afficher */
  onParti: (nom: string) => void = () => {};
  /** un joueur est revenu après une coupure : l'app lui renvoie le match en cours */
  onRevenu: (nom: string) => void = () => {};

  /** la latence de chaque siège vue par l'hôte (ms), renvoyée à tous chaque seconde : null si inconnue ou si c'est un CPU */
  pings: Pings = PINGS_VIDES();
  private tPings = 0;
  private membres: Membre[] = [];
  /** le siège de chaque joueur absent, et ce qui prouve son identité s'il revient */
  private readonly gardes = new Map<number, { appareil: string; jeton: string }>();
  private readonly minuteries = new Minuteries();
  private score: [number, number] = [0, 0];
  private ferme_ = false;

  private constructor(
    private readonly annuaire: Annuaire<AnnonceBandeja>,
    private readonly reseau: Reseau,
    readonly canal: Canal,
    readonly appareil: string,
    nom: string,
    config: ConfigSalon,
  ) {
    this.etat = nouveauSalon({ nom, appareil }, config);
  }

  static async cree(nom: string, config: ConfigSalon, canal: Canal = CANAL_LOCAL): Promise<SessionHote> {
    const dev = reglagesDev();
    const reseau = await ouvreReseau(canal);
    const annuaire = new Annuaire<AnnonceBandeja>({
      app: APP,
      salons: reseau.salons,
      valideContenu: valideAnnonceBandeja,
      courtiers: dev.courtiers ?? undefined,
      testament: true,
    });
    await annuaire.ouvre();
    const s = new SessionHote(annuaire, reseau, canal, idAleatoire(8), nom, config);
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

  /** Code de vérification de la liaison d'un appareil. */
  codeDe(appareil: string): string | null {
    return this.presents.find((m) => m.appareil === appareil)?.code ?? null;
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

  /** Envoie l'état du salon à tous les appareils, et prévient l'app (`annonce` : l'annonce réseau change aussi). */
  private diffuse(annonce = true): void {
    const msg: MsgCtrl = { t: 'etat', e: this.etat };
    for (const m of this.presents) m.l.envoieCtrl(msg);
    if (annonce) this.annonce();
    this.onChange();
  }

  /** Action de l'hôte lui-même sur son salon. */
  agit(x: ActionHote): void {
    const exclu = x.a === 'exclut' ? this.etat.sieges[x.s]?.appareil : undefined;
    if (!appliqueActionHote(this.etat, x)) return;
    if (exclu) this.retire(this.presents.find((m) => m.appareil === exclu));
    if (x.a === 'rejoue' || x.a === 'salon') this.score = [0, 0];
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
    if (!basculePause(this.etat, oui)) return;
    this.diffuse();
    this.onPause(oui);
  }

  /** À appeler à chaque image : fait avancer l'attente d'un joueur absent et le compte à rebours de reprise. */
  avance(dt: number): void {
    this.tPings += dt;
    if (this.tPings >= 1) {
      this.tPings = 0;
      this.majPings();
    }
    const r = this.minuteries.avance(this.etat, dt);
    if (r === 'seconde') this.diffuse(false);
    else if (r === 'fini') this.liberePlacesAbsentes();
  }

  /** Mesure la latence de chaque siège et la renvoie à tous. */
  private majPings(): void {
    this.pings = calculePings(
      this.etat,
      this.presents.map((m) => ({ appareil: m.appareil, latenceMs: m.veille?.latenceMs ?? null })),
    );
    const msg: MsgCtrl = { t: 'pings', p: this.pings };
    for (const m of this.presents) m.l.envoieCtrl(msg);
  }

  /** L'hôte n'attend plus les joueurs absents : leurs sièges se libèrent, le CPU les remplace. */
  arreteAttente(): void {
    if (this.etat.absents.length > 0) this.liberePlacesAbsentes();
  }

  private liberePlacesAbsentes(): void {
    const noms = finAbsence(this.etat);
    this.gardes.clear();
    this.diffuse();
    for (const nom of noms) this.onParti(nom);
  }

  /** Le message de début de match d'un appareil : son siège (-1 : il regarde) et les réglages. */
  private debutPour(m: Membre, graine: number): void {
    const e = this.etat;
    m.l.envoieCtrl({
      t: 'debut',
      siege: siegeDe(e, m.appareil!),
      niveau: e.config.niveau,
      jeux: e.config.jeux,
      sieges: siegesHumains(e),
      graine,
    });
  }

  envoieDebut(graine: number): void {
    for (const m of this.presents) this.debutPour(m, graine);
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
    for (const x of this.presents) x.l.envoieCtrl(m);
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
    const l = creeLiaison(this.reseau);
    const m: Membre = {
      l,
      veille: null,
      appareil: null,
      jeton: '',
      code: null,
      entree: new EntreeDistante(),
      limiteCtrl: new Limiteur(CTRL_PAR_S, CTRL_RAFALE),
      limiteJeu: new Limiteur(JEU_PAR_S, JEU_RAFALE),
    };
    this.membres.push(m);
    try {
      const sdp = await l.accepteOffre(sig.sdp);
      await this.annuaire.signale(de, salon, { type: 'reponse', sdp });
      await l.ouverte();
      m.code = await l.codeVerification();
    } catch {
      this.retire(m);
      return;
    }
    if (!this.membres.includes(m)) return;
    l.onCtrl = (o) => this.surCtrl(m, o);
    l.onJeu = (d) => {
      if (m.limiteJeu.accepte() && m.entree.recoit(d, performance.now() / 1000)) m.veille?.recuJeu();
    };
    l.onFerme = () => this.lache(m);
    m.veille = creeVeille(l, this.reseau, () => l.ferme());
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
      if (msg.v !== VERSION_PROTOCOLE || m.appareil !== null) return this.retire(m);
      // un joueur absent revient avec son jeton : il retrouve son siège
      const siege = [...this.gardes].find(
        ([, g]) => g.appareil === msg.appareil && g.jeton === msg.jeton,
      )?.[0];
      if (siege !== undefined) {
        this.gardes.delete(siege);
        Object.assign(m, { appareil: msg.appareil, jeton: msg.jeton });
        revient(e, siege);
        this.diffuse();
        this.debutPour(m, Math.floor(Math.random() * 0xffffffff));
        this.onRevenu(msg.nom);
        return;
      }
      if (!arrive(e, { nom: msg.nom, appareil: msg.appareil })) return this.retire(m);
      Object.assign(m, { appareil: msg.appareil, jeton: msg.jeton });
      this.diffuse();
      // un appareil qui arrive en plein match le prend en route, en spectateur
      if (e.phase !== 'attente') this.debutPour(m, Math.floor(Math.random() * 0xffffffff));
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

  /**
   * La liaison d'un appareil est tombée. En plein match, un joueur assis garde
   * son siège (la partie attend son retour) ; sinon l'appareil est simplement retiré.
   */
  private lache(m: Membre): void {
    const siege = m.appareil ? siegeDe(this.etat, m.appareil) : -1;
    if (!this.ferme_ && siege > 0 && marqueAbsent(this.etat, siege, delaiReconnexion())) {
      this.gardes.set(siege, { appareil: m.appareil!, jeton: m.jeton });
      this.ferme(m);
      this.diffuse();
      return;
    }
    this.retire(m);
  }

  private ferme(m: Membre): void {
    this.membres = this.membres.filter((x) => x !== m);
    m.veille?.arrete();
    m.l.onFerme = () => {};
    m.l.ferme();
  }

  /** Un appareil part pour de bon : son siège se libère, tout le monde est prévenu. */
  private retire(m: Membre | undefined): void {
    if (!m || !this.membres.includes(m)) return;
    this.ferme(m);
    const appareil = m.appareil;
    if (appareil === null || this.ferme_) return;
    const nom =
      [...this.etat.sieges, ...this.etat.spectateurs].find((o) => o?.appareil === appareil)?.nom ?? '';
    part(this.etat, appareil);
    this.diffuse();
    this.onParti(nom);
  }

  fermeSession(): void {
    if (this.ferme_) return;
    this.ferme_ = true;
    for (const m of [...this.membres]) {
      if (m.appareil !== null) m.l.envoieCtrl({ t: 'quitte' });
      this.ferme(m);
    }
    this.annuaire.ferme();
  }
}
