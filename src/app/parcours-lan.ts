import { JEUX, NIVEAUX, PAS } from '@core/constants';
import { graine } from '@core/aleatoire';
import { donneAuCpu } from '@core/humain';
import { nouvellePartie, pas } from '@core/partie';
import type { Evenement, Joueur } from '@core/types';
import { appliqueInstantane, rafraichitPrevision } from '../net/appliquer';
import { FORMATS, NOMS_FORMATS, peutLancer, siegeOuvert, type Format } from '../net/formats';
import { instantaneDe } from '../net/instantane';
import { Synchro } from '../net/synchro';
import { SessionClient, type DebutMatch, type RaisonFin } from '../net/session-client';
import { SessionHote } from '../net/session-hote';
import { occupes, siegesHumains, type EtatSalon } from '../net/salon';
import type { LignePartie, VueListe } from '@render/lan-liste';
import type { VueSalon } from '@render/lan-salon';
import { C } from '@render/palette';
import type { BandejaApp } from './app';
import { joueEvenements } from './evenements';

const MESSAGES_FIN: Record<RaisonFin, string> = {
  quitte: 'L HOTE A QUITTE LA PARTIE',
  perdu: 'CONNEXION PERDUE',
  complet: 'PARTIE COMPLETE',
  version: 'VERSION DIFFERENTE : METTEZ A JOUR',
  spectateurs: 'PLUS DE PLACE POUR REGARDER',
  injoignable: 'PARTIE INTROUVABLE',
};

/**
 * Le parcours « multi Wi-Fi » : la liste des parties, la salle d'attente, et
 * le match en réseau. L'hôte simule comme en solo, avec les commandes des
 * sièges distants en plus ; l'invité ne simule rien, il dessine l'état reçu.
 */
export class ParcoursLan {
  hote: SessionHote | null = null;
  client: SessionClient | null = null;
  phaseListe: VueListe['phase'] = 'recherche';
  message: string | null = null;
  private readonly synchro = new Synchro();
  private seq = 0;
  /** la session en cours d'ouverture quand on la ferme : à refermer dès qu'elle arrive */
  private annule = false;

  constructor(private readonly app: BandejaApp) {}

  /** Une partie en réseau est en cours (ou le salon d'une partie) : la boucle ne simule plus comme en solo. */
  get actif(): boolean {
    return this.hote !== null || (this.client !== null && this.client.etat !== null);
  }

  private get etat(): EtatSalon | null {
    return this.hote?.etat ?? this.client?.etat ?? null;
  }

  // ------------------------------------------------------------ navigation

