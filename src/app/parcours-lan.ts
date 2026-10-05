import { PAS } from '@core/constants';
import { graine } from '@core/aleatoire';
import { donneAuCpu } from '@core/humain';
import { nouvellePartie, pas } from '@core/partie';
import type { Evenement, Joueur } from '@core/types';
import { appliqueInstantane, rafraichitPrevision } from '../net/appliquer';
import { NOMS_FORMATS } from '../net/formats';
import { instantaneDe } from '../net/instantane';
import { Synchro } from '../net/synchro';
import {
  MESSAGES_FIN,
  SessionClient,
  type DebutMatch,
  type Identite,
  type RaisonFin,
} from '../net/session-client';
import { SessionHote } from '../net/session-hote';
import { CANAL_LOCAL, type Canal } from '../net/canal';
import { delaiReconnexion } from '../net/dev';
import { jeuActif, siegesHumains, type EtatSalon } from '../net/salon';
import type { VueListe } from '@render/lan-liste';
import type { AttenteLan } from '@render/lan-etats';
import { C } from '@render/palette';
import type { BandejaApp } from './app';
import { joueEvenements } from './evenements';
import { ParcoursLigne } from './parcours-ligne';
import { Reconnexion } from './reconnexion-lan';
import { construitVueAttente, type ContexteVues } from './vues-lan';

/**
 * Le parcours « multi Wi-Fi » : la liste des parties, la salle d'attente, et
 * le match en réseau. L'hôte simule comme en solo, avec les commandes des
 * sièges distants en plus ; l'invité ne simule rien, il dessine l'état reçu.
 */
export class ParcoursLan {
  /** le parcours du jeu en ligne (choix du mode, création et recherche de salon) */
  readonly ligne: ParcoursLigne;
  hote: SessionHote | null = null;
  client: SessionClient | null = null;
  /** où se retrouvent les joueurs : le Wi-Fi, ou le salon d'un code */
  canal: Canal = CANAL_LOCAL;
  phaseListe: VueListe['phase'] = 'recherche';
  message: string | null = null;
  private readonly synchro = new Synchro();
  private seq = 0;
  /** la session en cours d'ouverture quand on la ferme : à refermer dès qu'elle arrive */
  private annule = false;
  /** essais de retour de CET appareil dans le match qu'il vient de perdre */
  private reco: Reconnexion | null = null;

  constructor(private readonly app: BandejaApp) {
    this.ligne = new ParcoursLigne(app, this);
  }

  /** Une partie en réseau est en cours (ou le salon d'une partie) : la boucle ne simule plus comme en solo. */
  get actif(): boolean {
    return this.hote !== null || this.reco !== null || (this.client !== null && this.client.etat !== null);
  }

  private get etat(): EtatSalon | null {
    return this.hote?.etat ?? this.client?.etat ?? null;
  }

  // ------------------------------------------------------------ navigation

  /** L'écran des parties : la liste du Wi-Fi, ou l'accueil du jeu en ligne. */
  private get ecranListe(): 'lan-liste' | 'ligne' {
    return this.canal.type === 'ligne' ? 'ligne' : 'lan-liste';
  }

  /** Retour à l'écran des parties, avec le message qui explique pourquoi. */
  private versListe(message: string): void {
    this.app.retourMenu();
    if (this.canal.type === 'ligne') {
      this.phaseListe = 'pret';
      this.app.ecranUI = 'ligne';
    } else this.ouvre();
    this.message = message;
  }

  /** Menu → liste des parties du Wi-Fi, ou (avec un code) recherche du salon en ligne. */
  ouvre(canal: Canal = CANAL_LOCAL): void {
    this.fermeSessions();
    this.canal = canal;
    this.annule = false;
    this.message = null;
    this.phaseListe = 'recherche';
    this.app.ecranUI = this.ecranListe;
    SessionClient.cree(this.app.pref.nom, undefined, canal)
      .then((c) => {
        if (this.annule) return c.ferme();
        this.client = c;
        c.onListe = () => {};
        c.onFin = (raison) => this.surFinInvite(raison);
        this.phaseListe = 'pret';
      })
      .catch(() => {
        this.phaseListe = 'erreur';
      });
  }

  actualise(): void {
    // après une erreur de réseau, on relance toute la recherche
    if (this.phaseListe === 'erreur' || !this.client) this.ouvre();
    else this.client.actualise();
  }

