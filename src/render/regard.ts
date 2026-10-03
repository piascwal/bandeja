import type { Joueur, Partie } from '@core/types';

interface Visuel {
  /** où regarde le joueur à l'écran (+1 : à droite) */
  regard: number;
  /** pose de course affichée (avec hystérésis, pour ne pas clignoter) */
  court: boolean;
}

/**
 * État purement visuel des joueurs, propre à chaque écran : le regard et la
 * pose de course dépendent du point de vue (écran en miroir ou non), la
 * simulation ne les connaît pas et le réseau ne les transmet pas.
 */
export class VueJoueurs {
  private readonly etats = new Map<number, Visuel>();

  /** `miroir` : x = 0 est à droite de l'écran (cas de l'équipe 0). */
  constructor(public miroir = true) {}

  /** +1 : le sens x de la piste va vers la droite de l'écran. */
  private get sens(): 1 | -1 {
    return this.miroir ? -1 : 1;
  }

  etat(s: Joueur): Visuel {
    let e = this.etats.get(s.id);
    if (!e) {
      e = { regard: this.sens * s.face, court: false };
      this.etats.set(s.id, e);
    }
    return e;
  }

  /** Regard à l'écran (jamais nul : à défaut, vers le filet). */
  regard(s: Joueur): number {
    return this.etat(s).regard || this.sens * s.face;
  }

  /**
   * Pendant l'échange, c'est la balle qui décide, sauf quand elle est au-dessus
   * de lui ou juste derrière : la pose de smash la couvre, inutile de se
   * retourner. Hors échange, il regarde là où il court, sinon le filet.
   */
  maj(jeu: Partie, s: Joueur): void {
    const e = this.etat(s);
    const b = jeu.balle;
    if (s.tourne > 0) {
      e.regard = this.sens * s.faceCoup; // rebond voulu contre sa vitre
      return;
    }
    if (jeu.phase === 'jeu') {
      const dx = this.sens * (b.x - s.x); // en mètres, dans le sens de l'écran
      const proche = Math.hypot(b.x - s.x, b.y - s.y) < 1.6;
      const auDessus = proche && b.z > 1.6;
      const justeDerriere = Math.sign(dx) === -e.regard && Math.abs(dx) < 1;
      if (!auDessus && !justeDerriere && Math.abs(dx) > 0.15) e.regard = Math.sign(dx);
    } else {
      const vx = this.sens * s.vx;
      if (Math.abs(vx) > 0.8) e.regard = Math.sign(vx);
      else if (jeu.phase === 'service') e.regard = this.sens * s.face;
    }
  }

  /** Nouvelle partie : on oublie le regard des joueurs de la précédente. */
  reinitialise(): void {
    this.etats.clear();
  }

  majTous(jeu: Partie): void {
    for (const s of jeu.joueurs) this.maj(jeu, s);
  }
}
