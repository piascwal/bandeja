import { MoteurSon } from '@audio/son';
import { JEUX, NIVEAUX, PAS } from '@core/constants';
import { balleHaute } from '@core/humain';
import { nouvellePartie, pas } from '@core/partie';
import type { Partie } from '@core/types';
import { Entrees, type PointLogique } from '@input/entrees';
import type { OngletCommandes } from '@render/reglages';
import { construitDecor, type Decor } from '@render/decor';
import { Effets } from '@render/effets';
import { C } from '@render/palette';
import { Projection } from '@render/projection';
import { VueJoueurs } from '@render/regard';
import { chargeSprites, type SpritesEquipe } from '@render/sprites';
import { boutonSous, type ZoneBouton } from '@render/ui';
import type { Vue } from '@render/vue';
import { joueEvenements } from './evenements';
import { estAutonome, PleinEcranAuPremierGeste } from './plein-ecran';
import { chargePreferences, sauvePreferences, type Preferences } from './preferences';
import { ParcoursLan } from './parcours-lan';
import { rendu } from './rendu';

export type EcranUI = 'menu' | 'reglages' | 'lan-liste' | 'lan-salon' | 'jeu' | 'pause' | 'fin';

/**
 * L'application : canevas et mise à l'échelle, boucle de jeu à pas fixe,
 * écrans (menu, match, pause, fin), préférences. La simulation (src/core)
 * ne connaît rien de tout ça : on lui passe les commandes du joueur, et on
 * joue les évènements qu'elle émet.
 */
export class BandejaApp {
  readonly g: CanvasRenderingContext2D;
  readonly K = new Projection();
  readonly effets = new Effets();
  readonly vueJoueurs = new VueJoueurs();
  readonly pref: Preferences = chargePreferences();
  readonly son = new MoteurSon(this.pref.son);
  readonly entrees: Entrees;
  /** le multijoueur Wi-Fi : liste des parties, salle d'attente, match en réseau */
  readonly lan = new ParcoursLan(this);
  /** Taille logique de l'écran (gros pixels du décor) et facteur d'agrandissement. */
  W = 400;
  H = 200;
  ECHELLE = 1;
  portrait = false;
  decor: Decor | null = null;
  sprites: [SpritesEquipe, SpritesEquipe] | null = null;
  jeu: Partie;
  ecranUI: EcranUI = 'menu';
  /** onglet de l'aide des commandes dans les réglages */
  ongletCommandes: OngletCommandes = 'tactile';
  /** boutons de l'image en cours (recalculés à chaque image) */
  boutons: ZoneBouton[] = [];
  private readonly plein = new PleinEcranAuPremierGeste();
  /**
   * Hors app installée, un écran « appuyez pour commencer » couvre le menu :
   * ce premier geste ne fait que passer en plein écran, sans toucher JOUER,
   * pour que la bannière du navigateur ait disparu avant le match.
   */
  attenteDemarrage = !estAutonome();
  private dernier = 0;
  private cumul = 0;

  constructor(readonly ecran: HTMLCanvasElement) {
    this.g = ecran.getContext('2d')!;
    this.jeu = this.partie('demo');
    this.entrees = new Entrees(ecran, {
      dims: () => ({ W: this.W, H: this.H }),
      versLogique: (e) => this.versLogique(e),
      portrait: () => this.portrait,
      enJeu: () => this.ecranUI === 'jeu',
      aerienActif: () => balleHaute(this.jeu),
      geste: () => {
        this.son.init();
        if (!this.attenteDemarrage || this.ecranUI !== 'menu') return false;
        this.attenteDemarrage = false;
        return true;
      },
      pleinEcran: () => this.plein.tente(),
      pause: () => this.pause(true),
      basculePause: () => {
        if (this.ecranUI === 'reglages') this.ecranUI = 'menu';
        else if (this.ecranUI === 'lan-liste' || this.ecranUI === 'lan-salon') this.lan.quitte();
        else if (this.ecranUI === 'jeu' || this.ecranUI === 'pause') this.pause(this.ecranUI === 'jeu');
      },
      valide: () => {
        if (this.ecranUI === 'menu' || (this.ecranUI === 'fin' && !this.lan.actif)) this.lanceMatch();
        else if (this.ecranUI === 'pause') this.pause(false);
      },
      appuiInterface: (p) => this.appuiInterface(p),
    });
  }

