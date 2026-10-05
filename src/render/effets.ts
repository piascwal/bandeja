import { C, EQUIPES } from './palette';
import type { Equipe } from '@core/types';
import { BANDEAU_S, FinaleSuper } from './finale-super';

interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  c: string;
  frot?: number;
  /** taille en pixels (1 par défaut) */
  t?: number;
}

interface Bulle {
  txt: string;
  x: number;
  y: number;
  c: string;
  vie: number;
}

/** L'écran fissuré par un super coup : le point d'impact, ce qu'il reste de temps, et la graine du dessin. */
export interface Fissure {
  x: number;
  y: number;
  vie: number;
  graine: number;
}

/** Un dégât laissé sur le terrain ou sur une vitre par un super coup. */
export interface Decal {
  kind: 'sol' | 'vitre';
  /** position sur la piste (m) */
  x: number;
  y: number;
  z: number;
  variante: number;
  graine: number;
  vie: number;
}

/** Le bandeau d'un point gagné par un super coup, gardé en attente jusqu'à la fin de la scène. */
interface BandeauEnAttente {
  txt: string;
  sous: string | null;
  c: string;
  attente: number;
}

export interface Banniere {
  txt: string;
  sous: string | null;
  c: string;
  vie: number;
  max: number;
}

const alea = (a: number, b: number) => a + Math.random() * (b - a);
const MAX_PARTICULES = 500;

/** Effets purement visuels (pixels de l'écran logique), alimentés par les évènements du jeu. */
export class Effets {
  particules: Particule[] = [];
  bulles: Bulle[] = [];
  secousse = 0;
  flash = 0;
  banniere: Banniere | null = null;
  fissure: Fissure | null = null;
  /** la fin spectaculaire d'un super coup */
  readonly finale = new FinaleSuper();
  decals: Decal[] = [];
  private bandeau: BandeauEnAttente | null = null;
  /** excitation de la foule (0 → 1), qui la fait sauter */
  excite = 0;

  vide(): void {
    this.particules = [];
    this.bulles = [];
    this.banniere = null;
    this.fissure = null;
    this.decals = [];
    this.bandeau = null;
    this.finale.reinitialise();
  }

  /** Les dégâts de la piste (cratères, vitres brisées, écran fissuré) disparaissent. */
  repare(): void {
    this.decals = [];
    this.fissure = null;
    if (!this.finale.actif) this.finale.reinitialise();
  }

  /** Le terrain ou la vitre est abîmé(e) à cet endroit. */
  abime(kind: 'sol' | 'vitre', x: number, y: number, z: number, variante: number): void {
    this.decals.push({ kind, x, y, z, variante, graine: Math.floor(Math.random() * 1e9), vie: 60 });
  }

  /** Des morceaux de terrain arrachés par un choc. */
  debris(x: number, y: number, n = 70): void {
    const cs = ['#2a2118', '#6b5a48', '#a89878', '#d9c9a8'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = alea(60, 240);
      this.particules.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vie: alea(0.5, 1.1),
        c: cs[i % cs.length]!,
        frot: 1.2,
        t: i % 3 === 0 ? 3 : 2,
      });
    }
  }

  /** Le bandeau du point d'un super coup attend la fin de la scène pour s'afficher. */
  differe(txt: string, sous: string | null, c: string): void {
    this.bandeau = { txt, sous, c, attente: 0 };
  }

  etincelles(x: number, y: number, n: number, c = '#ffe07a', v0 = 90): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = alea(v0 * 0.3, v0);
      this.particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: alea(0.15, 0.4), c });
    }
  }

  /** Une vitre qui vole en éclats : des éclats clairs, gros, qui retombent doucement. */
  eclatsVitre(x: number, y: number, n = 120): void {
    const cs = ['#ffffff', '#dff4ff', '#9fd8ff', '#bfe6ff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = alea(40, 230);
      this.particules.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 20,
        vie: alea(0.5, 1.2),
        c: cs[i % cs.length]!,
        frot: 1.6,
        t: i % 3 === 0 ? 3 : 2,
      });
    }
  }

  poussiere(x: number, y: number, n: number, c = '#9fb8e8'): void {
    for (let i = 0; i < n; i++) {
      this.particules.push({ x, y, vx: alea(-30, 30), vy: alea(-25, -5), vie: alea(0.15, 0.35), c });
    }
  }

  confettis(x: number, y: number, eq: Equipe): void {
    const cs = [EQUIPES[eq].maillot, EQUIPES[eq].clair, C.or, C.blanc];
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = alea(30, 190);
      this.particules.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        vie: alea(0.8, 2.0),
        c: cs[i % cs.length]!,
        frot: 2.2,
      });
    }
  }

  /** L'écran se fissure à partir de (x, y). */
  fissurer(x: number, y: number): void {
    this.fissure = { x, y, vie: 1.8, graine: Math.floor(Math.random() * 1e9) };
  }

  bulle(txt: string, x: number, y: number, c: string): void {
    this.bulles.push({ txt, x, y, c, vie: 1.1 });
  }

  annonce(txt: string, sous: string | null, c: string, duree = 1.6): void {
    this.banniere = { txt, sous, c, vie: duree, max: duree };
  }

  maj(dt: number): void {
    for (const p of this.particules) {
      p.vie -= dt;
      const f = Math.exp(-(p.frot ?? 4) * dt);
      p.vx *= f;
      p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particules = this.particules.filter((p) => p.vie > 0);
    if (this.particules.length > MAX_PARTICULES)
      this.particules.splice(0, this.particules.length - MAX_PARTICULES);
    for (const b of this.bulles) {
      b.vie -= dt;
      b.y -= 14 * dt;
    }
    this.bulles = this.bulles.filter((b) => b.vie > 0);
    this.secousse = Math.max(0, this.secousse - dt * 14);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.banniere) {
      this.banniere.vie -= dt;
      if (this.banniere.vie <= 0) this.banniere = null;
    }
    this.excite = Math.max(0, this.excite - dt / 3);
    this.finale.maj(dt);
    for (const d of this.decals) d.vie -= dt;
    this.decals = this.decals.filter((d) => d.vie > 0);
    if (this.bandeau) {
      this.bandeau.attente += dt;
      const f = this.finale;
      if ((f.declenchee && (!f.actif || f.t >= BANDEAU_S)) || this.bandeau.attente > 4.5) {
        this.annonce(this.bandeau.txt, this.bandeau.sous, this.bandeau.c, 1.4);
        this.bandeau = null;
      }
    }
    if (this.fissure) {
      this.fissure.vie -= dt;
      if (this.fissure.vie <= 0) this.fissure = null;
    }
  }
}
