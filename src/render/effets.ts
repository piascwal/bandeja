import { C, EQUIPES } from './palette';
import type { Equipe } from '@core/types';

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
  /** excitation de la foule (0 → 1), qui la fait sauter */
  excite = 0;

  vide(): void {
    this.particules = [];
    this.bulles = [];
    this.banniere = null;
    this.fissure = null;
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
    if (this.fissure) {
      this.fissure.vie -= dt;
      if (this.fissure.vie <= 0) this.fissure = null;
    }
  }
}