  /** Charge les dessins, cale l'écran et lance la boucle. */
  async demarre(): Promise<void> {
    this.sprites = await chargeSprites(import.meta.env.BASE_URL);
    window.addEventListener('resize', () => this.dispose());
    window.addEventListener('orientationchange', () => setTimeout(() => this.dispose(), 120));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.ecranUI === 'jeu') this.pause(true);
    });
    this.dispose();
    this.dernier = performance.now();
    requestAnimationFrame((t) => this.boucle(t));
  }

  get vue(): Vue {
    return { g: this.g, W: this.W, H: this.H, K: this.K };
  }

  private partie(mode: 'match' | 'demo'): Partie {
    return this.adopte(nouvellePartie({ mode, niveau: this.pref.niveau, jeux: this.pref.jeux }));
  }

  /** Cale la vue sur le siège de cet écran : miroir ou non selon son équipe. */
  adopte(jeu: Partie): Partie {
    const miroir = jeu.humain?.miroir ?? true;
    this.K.miroir = miroir;
    this.vueJoueurs.miroir = miroir;
    return jeu;
  }

  /** Recalcule l'échelle, la projection et le décor quand la fenêtre change. */
  dispose(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const dw = Math.round(window.innerWidth * dpr);
    const dh = Math.round(window.innerHeight * dpr);
    this.ecran.width = dw;
    this.ecran.height = dh;
    this.portrait = window.innerHeight > window.innerWidth * 1.05;
    this.ECHELLE = Math.max(
      1,
      Math.floor(this.portrait ? Math.min(dh / 360, dw / 180) : Math.min(dh / 196, dw / 360)),
    );
    this.W = Math.ceil(dw / this.ECHELLE);
    this.H = Math.ceil(dh / this.ECHELLE);
    this.g.imageSmoothingEnabled = false;
    // en portrait, on prépare quand même la piste en paysage : elle sera prête au retournement
    const [lw, lh] = this.portrait ? [Math.max(this.W, this.H), Math.min(this.W, this.H)] : [this.W, this.H];
    this.K.place(lw, lh);
    this.decor = construitDecor(this.K, lw, lh);
  }

  private versLogique(e: PointerEvent): PointLogique {
    const r = this.ecran.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * (this.ecran.width / this.ECHELLE),
      y: ((e.clientY - r.top) / r.height) * (this.ecran.height / this.ECHELLE),
    };
  }

  private appuiInterface(p: PointLogique): void {
    const b = boutonSous(this.boutons, p.x, p.y);
    if (!b) return;
    this.son.clic();
    b.act();
  }

  // ------------------------------------------------------------ écrans

  lanceMatch(): void {
    this.son.init();
    this.plein.relance();
    this.jeu = this.partie('match');
    this.effets.vide();
    this.entrees.reinitialise();
    this.ecranUI = 'jeu';
    this.effets.annonce(
      'PRETS ?',
      `${NIVEAUX[this.pref.niveau]!.nom} - VOUS : EN HAUT A DROITE`,
      C.blanc,
      1.5,
    );
  }

  retourMenu(): void {
    this.jeu = this.partie('demo');
    this.ecranUI = 'menu';
    this.effets.banniere = null;
  }

  pause(oui: boolean): void {
    if (this.ecranUI !== 'jeu' && this.ecranUI !== 'pause') return;
    // en réseau, la pause est partagée : c'est l'hôte qui fige la partie pour tout le monde
    if (this.lan.actif) {
      this.lan.demandePause(oui);
      return;
    }
    this.ecranUI = oui ? 'pause' : 'jeu';
    this.entrees.reinitialise();
  }

  ouvreReglages(oui: boolean): void {
    this.ecranUI = oui ? 'reglages' : 'menu';
  }

  niveauSuivant(): void {
    this.pref.niveau = (this.pref.niveau + 1) % NIVEAUX.length;
    sauvePreferences(this.pref);
  }

  jeuxSuivants(): void {
    this.pref.jeux = (this.pref.jeux + 1) % JEUX.length;
    sauvePreferences(this.pref);
  }

  basculeSon(): void {
    this.pref.son = !this.pref.son;
    this.son.active(this.pref.son);
    sauvePreferences(this.pref);
  }

  private finMatch(): void {
    this.ecranUI = 'fin';
    this.entrees.reinitialise();
    const moi = this.jeu.humain?.eq ?? 0;
    const gagne = this.jeu.jeux[moi] > this.jeu.jeux[moi === 0 ? 1 : 0];
    const n = this.pref.niveau;
    this.pref.matchs[n] = (this.pref.matchs[n] ?? 0) + 1;
    if (gagne) this.pref.victoires[n] = (this.pref.victoires[n] ?? 0) + 1;
    sauvePreferences(this.pref);
  }

  // ------------------------------------------------------------ boucle

  private boucle(t: number): void {
    const dt = Math.min(0.05, (t - this.dernier) / 1000);
    this.dernier = t;
    const lan = this.lan;
    const actif = !this.portrait && this.ecranUI !== 'pause';
    lan.avance(dt);
    if (lan.actif && !lan.hote) {
      // invité : on ne simule rien, on dessine ce que l'hôte envoie
      if (!this.portrait && (this.ecranUI === 'jeu' || this.ecranUI === 'fin')) lan.tourInvite(dt);
    } else if (actif && this.ecranUI !== 'fin' && this.ecranUI !== 'lan-salon') {
      this.cumul += dt;
      if (lan.hote) this.cumul = lan.simuleHote(this.cumul);
      else {
        const lire = () => this.entrees.lireCommande();
        while (this.cumul >= PAS) {
          pas(this.jeu, PAS, lire);
          this.cumul -= PAS;
        }
      }
    }
    this.vueJoueurs.majTous(this.jeu);
    const evs = this.jeu.evenements.splice(0);
    joueEvenements(this.jeu, evs, this.effets, this.son, this.K);
    lan.diffuseApres(evs);
    if (!lan.actif && this.jeu.mode === 'match' && this.jeu.phase === 'fin' && this.ecranUI === 'jeu')
      this.finMatch();
    if (actif) this.effets.maj(dt);
    rendu(this, t / 1000);
    requestAnimationFrame((t2) => this.boucle(t2));
  }
}
