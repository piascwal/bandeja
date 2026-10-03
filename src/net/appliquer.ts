import { prevoir } from '@core/prevision';
import type { Partie } from '@core/types';
import type { Instantane } from './instantane';

const LONGUEUR_TRACE = 16;

/**
 * Pose un instantané sur la partie locale d'un invité (ou d'un spectateur) :
 * c'est cette partie, jamais simulée, que le rendu dessine. Les champs que
 * l'hôte ne transmet pas (plan de jeu, prévision du rebond) sont recalculés ici.
 */
export function appliqueInstantane(jeu: Partie, s: Instantane): void {
  jeu.temps = s.t;
  jeu.phase = s.phase;
  jeu.gagnant = s.gagnant;
  jeu.serveur = jeu.joueurs[s.serveur]!;
  jeu.pret = s.pret;
  jeu.faute = s.faute;
  jeu.rejoue = s.rejoue;
  jeu.pts = [s.pts[0], s.pts[1]];
  jeu.jeux = [s.jeux[0], s.jeux[1]];
  jeu.nJeu = s.nJeu;
  jeu.jauge = s.jauge ? { type: s.jauge.type, t: s.jauge.t } : null;
  jeu.stats = {
    gagnants: [s.stats.gagnants[0], s.stats.gagnants[1]],
    portres: [s.stats.portres[0], s.stats.portres[1]],
    fautes: [s.stats.fautes[0], s.stats.fautes[1]],
    vitres: s.stats.vitres,
  };
  s.joueurs.forEach((j, i) => {
    const p = jeu.joueurs[i];
    if (!p) return;
    p.x = j.x;
    p.y = j.y;
    p.vx = j.vx;
    p.vy = j.vy;
    p.swing = j.swing;
    p.haut = j.haut;
    p.poseCoup = j.poseCoup;
    p.tourne = j.tourne;
    p.faceCoup = j.faceCoup;
    p.intent = j.intent ? { type: j.intent, t: 0 } : null;
    p.charge = j.charge;
    p.pas = j.pas;
    p.ex = j.ex;
    p.ey = j.ey;
  });
  const b = jeu.balle;
  const sb = s.balle;
  Object.assign(b, {
    x: sb.x,
    y: sb.y,
    z: sb.z,
    vx: sb.vx,
    vy: sb.vy,
    vz: sb.vz,
    spin: sb.spin,
    spinDir: sb.spinDir,
    roule: sb.roule,
    dehors: sb.dehors,
    portres: sb.portres,
    vif: sb.vif,
    service: sb.service,
    filet: sb.filet,
    mur: sb.mur,
    eqF: sb.eqF,
    camp: sb.camp,
    sol: sb.sol,
    coup: sb.coup,
  });
  // la traînée se reconstitue ici, d'une image à l'autre
  b.trace.push([b.x, b.y, b.z]);
  if (b.trace.length > LONGUEUR_TRACE) b.trace.shift();
}

/**
 * Recalcule en local la prévision de trajectoire (repère du rebond, joueur qui
 * va jouer la balle) : elle ne dépend que de la balle, déjà synchronisée. Dix
 * fois par seconde, comme chez l'hôte.
 */
export function rafraichitPrevision(jeu: Partie, dt: number): void {
  if (jeu.phase !== 'jeu') {
    jeu.plan = [null, null];
    jeu.pred = null;
    return;
  }
  jeu.tPred -= dt;
  if (jeu.tPred > 0) return;
  prevoir(jeu);
  jeu.tPred = 0.1;
}
