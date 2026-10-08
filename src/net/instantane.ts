import type { Bouton, Coup, Effet, Equipe, Partie, Phase, PoseCoup, TypeService } from '@core/types';
import { Ecrivain, Lecteur } from './binaire';
import { BOUTONS, COUPS, EFFETS, indice, PHASES, POSES_COUP, SERVICES, VERSION_PROTOCOLE } from './protocole';

/** Ce que l'hôte envoie de chaque joueur de la piste : tout ce que l'écran d'un invité dessine. */
export interface JoueurInstantane {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 au moment du coup, redescend à 0 */
  swing: number;
  haut: boolean;
  poseCoup: PoseCoup;
  /** temps restant tourné vers sa vitre après un rebond voulu (s) */
  tourne: number;
  faceCoup: 1 | -1;
  /** coup armé par un humain (bouton), avec sa charge de puissance */
  intent: Bouton | null;
  charge: number;
  /** distance parcourue, pour l'animation des pas */
  pas: number;
  /** direction voulue, repère de la piste */
  ex: number;
  ey: number;
  /** hauteur du saut (m) */
  saut: number;
}

export interface BalleInstantane {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: Effet;
  spinDir: number;
  roule: boolean;
  dehors: boolean;
  portres: boolean;
  /** variante du super coup en vol (0 : aucun) */
  super: number;
  /** rebond vif en attente (0 → 1,25) */
  vif: number;
  service: boolean;
  filet: boolean;
  mur: boolean;
  eqF: Equipe;
  camp: Equipe;
  sol: number;
  coup: Coup | null;
}

/** L'état de la partie à un instant : de quoi redessiner l'écran, rien de plus. */
export interface Instantane {
  /** numéro d'ordre (16 bits, tourne en boucle) */
  seq: number;
  /** temps de simulation (s) */
  t: number;
  phase: Phase;
  gagnant: Equipe;
  /** `id` du serveur */
  serveur: number;
  pret: boolean;
  faute: number;
  rejoue: boolean;
  /** coups de l'échange en cours */
  echange: number;
  /** jauges de smash des deux équipes (0 → 1) */
  smash: [number, number];
  /** parade d'un super coup en cours : le camp qui la tente et la phase du curseur (s) */
  parade: { eq: Equipe; t: number } | null;
  pts: [number, number];
  jeux: [number, number];
  nJeu: number;
  jauge: { type: TypeService; t: number } | null;
  joueurs: JoueurInstantane[];
  balle: BalleInstantane;
  stats: { gagnants: [number, number]; portres: [number, number]; fautes: [number, number]; vitres: number };
}

/** Taille fixe : 7 (en-tête) + 10 (score) + 5 (jauge) + 4 x 28 (joueurs) + 31 (balle) + 7 (stats). */
export const TAILLE_INSTANTANE = 178;
const TOURNE_MAX = 0.5;
const POS_MAX = 100;
const VIT_MAX = 200;

/** Photographie la partie : à appeler chez l'hôte, après chaque pas ou presque. */
export function instantaneDe(jeu: Partie, seq: number): Instantane {
  const b = jeu.balle;
  return {
    seq: seq & 0xffff,
    t: jeu.temps,
    phase: jeu.phase,
    gagnant: jeu.gagnant,
    serveur: jeu.serveur.id,
    pret: jeu.pret,
    faute: jeu.faute,
    rejoue: jeu.rejoue,
    echange: Math.min(255, jeu.echange),
    smash: [jeu.jaugeSmash[0], jeu.jaugeSmash[1]],
    parade: jeu.parade ? { eq: jeu.parade.eq, t: jeu.parade.t } : null,
    pts: [jeu.pts[0], jeu.pts[1]],
    jeux: [jeu.jeux[0], jeu.jeux[1]],
    nJeu: jeu.nJeu,
    jauge: jeu.jauge ? { type: jeu.jauge.type, t: jeu.jauge.t } : null,
    joueurs: jeu.joueurs.map((s) => ({
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      swing: s.swing,
      haut: s.haut,
      poseCoup: s.poseCoup,
      tourne: s.tourne,
      faceCoup: s.faceCoup,
      intent: s.intent ? s.intent.type : null,
      charge: s.charge,
      pas: s.pas,
      ex: s.ex,
      ey: s.ey,
      saut: s.saut,
    })),
    balle: {
      x: b.x,
      y: b.y,
      z: b.z,
      vx: b.vx,
      vy: b.vy,
      vz: b.vz,
      spin: b.spin,
      spinDir: Math.sign(b.spinDir),
      roule: b.roule,
      dehors: b.dehors,
      portres: b.portres,
      vif: b.vif,
      super: b.super,
      service: b.service,
      filet: b.filet,
      mur: b.mur,
      eqF: b.eqF,
      camp: b.camp,
      sol: Math.min(255, b.sol),
      coup: b.coup,
    },
    stats: {
      gagnants: [jeu.stats.gagnants[0], jeu.stats.gagnants[1]],
      portres: [jeu.stats.portres[0], jeu.stats.portres[1]],
      fautes: [jeu.stats.fautes[0], jeu.stats.fautes[1]],
      vitres: jeu.stats.vitres,
    },
  };
}

