import {
  FINALE_SUPER_S,
  RALENTI_CLIP,
  RALENTI_DEBUT,
  RALENTI_ECHANGE,
  RALENTI_RYTHME,
  VITESSE,
} from '@core/constants';
import { nouvellePartie } from '@core/partie';
import type { Partie } from '@core/types';
import { Effets } from '@render/effets';
import { VueJoueurs } from '@render/regard';
import { appliqueInstantane } from '../net/appliquer';
import { instantaneDe, type Instantane } from '../net/instantane';
import { interpole } from '../net/synchro';

/** Cadence d'enregistrement (en secondes de simulation) : assez fine pour un ralenti fluide une fois interpolé. */
const PAS_CADRE = 1 / 30;
/** On garde un peu plus que la durée rejouée. */
const MEMOIRE_S = RALENTI_CLIP + 1;

/**
 * Le ralenti des points : chaque écran enregistre ce qu'il affiche (la partie
 * de l'hôte ou de l'invité, c'est pareil) et rejoue, à la fin d'un bel
 * échange, ses dernières secondes sur une partie à part. Rien ne passe par le
 * réseau : chaque appareil produit son propre ralenti.
 */
export class Ralenti {
  /** la partie qui sert à dessiner le rejeu, jamais simulée */
  readonly jeu: Partie = nouvellePartie({ mode: 'demo', niveau: 1, jeux: 1 });
  readonly vue = new VueJoueurs();
  readonly effets = new Effets();
  actif = false;
  /** avancement du rejeu, de 0 à 1 */
  progression = 0;
  private cadres: Instantane[] = [];
  private clip: Instantane[] = [];
  private position = 0;
  /** début de l'échange en cours, et du point une fois joué */
  private debutEchange = 0;
  private finEchange: number | null = null;
  private dejaRejoue = false;

  /** Nouveau match : on repart de zéro. */
  reinitialise(): void {
    this.cadres = [];
    this.clip = [];
    this.actif = false;
    this.finEchange = null;
    this.dejaRejoue = false;
  }

  arrete(): void {
    this.actif = false;
  }

  /** À chaque image, avec la partie telle qu'elle est affichée (après simulation ou application du réseau). */
  suit(jeu: Partie, dt: number, miroir: boolean): void {
    this.vue.miroir = miroir;
    if (jeu.mode !== 'match') return;
    const dernier = this.cadres[this.cadres.length - 1];
    if (!dernier || jeu.temps < dernier.t) this.cadres = [];
    if (jeu.phase === 'jeu' && (!dernier || dernier.phase !== 'jeu')) this.debutEchange = jeu.temps;
    if (!dernier || jeu.temps - dernier.t >= PAS_CADRE) {
      this.cadres.push(instantaneDe(jeu, 0));
      while (this.cadres[0]!.t < jeu.temps - MEMOIRE_S - RALENTI_DEBUT) this.cadres.shift();
    }
    if (jeu.phase === 'point' && !jeu.rejoue) this.pendantPoint(jeu);
    else if (jeu.phase !== 'point') {
      this.finEchange = null;
      this.dejaRejoue = false;
      this.actif = false;
    }
    if (this.actif) this.avance(dt);
  }

  private pendantPoint(jeu: Partie): void {
    if (this.finEchange === null) this.finEchange = jeu.temps;
    // un super coup est toujours rejoué, une fois sa scène finale terminée
    const superCoup = jeu.balle.super > 0;
    if (
      this.actif ||
      this.dejaRejoue ||
      jeu.temps - this.finEchange < (superCoup ? FINALE_SUPER_S : RALENTI_DEBUT)
    )
      return;
    this.dejaRejoue = true;
    if (!superCoup && this.finEchange - this.debutEchange < RALENTI_ECHANGE) return;
    const debut = this.finEchange - RALENTI_CLIP;
    this.clip = this.cadres.filter((c) => c.t >= debut && c.t <= this.finEchange! + 0.5);
    if (this.clip.length < 8) return;
    this.position = this.clip[0]!.t;
    this.progression = 0;
    this.effets.vide();
    this.actif = true;
  }

  private avance(dt: number): void {
    const premier = this.clip[0]!.t;
    const dernier = this.clip[this.clip.length - 1]!.t;
    this.position += dt * VITESSE * RALENTI_RYTHME;
    if (this.position >= dernier) {
      this.actif = false;
      return;
    }
    this.progression = (this.position - premier) / (dernier - premier);
    const i = Math.max(
      1,
      this.clip.findIndex((c) => c.t >= this.position),
    );
    const a = this.clip[i - 1]!;
    const b = this.clip[i]!;
    appliqueInstantane(this.jeu, interpole(a, b, Math.min(1, (this.position - a.t) / (b.t - a.t || 1))));
    this.vue.majTous(this.jeu);
  }
}