  /** Menu → liste des parties du Wi-Fi. */
  ouvre(): void {
    this.fermeSessions();
    this.annule = false;
    this.message = null;
    this.phaseListe = 'recherche';
    this.app.ecranUI = 'lan-liste';
    SessionClient.cree(this.app.pref.nom)
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
  cree(): void {
    this.client?.ferme();
    this.client = null;
    this.phaseListe = 'connexion';
    const a = this.app;
    SessionHote.cree(a.pref.nom, { format: 'coop', niveau: a.pref.niveau, jeux: a.pref.jeux })
      .then((h) => {
        if (this.annule || a.ecranUI !== 'lan-liste') return h.ferme();
        this.hote = h;
        h.onChange = () => this.surEtat();
        h.onDebut = () => this.debutHote();
        h.onPause = (oui) => this.appliquePause(oui);
        h.onParti = (nom) => (this.message = nom ? `${nom} EST PARTI` : null);
        a.ecranUI = 'lan-salon';
      })
      .catch(() => {
        this.phaseListe = 'erreur';
        this.message = 'RESEAU INTROUVABLE';
      });
  }

  /** Rejoint une partie de la liste. */
  rejoint(id: string): void {
    const c = this.client;
    const partie = c?.parties.find((p) => p.id === id);
    if (!c || !partie) return;
    this.phaseListe = 'connexion';
    this.message = null;
    c.onEtat = () => this.surEtat();
    c.onDebut = (d) => this.debutInvite(d);
    c.onInstantane = (s) => this.synchro.recoit(s, performance.now());
    c.onEvenement = (m) => this.synchro.recoitEvenement(m.e, m.t);
    c.rejoint(partie).catch((e: Error) => {
      this.phaseListe = 'pret';
      this.message = MESSAGES_FIN[e.message as RaisonFin] ?? MESSAGES_FIN.injoignable;
    });
  }

  /** L'hôte ferme sa partie, ou l'invité la quitte : retour au menu. */
  quitte(message: string | null = null): void {
    this.annule = true;
    this.fermeSessions();
    this.message = message;
    this.app.retourMenu();
  }

  private fermeSessions(): void {
    this.hote?.ferme();
    this.client?.quitte();
    this.hote = null;
    this.client = null;
  }

  private surFinInvite(raison: RaisonFin): void {
    this.client = null;
    this.app.retourMenu();
    this.ouvre(); // retour à la liste, avec la raison
    this.message = MESSAGES_FIN[raison];
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
    this.synchro.reinitialise();
    if (oui && a.ecranUI === 'jeu') a.ecranUI = 'pause';
    else if (!oui && a.ecranUI === 'pause') a.ecranUI = 'jeu';
    a.entrees.reinitialise();
  }

  /** Pause demandée par cet appareil. */
  demandePause(oui: boolean): void {
    if (this.hote) this.hote.pause(oui);
    else this.client?.pause(oui);
  }

  // ------------------------------------------------------------ le match

  private creeJeu(sieges: number[], local: number, niveau: number, jeux: number, rng?: () => number): void {
    const a = this.app;
    a.jeu = a.adopte(nouvellePartie({ mode: 'match', niveau, jeux, sieges, local, rng }));
    a.vueJoueurs.reinitialise();
    a.effets.vide();
    a.entrees.reinitialise();
    this.synchro.reinitialise();
    this.seq = 0;
    a.ecranUI = 'jeu';
    a.effets.annonce('PRETS ?', `${NOMS_FORMATS[this.etat?.config.format ?? 'coop']}`, C.blanc, 1.5);
  }

  private debutHote(): void {
    const h = this.hote;
    if (!h) return;
    const g = Math.floor(Math.random() * 0xffffffff);
    this.creeJeu(siegesHumains(h.etat), 0, h.etat.config.niveau, h.etat.config.jeux);
    h.envoieDebut(g);
  }

  private debutInvite(d: DebutMatch): void {
    this.creeJeu(d.sieges, d.siege, d.niveau, d.jeux, graine(d.graine));
  }

  /** Côté hôte : fait avancer la simulation de ce qui s'est écoulé, avec les commandes de chaque siège. Renvoie le reste. */
  simuleHote(cumul: number): number {
    const a = this.app;
    const h = this.hote!;
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
    if (a.ecranUI === 'jeu') c?.envoieCommande(a.entrees.lireCommande());
  }

  // ------------------------------------------------------------ vues

  vueListe(): VueListe {
    const c = this.client;
    const parties: LignePartie[] = (c?.parties ?? []).map((p) => ({
      id: p.id,
      nom: p.nom,
      format: NOMS_FORMATS[p.format],
      joueurs: p.joueurs,
      spect: p.spect,
      enCours: p.enCours,
      score: p.score,
    }));
    return {
      phase: this.phaseListe,
      message: this.message,
      parties,
      onRejoint: (id) => this.rejoint(id),
      onCree: () => this.cree(),
      onActualise: () => this.actualise(),
      onRetour: () => this.quitte(),
    };
  }

  vueSalon(): VueSalon | null {
    const e = this.etat;
    if (!e) return null;
    const moi = this.hote?.appareil ?? this.client?.appareil ?? '';
    const h = this.hote;
    const c = this.client;
    const f = e.config.format;
    const suivant = <T>(liste: readonly T[], i: number): T => liste[(i + 1) % liste.length]!;
    return {
      sieges: e.sieges.map((s, i) => (s ? { nom: s.nom, moi: s.appareil === moi, hote: i === 0 } : null)),
      ouverts: [0, 1, 2, 3].map((i) => siegeOuvert(f, i)),
      spectateurs: e.spectateurs.length,
      format: NOMS_FORMATS[f],
      niveau: NIVEAUX[e.config.niveau]!.nom,
      jeux: `${JEUX[e.config.jeux]} JEUX`,
      jeSuisHote: h !== null,
      monSiege: e.sieges.findIndex((s) => s?.appareil === moi),
      peutLancer: peutLancer(f, occupes(e)),
      latenceMs: h?.latenceMs ?? c?.latenceMs ?? null,
      message: this.message,
      onSiege: (s) => c?.agit({ a: 'siege', s }),
      onRegarde: () => c?.agit({ a: 'regarde' }),
      onExclut: (s) => h?.agit({ a: 'exclut', s }),
      onFormat: () => h?.agit({ a: 'format', f: suivant<Format>(FORMATS, FORMATS.indexOf(f)) }),
      onNiveau: () => h?.agit({ a: 'niveau', n: (e.config.niveau + 1) % NIVEAUX.length }),
      onJeux: () => h?.agit({ a: 'jeux', n: (e.config.jeux + 1) % JEUX.length }),
      onLance: () => h?.agit({ a: 'lance' }),
      onQuitte: () => this.quitte(),
    };
  }
}
