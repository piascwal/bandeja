import { dessineCommandes } from '@render/commandes';
import { dessineFinale } from '@render/finale-vue';
import { dessineParade } from '@render/parade-vue';
import { dessineFissure } from '@render/fissure';
import { dessineEchange } from '@render/hud-echange';
import { dessineBanniere, dessineJauge, dessineTableau } from '@render/hud';
import { dessineChoix } from '@render/lan-choix';
import { dessineLigne } from '@render/ligne-accueil';
import { dessinePings } from '@render/hud-ping';
import { dessineAttente } from '@render/lan-etats';
import { dessineListe } from '@render/lan-liste';
import { dessineSalon } from '@render/lan-salon';
import { dessineCommandesAide } from '@render/commandes-aide';
import { dessineReglages } from '@render/reglages';
import { dessineDemarrage, dessineFin, dessineMenu, dessinePause, dessinePortrait } from '@render/menus';
import { C } from '@render/palette';
import { dessineMiseAJour, dessineRappelMiseAJour } from '@render/mise-a-jour-vue';
import { dessineRalenti } from '@render/ralenti-vue';
import { dessineScene } from '@render/scene';
import type { BandejaApp } from './app';
import { saisitPseudo } from './pseudo';
import { construitPings, construitVueListe, construitVueSalon } from './vues-lan';

const secousseAleatoire = (s: number) => (s > 0.2 ? Math.round((Math.random() * 2 - 1) * s) : 0);

