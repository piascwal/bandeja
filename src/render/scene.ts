import { clamp } from '@core/aleatoire';
import { HAUT_SMASH, LARG } from '@core/constants';
import { frappable } from '@core/coups';
import { BONUS_PORTEE, modeTir, viseServ } from '@core/humain';
import { cibleService } from '@core/service';
import type { Joueur, Partie } from '@core/types';
import { dessineBalle, ombre } from './balle-render';
import type { Decor } from './decor';
import type { Effets } from './effets';
import { dessineJoueur } from './joueurs-render';
import { C } from './palette';
import { texte } from './police';
import { croixSol, px } from './primitives';
import type { VueJoueurs } from './regard';
import { HAUT_JOUEUR, type SpritesEquipe } from './sprites';
import type { Vue } from './vue';

const NOMS_MODE = { fond: 'VITRE DU FOND', haut: 'VITRE DE COTE', bas: 'VITRE DE COTE' } as const;

export interface Scene {
  jeu: Partie;
  decor: Decor;
  sprites: [SpritesEquipe, SpritesEquipe];
  effets: Effets;
  /** regard et pose de course des joueurs, propres à cet écran */
  vueJoueurs: VueJoueurs;
  /** un match est en cours (pas le menu) : on montre les aides du joueur */
  enMatch: boolean;
  /** les commandes sont actives (ni pause ni fin) */
  enJeu: boolean;
}

/** La piste et tout ce qui s'y passe, du fond vers l'avant. */
export function dessineScene(v: Vue, sc: Scene): void {
  const { g } = v;
  const { jeu, decor, effets } = sc;
  const bond =
    effets.excite > 0.05 ? Math.floor(jeu.temps * 9) & 1 : Math.floor(jeu.temps * 0.7) % 5 === 0 ? 1 : 0;
  g.drawImage(decor.foule[bond]!, 0, 0);
  g.drawImage(decor.terrain, 0, 0);
  g.drawImage(decor.murs, 0, 0);
  const b = jeu.balle;
  const hum = jeu.humain;

  if (hum) dessineReperes(v, jeu, hum);
  for (const s of jeu.joueurs) ombre(v, s.x, s.y, 8, 0.35);
  if (!b.dehors || b.z < 6) ombre(v, b.x, b.y, 1, clamp(0.45 - b.z * 0.05, 0.12, 0.45));
  if (hum && sc.enJeu) anneauJoueur(v, jeu, hum);

  // du fond vers l'avant
  const liste = jeu.joueurs.map((s) => ({
    y: s.y,
    f: () => dessineJoueur(v, jeu, s, sc.sprites[s.eq], sc.vueJoueurs),
  }));
  liste.push({ y: clamp(b.y, 0, LARG) + 0.01, f: () => dessineBalle(v, jeu) });
  liste.sort((a, c) => a.y - c.y);
  for (const e of liste) e.f();

  for (const p of effets.particules) {
    g.globalAlpha = Math.min(1, p.vie * 4);
    px(g, p.x, p.y, 1, 1, p.c);
  }
  g.globalAlpha = 1;
  g.drawImage(decor.devant, 0, 0);

  if (hum && sc.enMatch) aidesJoueur(v, jeu, hum);
  // en réseau, une flèche rouge repère chaque autre humain
  if (sc.enMatch) for (const h of jeu.humains) if (h !== hum) flecheAutreHumain(v, jeu, h);
  for (const bb of effets.bulles) {
    g.globalAlpha = Math.min(1, bb.vie * 3);
    texte(g, bb.txt, bb.x, bb.y, bb.c);
    g.globalAlpha = 1;
  }
}

/** Repère du rebond (pour aller chercher la balle) et cible du service. */
function dessineReperes(v: Vue, jeu: Partie, hum: Joueur): void {
  const b = jeu.balle;
  const clignote = (f: number) => (Math.floor(jeu.temps * f) & 1 ? C.or : C.blanc);
  const rebond = jeu.pred?.rebond;
  if (jeu.phase === 'jeu' && b.camp === hum.eq && rebond && b.sol === 0) {
    const plan = jeu.plan[hum.eq];
    const c = plan && plan.s === hum ? clignote(8) : 'rgba(255,255,255,0.45)';
    const [sx, sy] = v.K.proj(rebond.x, rebond.y, 0);
    croixSol(v.g, sx, sy, c);
  }
  if (jeu.phase === 'service' && jeu.serveur === hum && jeu.pret) {
    const c = cibleService(hum, viseServ(hum));
    const [sx, sy] = v.K.proj(c.x, c.y, 0);
    croixSol(v.g, sx, sy, clignote(6));
  }
}

/** Anneau sous le joueur humain : doré quand la balle est à portée. */
function anneauJoueur(v: Vue, jeu: Partie, hum: Joueur): void {
  const [sx, sy] = v.K.proj(hum.x, hum.y, 0);
  const ok = frappable(jeu, hum, BONUS_PORTEE);
  const c = ok ? C.or : 'rgba(255,255,255,0.4)';
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + jeu.temps * 2;
    if (k % 2 === 0 || ok) px(v.g, sx + Math.cos(a) * 10, sy + Math.sin(a) * 3.5, 1, 1, c);
  }
}

/** Une flèche au-dessus de votre tête, la jauge de puissance et la vitre visée. */
function aidesJoueur(v: Vue, jeu: Partie, hum: Joueur): void {
  const { g } = v;
  const [sx, sy] = v.K.proj(hum.x, hum.y, 0);
  const yy = Math.round(sy) - HAUT_JOUEUR - 8 + (Math.floor(jeu.temps * 3) & 1);
  px(g, sx - 2, yy, 5, 1, C.contour);
  px(g, sx - 2, yy - 1, 5, 1, C.contour);
  px(g, sx - 1, yy, 3, 1, C.or);
  px(g, sx - 1, yy + 1, 3, 1, C.contour);
  px(g, sx, yy + 1, 1, 1, C.or);
  if (!hum.intent) return;
  const w = 12;
  const x0 = Math.round(sx - w / 2);
  const y0 = yy - 5;
  px(g, x0 - 1, y0 - 1, w + 2, 4, C.contour);
  px(g, x0, y0, Math.round(w * hum.charge), 2, hum.charge > 0.8 ? '#ff7a3c' : C.or);
  const md = jeu.balle.z > HAUT_SMASH ? null : modeTir(hum);
  if (md) texte(g, NOMS_MODE[md], sx, y0 - 10, C.vitre, 1, 'c');
}

/** Flèche rouge vif au-dessus d'un autre joueur humain : bien visible sur la piste. */
function flecheAutreHumain(v: Vue, jeu: Partie, autre: Joueur): void {
  const { g } = v;
  const [sx, sy] = v.K.proj(autre.x, autre.y, 0);
  const yy = Math.round(sy) - HAUT_JOUEUR - 8 + (Math.floor(jeu.temps * 3) & 1);
  px(g, sx - 2, yy - 1, 5, 2, C.contour);
  px(g, sx - 1, yy, 3, 2, C.contour);
  px(g, sx - 1, yy - 1, 3, 1, '#ff3b3b');
  px(g, sx, yy, 1, 1, '#ff3b3b');
}