  /** Crée une partie : cet appareil devient le serveur. */
  cree(canal: Canal = this.canal): void {
    this.client?.ferme();
    this.client = null;
    this.canal = canal;
    this.annule = false;
    this.phaseListe = 'connexion';
    const a = this.app;
    const config = { format: 'coop', niveau: a.pref.niveau, jeux: a.pref.jeux } as const;
    SessionHote.cree(a.pref.nom, config, canal)
      .then((h) => {
        if (this.annule || a.ecranUI !== this.ecranListe) return h.fermeSession();
        this.hote = h;
        h.onChange = () => this.surEtat();
        h.onDebut = () => this.debutHote();
        h.onPause = (oui) => this.appliquePause(oui);
        h.onParti = (nom) => (this.message = nom ? `${nom} EST PARTI` : null);
        a.ecranUI = 'lan-salon';
      })
      .catch(() => {
        this.phaseListe = 'erreur';
        this.message = this.canal.type === 'ligne' ? 'INTERNET INTROUVABLE' : 'RESEAU INTROUVABLE';
      });
  }

  /** Rejoint une partie de la liste. */
  rejoint(id: string): void {
    const c = this.client;
    const partie = c?.parties.find((p) => p.id === id);
    if (!c || !partie) return;
    this.phaseListe = 'connexion';
    this.message = null;
    this.branche(c);
    c.rejoint(partie).catch((e: Error) => {
      this.phaseListe = 'pret';
      this.message = MESSAGES_FIN[e.message as RaisonFin] ?? MESSAGES_FIN.injoignable;
    });
  }

  /** Branche une session d'invité sur le jeu : état du salon, début de match, instantanés et évènements. */
  private branche(c: SessionClient): void {
    c.onEtat = () => this.surEtat();
    c.onDebut = (d) => this.debutInvite(d);
    c.onInstantane = (s) => this.synchro.recoit(s, performance.now());
    c.onEvenement = (m) => this.synchro.recoitEvenement(m.e, m.t);
    c.onFin = (raison) => this.surFinInvite(raison);
  }

  /** L'hôte ferme sa partie, ou l'invité la quitte : retour au menu. */
  quitte(message: string | null = null): void {
    this.annule = true;
    this.reco?.arrete();
    this.reco = null;
    this.fermeSessions();
    this.message = message;
    this.app.retourMenu();
  }

  private fermeSessions(): void {
    this.hote?.fermeSession();
    this.client?.quitte();
    this.hote = null;
    this.client = null;
  }

  private surFinInvite(raison: RaisonFin): void {
    const c = this.client;
    const e = c?.etat;
    // connexion coupée en plein match, assis : on essaie de revenir à son siège
    if (raison === 'perdu' && c && e && e.phase === 'jeu' && c.idHote) {
      const assis = e.sieges.findIndex((s) => s?.appareil === c.appareil) > 0;
      if (assis) return this.reconnecte(c.identite, c.idHote);
    }
    this.client = null;
    this.versListe(MESSAGES_FIN[raison]);
  }

  private reconnecte(identite: Identite, idHote: string): void {
    this.client = null;
    this.reco = new Reconnexion({
      nom: this.app.pref.nom,
      canal: this.canal,
      identite,
      idHote,
      delaiS: delaiReconnexion(),
      branche: (c) => {
        this.client = c;
        this.branche(c);
      },
      reussi: () => {
        this.reco = null;
        this.synchro.reinitialise();
      },
      echec: () => {
        this.reco = null;
        this.client = null;
        this.versListe(MESSAGES_FIN.perdu);
      },
    });
  }

  // ------------------------------------------------------------ états partagés

  /** L'état du salon a changé : l'écran suit la phase de la partie. */
  private surEtat(): void {
    const e = this.etat;
    const a = this.app;
    if (!e) return;
    const enMatch = a.ecranUI === 'jeu' || a.ecranUI === 'pause';
    // un siège libéré en cours de partie : le CPU reprend son joueur
    if (enMatch || a.ecranUI === 'fin') e.sieges.forEach((o, i) => (o ? null : donneAuCpu(a.jeu, i)));
    if (e.phase === 'attente' && a.ecranUI !== 'lan-salon') a.ecranUI = 'lan-salon';
    else if (e.phase === 'fin' && enMatch) a.ecranUI = 'fin';
    else if (e.phase === 'jeu' && enMatch) this.appliquePause(e.pause);
  }

  private appliquePause(oui: boolean): void {
    const a = this.app;
    if (oui && a.ecranUI === 'jeu') a.ecranUI = 'pause';
    else if (!oui && a.ecranUI === 'pause') a.ecranUI = 'jeu';
    else return;
    this.synchro.reinitialise();
    a.entrees.reinitialise();
  }

  /** Pause demandée par cet appareil. */
  demandePause(oui: boolean): void {
    if (this.hote) this.hote.pause(oui);
    else this.client?.pause(oui);
  }