export function encodeInstantane(s: Instantane): ArrayBuffer {
  const w = new Ecrivain(TAILLE_INSTANTANE);
  w.u8(VERSION_PROTOCOLE).u16(s.seq).f32(s.t);
  w.u8(indice(PHASES, s.phase)).bits(s.pret, s.rejoue, s.jauge !== null);
  w.u8(s.echange)
    .u8(s.smash[0] * 100)
    .u8(s.smash[1] * 100);
  w.u8(s.parade ? 1 + s.parade.eq : 0).u16(Math.round((s.parade?.t ?? 0) * 100) % 65535);
  w.u8(s.gagnant).u8(s.serveur).u8(s.faute).u8(s.pts[0]).u8(s.pts[1]).u8(s.jeux[0]).u8(s.jeux[1]).u8(s.nJeu);
  w.u8(s.jauge ? indice(SERVICES, s.jauge.type) : 0).f32(s.jauge ? s.jauge.t : 0);
  for (const j of s.joueurs) {
    w.f32(j.x).f32(j.y).f32(j.vx).f32(j.vy);
    w.u8(j.swing * 255).u8((j.tourne / TOURNE_MAX) * 255);
    w.bits(j.haut, j.poseCoup === 'smash2', j.faceCoup > 0, j.intent !== null, j.poseCoup === 'smash1');
    w.u8(j.intent ? indice(BOUTONS, j.intent) : 0)
      .u8(j.charge * 255)
      .f32(j.pas)
      .i8(j.ex * 100)
      .i8(j.ey * 100)
      .u8(j.saut * 50);
  }
  const b = s.balle;
  w.f32(b.x).f32(b.y).f32(b.z).f32(b.vx).f32(b.vy).f32(b.vz);
  w.u8(indice(EFFETS, b.spin)).i8(b.spinDir);
  w.bits(b.roule, b.dehors, b.portres, b.service, b.filet, b.mur, b.eqF === 1, b.camp === 1);
  w.u8(b.sol)
    .u8(b.coup ? indice(COUPS, b.coup) : 255)
    .u8(b.vif * 100);
  w.u8(b.super);
  const st = s.stats;
  w.u8(st.gagnants[0]).u8(st.gagnants[1]).u8(st.portres[0]).u8(st.portres[1]);
  w.u8(st.fautes[0]).u8(st.fautes[1]).u8(st.vitres);
  return w.fin();
}

const equipe = (n: number): Equipe => (n === 1 ? 1 : 0);

/**
 * Relit un instantané reçu. Tout ce qui est tronqué, de la mauvaise version,
 * ou hors limites (NaN, indice inconnu, coordonnée délirante) est rejeté :
 * l'hôte n'est pas forcément honnête, et un paquet abîmé ne doit rien casser.
 */