/** Dessine une image : la piste (secouée par les gros impacts), le tableau, puis l'écran en cours. */
export function rendu(app: BandejaApp, t: number): void {
  const { g, ECHELLE: E, W, H, ecranUI, jeu, effets } = app;
  const v = app.vue;
  app.boutons = [];
  g.setTransform(E, 0, 0, E, 0, 0);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  if (app.portrait) {
    dessinePortrait(v, t);
    return;
  }
  if (!app.decor || !app.sprites) return;
  const horsMatch =
    ecranUI === 'menu' ||
    ecranUI === 'multi-choix' ||
    ecranUI === 'ligne' ||
    ecranUI === 'reglages' ||
    ecranUI === 'commandes' ||
    ecranUI === 'lan-liste' ||
    ecranUI === 'lan-salon';
  g.fillStyle = C.nuit;
  g.fillRect(0, 0, W, H);
  const secousse = app.pref.secoussesReduites ? 0 : effets.secousse;
  const sx = secousseAleatoire(secousse);
  const sy = secousseAleatoire(secousse);
  g.setTransform(E, 0, 0, E, sx * E, sy * E);
  const rejeu = app.ralenti.actif && ecranUI === 'jeu';
  // le coup de caméra de la fin d'un super coup : zoom sur l'impact
  const zoom = rejeu ? 1 : effets.finale.zoom;
  if (zoom !== 1) {
    const { x, y } = effets.finale;
    g.translate(x, y);
    g.scale(zoom, zoom);
    g.translate(-x, -y);
  }
  dessineScene(v, {
    jeu: rejeu ? app.ralenti.jeu : jeu,
    decor: app.decor,
    sprites: app.sprites,
    effets: rejeu ? app.ralenti.effets : effets,
    vueJoueurs: rejeu ? app.ralenti.vue : app.vueJoueurs,
    enMatch: !horsMatch && !rejeu,
    enJeu: ecranUI === 'jeu' && !rejeu,
  });
  g.setTransform(E, 0, 0, E, 0, 0);
  if (!horsMatch && !effets.finale.actif) {
    dessineTableau(v, jeu, ecranUI === 'jeu');
    dessineEchange(v, jeu);
  }
  if (effets.banniere && !horsMatch && !rejeu) dessineBanniere(v, effets.banniere);

  const reglages = app.pref;
  if (rejeu) {
    dessineRalenti(v, app.boutons, app.ralenti.progression, t, () => app.passeRalenti());
  } else if (ecranUI === 'jeu') {
    dessineJauge(v, jeu);
    if (app.lan.actif) dessinePings(v, construitPings(app.lan.contexte()));
    dessineParade(v, jeu, t);
    const e = app.entrees;
    const joy = e.joy;
    // pendant la parade, plus de commandes : le camp qui subit a la jauge et son bouton STOP, les autres voient la jauge adverse
    if (!jeu.parade)
      dessineCommandes(v, jeu, {
        tactile: e.tactile,
        joy,
        actifs: new Set(e.ids.values()),
        trait: e.traitAffiche(performance.now()),
      });
  } else if (ecranUI === 'menu') {
    const actions = {
      joue: () => app.lanceMatch(),
      niveauSuivant: () => app.niveauSuivant(),
      jeuxSuivants: () => app.jeuxSuivants(),
      reglages: () => app.ouvreReglages(true),
      multi: () => app.lan.ligne.ouvreChoix(),
    };
    dessineMenu(v, app.boutons, reglages, actions, t, __VERSION_APP__);
    if (app.attenteDemarrage) dessineDemarrage(v, t);
    else if (app.maj.proposee)
      dessineMiseAJour(v, app.boutons, {
        version: app.maj.version,
        onMaj: () => app.maj.accepte(),
        onPlusTard: () => app.maj.plusTard(),
      });
    else if (app.maj.refusee) dessineRappelMiseAJour(v, app.boutons, () => app.maj.rouvre());
  } else if (ecranUI === 'multi-choix') {
    dessineChoix(v, app.boutons, app.lan.ligne.vueChoix());
  } else if (ecranUI === 'ligne') {
    dessineLigne(v, app.boutons, app.lan.ligne.vueLigne(), t);
  } else if (ecranUI === 'lan-liste') {
    dessineListe(v, app.boutons, construitVueListe(app.lan.contexte()), t);
  } else if (ecranUI === 'lan-salon') {
    const salon = construitVueSalon(app.lan.contexte());
    if (salon) dessineSalon(v, app.boutons, salon);
  } else if (ecranUI === 'reglages') {
    dessineReglages(v, app.boutons, {
      son: app.pref.son,
      aide: app.pref.aide,
      bandeCommandes: app.pref.bandeCommandes,
      secoussesReduites: app.pref.secoussesReduites,
      nom: app.pref.nom,
      onNom: () => saisitPseudo(app.pref),
      onSon: () => app.basculeSon(),
      onAide: () => app.basculeAide(),
      onBande: () => app.basculeBande(),
      onSecousses: () => app.basculeSecousses(),
      onCommandes: () => app.ouvreCommandes(true),
      onRetour: () => app.ouvreReglages(false),
    });
  } else if (ecranUI === 'commandes') {
    dessineCommandesAide(v, app.boutons, {
      onglet: app.ongletCommandes,
      onOnglet: (o) => (app.ongletCommandes = o),
      onRetour: () => app.ouvreCommandes(false),
    });
  } else if (ecranUI === 'pause') {
    dessinePause(
      v,
      app.boutons,
      () => app.pause(false),
      () => (app.lan.actif ? app.lan.quitte() : app.retourMenu()),
    );
  } else {
    const lan = app.lan;
    const hote = lan.hote;
    if (lan.actif) {
      // en réseau, l'hôte décide de la revanche ; les autres attendent ou quittent
      dessineFin(
        v,
        app.boutons,
        jeu,
        reglages,
        hote ? () => hote.agit({ a: 'rejoue' }) : null,
        hote ? () => hote.agit({ a: 'salon' }) : () => lan.quitte(),
        t,
        hote ? 'SALON' : 'QUITTER',
      );
    } else {
      dessineFin(
        v,
        app.boutons,
        jeu,
        reglages,
        () => app.lanceMatch(),
        () => app.retourMenu(),
        t,
      );
    }
  }
  const attente = ecranUI === 'jeu' || ecranUI === 'pause' ? app.lan.vueAttente() : null;
  if (attente) dessineAttente(v, app.boutons, attente, t);
  if (!rejeu && ecranUI === 'jeu') dessineFinale(v, effets.finale, app.boutons, () => app.passeRalenti());
  if (effets.fissure) dessineFissure(v, effets.fissure);
  if (effets.flash > 0) {
    g.fillStyle = `rgba(255,255,255,${effets.flash * 0.5})`;
    g.fillRect(0, 0, W, H);
  }
}