  // ------------------------------------------------------------ le match

  private creeJeu(
    sieges: number[],
    local: number,
    niveau: number,
    jeux: number,
    rng?: () => number,
    aide = false,
  ): void {
    const a = this.app;
    a.jeu = a.adopte(nouvellePartie({ mode: 'match', niveau, jeux, sieges, local, rng, aide }));
    a.vueJoueurs.reinitialise();
    a.effets.vide();
    a.ralenti.reinitialise();
    a.entrees.reinitialise();
    this.synchro.reinitialise();
    this.seq = 0;
    a.ecranUI = 'jeu';
    a.effets.annonce(
      'PRETS ?',
      `${NOMS_FORMATS[this.etat?.config.format ?? 'coop']}${a.jeu.humain ? ` - VOUS : A ${a.jeu.humain.eq === 0 ? 'DROITE' : 'GAUCHE'}` : ''}`,
      C.blanc,
      1.5,
    );
  }

  private debutHote(): void {
    const h = this.hote;
    if (!h) return;
    const g = Math.floor(Math.random() * 0xffffffff);
    // c'est l'hôte qui simule : son réglage d'aide au déplacement vaut pour tous les joueurs
    this.creeJeu(
      siegesHumains(h.etat),
      0,
      h.etat.config.niveau,
      h.etat.config.jeux,
      undefined,
      this.app.pref.aide,
    );
    h.envoieDebut(g);
  }

  private debutInvite(d: DebutMatch): void {
    this.creeJeu(d.sieges, d.siege, d.niveau, d.jeux, graine(d.graine));
  }

  /** Côté hôte : fait avancer la simulation de ce qui s'est écoulé, avec les commandes de chaque siège. Renvoie le reste. */
  simuleHote(cumul: number): number {
    const a = this.app;
    const h = this.hote!;
    // un joueur absent, ou la reprise après une pause : le match est figé, on ne rattrape rien
    if (!jeuActif(h.etat)) return 0;
    const lire = (s: Joueur) =>
      s.id === 0 ? a.entrees.lireCommande() : h.commande(s.id, performance.now() / 1000);
    while (cumul >= PAS) {
      pas(a.jeu, PAS, lire);
      cumul -= PAS;
    }
    h.diffuseInstantane(instantaneDe(a.jeu, this.seq++));
    return cumul;
  }

  /** Côté hôte, après chaque image : les évènements (sons, effets) partent chez les autres, ainsi que le score et la fin. */
  diffuseApres(evs: readonly Evenement[]): void {
    const a = this.app;
    const h = this.hote;
    if (!h) return;
    for (const e of evs) h.diffuseEvenement({ t: a.jeu.temps, e });
    h.majScore([a.jeu.jeux[0], a.jeu.jeux[1]]);
    if (a.jeu.phase === 'fin') h.finMatch();
  }

  /** À chaque image : l'hôte fait avancer les attentes (absents, reprise). */
  avance(dt: number): void {
    this.hote?.avance(dt);
  }

  /** Un tour de boucle côté invité : on dessine l'état reçu, et on envoie sa commande. */
  tourInvite(dt: number): void {
    const a = this.app;
    const c = this.client;
    const maintenant = performance.now();
    const s = this.synchro.echantillon(maintenant);
    if (s) {
      appliqueInstantane(a.jeu, s);
      rafraichitPrevision(a.jeu, dt);
    }
    joueEvenements(a.jeu, this.synchro.evenementsAJouer(maintenant), a.effets, a.son, a.K);
    if (a.ecranUI === 'jeu' && c?.etat && jeuActif(c.etat)) c.envoieCommande(a.entrees.lireCommande());
  }

  // ------------------------------------------------------------ vues

  /** Ce que les écrans du multijoueur ont besoin de savoir et de pouvoir faire. */
  contexte(): ContexteVues {
    return {
      hote: this.hote,
      client: this.client,
      etat: this.etat,
      phaseListe: this.phaseListe,
      message: this.message,
      rejoint: (id) => this.rejoint(id),
      cree: () => this.cree(),
      actualise: () => this.actualise(),
      quitte: () => this.quitte(),
      reconnexion: this.reco !== null,
      enJeu: this.app.ecranUI === 'jeu',
      canal: this.canal,
      copie: this.ligne.copie,
      partage: (code) => this.ligne.partage(code),
    };
  }

  /** Ce qui fige le match à l'écran : joueurs absents, retour du jeu, ou cet appareil qui se reconnecte. */
  vueAttente(): AttenteLan | null {
    return construitVueAttente(this.contexte());
  }
}
