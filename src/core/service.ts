import { alea, clamp, gauss } from './aleatoire';
import { lance, nouvelleBalle } from './balle';
import { ACE_PROBA, ACE_PROBA_CPU, JAUGE_PARFAITE, MIL, PERIODE_JAUGE, SERV, ZONE_ACE } from './constants';
import { equipe, partenaire } from './joueurs';
import { autre, dir, xProf } from './terrain';
import type { Joueur, Partie, TypeService } from './types';

/** Valeur de la jauge de service (0 → 1 → 0...) après t secondes. */
export const jaugeVal = (t: number): number => 1 - Math.abs(((t / PERIODE_JAUGE) % 2) - 1);

/** Replace les quatre joueurs et la balle pour le service suivant. */
export function placeService(jeu: Partie): void {
  jeu.phase = 'service';
  jeu.tPhase = 0;
  jeu.pret = false;
  jeu.jauge = null;
  jeu.cpuServ = null;
  jeu.avantage = null;
  jeu.plan = [null, null];
  jeu.pred = null;
  const srv = jeu.ordre[jeu.nJeu % 4]!;
  jeu.serveur = srv;
  const eq = srv.eq;
  const d = dir(eq);
  const n = jeu.pts[0] + jeu.pts[1];
  let sg: number; // +1 : le serveur est dans la moitié y > 5
  if (jeu.humains.some((h) => h.eq === eq)) {
    // une équipe avec un humain sert chacun de son côté : il garde sa place
    sg = srv.cote > 5 ? 1 : -1;
  } else {
    // on sert d'abord depuis sa droite, puis on alterne à chaque point
    const droite = n % 2 === 0;
    sg = (eq === 0) === droite ? -1 : 1;
  }
  const part = partenaire(jeu, srv);
  srv.home = 5 + sg * 2.5;
  part.home = 5 - sg * 2.5;
  srv.posServ = { x: xProf(eq, MIL - SERV - 0.5), y: 5 + sg * 1.8 };
  part.posServ = { x: MIL - d * 2.8, y: 5 - sg * 2.8 };
  // le receveur est en diagonale
  const adv = equipe(jeu, autre(eq));
  const rec = adv.find((p) => p.cote > 5 === sg < 0) ?? adv[0]!;
  const recP = adv.find((p) => p !== rec)!;
  rec.home = rec.cote;
  recP.home = recP.cote;
  rec.posServ = { x: xProf(autre(eq), 1.2), y: 5 - sg * 2.9 };
  recP.posServ = { x: xProf(autre(eq), 3.2), y: 5 + sg * 2.6 };
  jeu.receveur = rec;
  jeu.posture[eq] = 'filet';
  jeu.posture[autre(eq)] = 'fond';
  for (const s of jeu.joueurs) {
    s.intent = null;
    s.charge = 0;
    s.swing = 0;
  }
  Object.assign(jeu.balle, nouvelleBalle());
  jeu.balle.eqF = eq;
  jeu.balle.camp = autre(eq);
}

/** Pendant la phase de service : mise en place, rebonds de la balle, service de l'ordinateur. */
export function majService(jeu: Partie, dt: number): void {
  const srv = jeu.serveur;
  const b = jeu.balle;
  const d = dir(srv.eq);
  if (!jeu.pret) {
    const enPlace = jeu.joueurs.every((s) => Math.hypot(s.x - s.posServ.x, s.y - s.posServ.y) <= 0.2);
    if (enPlace || jeu.tPhase > 2.2) {
      jeu.pret = true;
      for (const s of jeu.joueurs) {
        s.x = s.posServ.x;
        s.y = s.posServ.y;
        s.vx = s.vy = 0;
      }
    }
  }
  if (jeu.jauge) {
    jeu.jauge.t += dt;
    // le serveur fait rebondir la balle pendant que la jauge oscille
    b.x = srv.x + d * 0.35;
    b.y = srv.y + 0.15;
    b.z = 0.05 + 0.95 * Math.abs(Math.cos((jeu.jauge.t * Math.PI) / PERIODE_JAUGE));
  } else {
    b.x = srv.x + d * 0.3;
    b.y = srv.y + 0.15;
    b.z = 0.95;
  }
  b.vx = b.vy = b.vz = 0;
  if (!jeu.pret || srv.humain) return;
  serviceOrdinateur(jeu, srv);
}