export function decodeInstantane(buf: ArrayBuffer): Instantane | null {
  if (buf.byteLength !== TAILLE_INSTANTANE) return null;
  try {
    const r = new Lecteur(buf);
    if (r.u8() !== VERSION_PROTOCOLE) return null;
    const seq = r.u16();
    const t = r.f32(1e7);
    const phase = PHASES[r.enumere(PHASES.length)]!;
    const [pret, rejoue, avecJauge] = r.bits() as [boolean, boolean, boolean];
    const echange = r.u8();
    const smash: [number, number] = [Math.min(100, r.u8()) / 100, Math.min(100, r.u8()) / 100];
    const codeParade = r.enumere(3);
    const tParade = r.u16() / 100;
    const gagnant = equipe(r.enumere(2));
    const serveur = r.enumere(4);
    const faute = r.enumere(2);
    const pts: [number, number] = [r.enumere(4), r.enumere(4)];
    const jeux: [number, number] = [r.u8(), r.u8()];
    const nJeu = r.u8();
    const typeJauge = r.enumere(SERVICES.length);
    const tJauge = r.f32(1e4);
    const joueurs = Array.from({ length: 4 }, (): JoueurInstantane => {
      const x = r.f32(POS_MAX);
      const y = r.f32(POS_MAX);
      const vx = r.f32(VIT_MAX);
      const vy = r.f32(VIT_MAX);
      const swing = r.u8() / 255;
      const tourne = (r.u8() / 255) * TOURNE_MAX;
      const [haut, smash2, faceDroite, armee, smash1] = r.bits() as [
        boolean,
        boolean,
        boolean,
        boolean,
        boolean,
      ];
      const typeIntent = r.enumere(BOUTONS.length);
      const charge = r.u8() / 255;
      const pas = r.f32(1e7);
      const ex = r.i8() / 100;
      const ey = r.i8() / 100;
      const saut = Math.min(5, r.u8() / 50);
      return {
        x,
        y,
        vx,
        vy,
        swing,
        haut,
        poseCoup: smash2 ? POSES_COUP[1]! : smash1 ? POSES_COUP[2]! : POSES_COUP[0]!,
        tourne,
        faceCoup: faceDroite ? 1 : -1,
        intent: armee ? BOUTONS[typeIntent]! : null,
        charge,
        pas,
        ex,
        ey,
        saut,
      };
    });
    const bx = r.f32(POS_MAX);
    const by = r.f32(POS_MAX);
    const bz = r.f32(POS_MAX);
    const bvx = r.f32(VIT_MAX);
    const bvy = r.f32(VIT_MAX);
    const bvz = r.f32(VIT_MAX);
    const spin = EFFETS[r.enumere(EFFETS.length)]!;
    const spinDir = r.i8();
    const [roule, dehors, portres, service, filet, mur, eqF, camp] = r.bits();
    const sol = r.u8();
    const c = r.u8();
    const vif = Math.min(125, r.u8());
    const superCoup = Math.min(4, r.u8());
    if (c !== 255 && c >= COUPS.length) return null;
    const stats = {
      gagnants: [r.u8(), r.u8()] as [number, number],
      portres: [r.u8(), r.u8()] as [number, number],
      fautes: [r.u8(), r.u8()] as [number, number],
      vitres: r.u8(),
    };
    r.fini();
    return {
      seq,
      t,
      phase,
      gagnant,
      serveur,
      pret,
      faute,
      rejoue,
      echange,
      smash,
      parade: codeParade > 0 ? { eq: equipe(codeParade - 1), t: tParade } : null,
      pts,
      jeux,
      nJeu,
      jauge: avecJauge ? { type: SERVICES[typeJauge]!, t: tJauge } : null,
      joueurs,
      balle: {
        x: bx,
        y: by,
        z: bz,
        vx: bvx,
        vy: bvy,
        vz: bvz,
        spin,
        spinDir: Math.sign(spinDir),
        roule: roule!,
        dehors: dehors!,
        portres: portres!,
        vif: vif / 100,
        super: superCoup,
        service: service!,
        filet: filet!,
        mur: mur!,
        eqF: eqF ? 1 : 0,
        camp: camp ? 1 : 0,
        sol,
        coup: c === 255 ? null : COUPS[c]!,
      },
      stats,
    };
  } catch {
    return null;
  }
}
