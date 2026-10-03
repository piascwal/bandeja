import { dessineCommandes } from '@render/commandes';
import { dessineBanniere, dessineJauge, dessineTableau } from '@render/hud';
import { dessineDemarrage, dessineFin, dessineMenu, dessinePause, dessinePortrait } from '@render/menus';
import { C } from '@render/palette';
import { dessineScene } from '@render/scene';
import type { BandejaApp } from './app';

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
  g.fillStyle = C.nuit;
  g.fillRect(0, 0, W, H);
  const sx = secousseAleatoire(effets.secousse);
  const sy = secousseAleatoire(effets.secousse);
  g.setTransform(E, 0, 0, E, sx * E, sy * E);
  dessineScene(v, {
    jeu,
    decor: app.decor,
    sprites: app.sprites,
    effets,
    enMatch: ecranUI !== 'menu',
    enJeu: ecranUI === 'jeu',
  });
  g.setTransform(E, 0, 0, E, 0, 0);
  if (ecranUI !== 'menu') dessineTableau(v, jeu, ecranUI === 'jeu');
  if (effets.banniere && ecranUI !== 'menu') dessineBanniere(v, effets.banniere);

  const reglages = app.pref;
  if (ecranUI === 'jeu') {
    dessineJauge(v, jeu);
    const e = app.entrees;
    const joy = e.joy;
    dessineCommandes(v, jeu, {
      tactile: e.tactile,
      joy,
      actifs: new Set(e.ids.values()),
      sprint: e.sprintActif(),
    });
  } else if (ecranUI === 'menu') {
    const actions = {
      joue: () => app.lanceMatch(),
      niveauSuivant: () => app.niveauSuivant(),
      jeuxSuivants: () => app.jeuxSuivants(),
      basculeSon: () => app.basculeSon(),
    };
    dessineMenu(v, app.boutons, reglages, actions, app.entrees.tactile, t, __VERSION_APP__);
    if (app.attenteDemarrage) dessineDemarrage(v, t);
  } else if (ecranUI === 'pause') {
    dessinePause(
      v,
      app.boutons,
      () => app.pause(false),
      () => app.retourMenu(),
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
  if (effets.flash > 0) {
    g.fillStyle = `rgba(255,255,255,${effets.flash * 0.5})`;
    g.fillRect(0, 0, W, H);
  }
}