function serviceOrdinateur(jeu: Partie, srv: Joueur): void {
  const rng = jeu.rng;
  if (!jeu.cpuServ && jeu.tPhase > 0.9) {
    // au padel on sert surtout coupé, parfois à plat
    const types: TypeService[] = ['coupe', 'coupe', 'plat'];
    const cibleJ = clamp(0.72 + gauss(rng) * srv.niv.serv * (jeu.faute ? 0.6 : 1), 0.05, 1);
    jeu.cpuServ = {
      t: cibleJ * PERIODE_JAUGE + (rng() < 0.5 ? 0 : 2 * PERIODE_JAUGE),
      vise: alea(rng, -1, 1),
    };
    jeu.jauge = { type: types[Math.floor(rng() * types.length)]!, t: 0 };
  }
  if (jeu.cpuServ && jeu.jauge && jeu.jauge.t >= jeu.cpuServ.t) {
    servir(jeu, srv, jeu.jauge.type, jaugeVal(jeu.jauge.t), jeu.cpuServ.vise);
  }
}

/** Le point visé dans le carré en diagonale ; vise : -1 au centre, +1 vers la vitre. */
export function cibleService(s: Joueur, vise: number): { x: number; y: number } {
  const sg = s.y > 5 ? -1 : 1;
  const yIn = 5 + sg * 0.7;
  const yOut = 5 + sg * 4.3;
  const a = clamp(0.5 + 0.5 * vise, 0, 1);
  return { x: MIL + dir(s.eq) * (SERV - 1.4), y: yIn + (yOut - yIn) * a };
}

const VITESSE_SERVICE: Record<TypeService, number> = { plat: 13, coupe: 10.5 };

export function servir(jeu: Partie, s: Joueur, type: TypeService, gv: number, vise: number): void {
  const b = jeu.balle;
  const eq = s.eq;
  const d = dir(eq);
  b.x = s.x + d * 0.35;
  b.y = s.y + 0.15;
  b.z = 0.75;
  const c = cibleService(s, vise);
  let m = SERV - 1.4;
  let err = 0.14;
  // la jauge : vert = service parfait, trop faible = filet ou court, trop fort = long
  if (gv < JAUGE_PARFAITE.min) {
    err += (JAUGE_PARFAITE.min - gv) * 1.1;
    m -= (JAUGE_PARFAITE.min - gv) * 4;
  }
  if (gv > JAUGE_PARFAITE.max) {
    err += (gv - JAUGE_PARFAITE.max) * 2.5;
    m += (gv - JAUGE_PARFAITE.max) * 11;
  }
  // zone or, au milieu du vert : un service quasi parfait, rapide et précis, que personne ne touche (ace)
  // le CPU ne vise pas la zone or : quand il y tombe par hasard, l'ace reste rare
  const ace = gv >= ZONE_ACE.min && gv <= ZONE_ACE.max && jeu.rng() < (s.humain ? ACE_PROBA : ACE_PROBA_CPU);
  if (ace) err = 0.03;
  const v = (VITESSE_SERVICE[type] + 6 * gv) * (ace ? 1.25 : 1);
  const tx = MIL + d * (m + gauss(jeu.rng) * err);
  const ty = c.y + gauss(jeu.rng) * err * 0.8;
  lance(b, tx, ty, v, type, gv < 0.22 ? -0.35 : 0.1);
  b.vif = 0;
  jeu.echange = 0;
  b.eqF = eq;
  b.camp = autre(eq);
  b.sol = 0;
  b.rebonds = 0;
  b.service = true;
  b.ace = ace;
  b.filet = false;
  jeu.phase = 'jeu';
  jeu.tPhase = 0;
  jeu.tFrappe = 0;
  jeu.jauge = null;
  jeu.tPred = 0;
  s.swing = 1;
  s.haut = false;
  s.poseCoup = 'attente';
  jeu.evenements.push({ type: 'service', service: type, jauge: gv, humain: s.humain, x: s.x, y: s.y });
}
