import { clamp } from '@core/aleatoire';
import type { Bouton, Commande } from '@core/types';
import {
  boutonProche,
  PART_JOYSTICK,
  RAYON_JOY,
  zonePause,
  type OptionsBoutons,
  type ToucheEcran,
} from './disposition';

export interface PointLogique {
  x: number;
  y: number;
}

/** Ce que les entrées demandent à l'application. */
export interface HotesEntrees {
  /** taille logique de l'écran */
  dims(): { W: number; H: number };
  /** convertit une position du pointeur en pixels logiques */
  versLogique(e: PointerEvent): PointLogique;
  portrait(): boolean;
  /** un match se joue (ni menu, ni pause, ni fin) */
  enJeu(): boolean;
  /** la disposition des boutons de cette partie (CHANGE présent ou non, service) */
  boutons(): OptionsBoutons;
  /** la parade d'un super coup attend un appui de cet écran : n'importe quel toucher l'arrête */
  parade(): boolean;
  /**
   * Un geste de l'utilisateur (audio, plein écran). Renvoie true s'il est
   * consommé par l'écran de démarrage : il ne doit alors rien déclencher d'autre.
   */
  geste(): boolean;
  /** moment où le navigateur accepte le plein écran (souris : appui ; doigt : relâché ; clavier) */
  pleinEcran(): void;
  pause(): void;
  /** Échap / P */
  basculePause(): void;
  /** Entrée */
  valide(): void;
  /** appui hors du match (menus) */
  appuiInterface(p: PointLogique): void;
}

/** Au clavier, les mêmes boutons : K FRAPPE, J AMORTI, L LOBE, I SUPER (Espace aussi), U CHANGE. */
const TOUCHES_COUPS: Record<string, Bouton> = {
  KeyK: 'plat',
  KeyJ: 'amorti',
  KeyL: 'lobe',
  KeyI: 'smash',
  KeyU: 'change',
  Space: 'smash',
};
const GAUCHE = ['ArrowLeft', 'KeyA', 'KeyQ'];
const DROITE = ['ArrowRight', 'KeyD'];
const HAUT = ['ArrowUp', 'KeyW', 'KeyZ'];
const BAS = ['ArrowDown', 'KeyS'];

/** Clavier + tactile → Commande pour la simulation. */
export class Entrees {
  readonly touches = new Set<string>();
  joy: { id: number; bx: number; by: number; x: number; y: number } | null = null;
  /** bouton tenu par chaque doigt */
  ids = new Map<number, ToucheEcran>();
  private appuis: Bouton[] = [];
  tactile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  constructor(
    private readonly ecran: HTMLCanvasElement,
    private readonly h: HotesEntrees,
  ) {
    ecran.addEventListener('pointerdown', (e) => this.surAppui(e), { passive: false });
    ecran.addEventListener('pointermove', (e) => this.surDeplacement(e));
    ecran.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') this.h.pleinEcran();
      this.relache(e);
    });
    ecran.addEventListener('pointercancel', (e) => this.relache(e));
    ecran.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.surTouche(e));
    window.addEventListener('keyup', (e) => this.touches.delete(e.code));
  }

  /** Oublie tous les doigts et touches (pause, changement d'écran). */
  reinitialise(): void {
    this.joy = null;
    this.ids.clear();
    this.appuis = [];
    this.touches.clear();
  }

  /** La commande du pas en cours ; les appuis ne sont rendus qu'une fois. */
  lireCommande(): Commande {
    const enfonce = (codes: string[]) => codes.some((c) => this.touches.has(c));
    let dx = (enfonce(DROITE) ? 1 : 0) - (enfonce(GAUCHE) ? 1 : 0);
    let dy = (enfonce(BAS) ? 1 : 0) - (enfonce(HAUT) ? 1 : 0);
    if (dx || dy) {
      const m = Math.hypot(dx, dy);
      dx /= m;
      dy /= m;
    }
    if (this.joy) {
      const jx = (this.joy.x - this.joy.bx) / RAYON_JOY;
      const jy = (this.joy.y - this.joy.by) / RAYON_JOY;
      const m = Math.hypot(jx, jy);
      if (m > 0.12) {
        const k = Math.min(1, m) / m;
        dx = jx * k;
        dy = jy * k;
      }
    }
    const appuis = this.appuis;
    this.appuis = [];
    return { dx, dy, appuis };
  }

  private surAppui(e: PointerEvent): void {
    e.preventDefault();
    if (e.pointerType === 'touch') this.tactile = true;
    if (e.pointerType === 'mouse') this.h.pleinEcran();
    if (this.h.geste()) return;
    if (this.h.portrait()) return;
    const p = this.h.versLogique(e);
    if (!this.h.enJeu()) {
      this.h.appuiInterface(p);
      return;
    }
    const { W, H } = this.h.dims();
    const zp = zonePause(W);
    if (p.x >= zp.x - 4 && p.y <= zp.y + zp.h + 4 && p.y >= 0) {
      this.h.pause();
      return;
    }
    if (this.h.parade()) {
      this.appuis.push('plat');
      return;
    }
    if (p.x < W * PART_JOYSTICK) {
      const bx = clamp(p.x, RAYON_JOY + 4, W * PART_JOYSTICK);
      const by = clamp(p.y, RAYON_JOY + 30, H - RAYON_JOY - 4);
      this.joy = { id: e.pointerId, bx, by, x: p.x, y: p.y };
    } else {
      const b = boutonProche(W, H, p.x, p.y, this.h.boutons());
      if (b) {
        this.appuis.push(b);
        this.ids.set(e.pointerId, b);
      }
    }
    try {
      this.ecran.setPointerCapture(e.pointerId);
    } catch {
      /* ignoré */
    }
  }

  private surDeplacement(e: PointerEvent): void {
    if (!this.joy || e.pointerId !== this.joy.id) return;
    const p = this.h.versLogique(e);
    this.joy.x = p.x;
    this.joy.y = p.y;
    // la base du joystick suit le pouce s'il s'éloigne trop
    const dx = p.x - this.joy.bx;
    const dy = p.y - this.joy.by;
    const d = Math.hypot(dx, dy);
    const max = RAYON_JOY * 1.6;
    if (d > max) {
      this.joy.bx = p.x - (dx / d) * max;
      this.joy.by = p.y - (dy / d) * max;
    }
  }

  private relache(e: PointerEvent): void {
    if (this.joy && e.pointerId === this.joy.id) this.joy = null;
    this.ids.delete(e.pointerId);
  }

  private surTouche(e: KeyboardEvent): void {
    // un champ de saisie (pseudo, code) est ouvert : ces touches sont du texte, pas des commandes
    if (e.target instanceof HTMLInputElement) return;
    if (e.repeat) return;
    if (e.code !== 'Escape') this.h.pleinEcran();
    if (this.h.geste()) return;
    this.touches.add(e.code);
    const coup = TOUCHES_COUPS[e.code];
    if (coup) {
      if (this.h.enJeu()) this.appuis.push(coup);
      e.preventDefault();
    }
    if (e.code === 'Escape' || e.code === 'KeyP') this.h.basculePause();
    if (e.code === 'Enter') this.h.valide();
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }
}
