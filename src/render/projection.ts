import { LARG, MIL } from '@core/constants';

/** Hauteur réservée en haut de l'écran pour le tableau des scores. */
const HAUT_TABLEAU = 24;

/**
 * Projection de la piste à l'écran, vue de côté en légère perspective. Elle
 * est en miroir : x = 0 est à droite de l'écran, pour que votre équipe
 * (l'équipe 0) joue à droite, loin des commandes de gauche.
 *
 * kF / kN : pixels par mètre au fond / devant ; kz : pixels par mètre de
 * hauteur (devant) ; yF / yN : lignes de fond à l'écran ; cx : le filet.
 */
export class Projection {
  cx = 200;
  yF = 80;
  yN = 170;
  kF = 14;
  kN = 18;
  kz = 11;

  /** Point de la piste (m) → pixel logique de l'écran. */
  proj(x: number, y: number, z = 0): [number, number] {
    const t = y / LARG;
    const k = this.kF + (this.kN - this.kF) * t;
    return [this.cx - (x - MIL) * k, this.yF + t * (this.yN - this.yF) - (z * this.kz * k) / this.kN];
  }

  /** Cale la piste dans un écran logique de W x H pixels (paysage). */
  place(W: number, H: number): void {
    const kN = Math.max(12, Math.min((W - 16) / 20, (H - HAUT_TABLEAU - 6) / 6.5));
    this.kN = kN;
    this.kF = kN * 0.8;
    this.kz = kN * 0.62;
    const prof = Math.round(kN * 4.4);
    const hauteur = prof + 4 * this.kz * 0.8;
    const libre = Math.max(0, H - HAUT_TABLEAU - 6 - hauteur);
    this.yN = Math.round(H - 6 - libre * 0.6);
    this.yF = this.yN - prof;
    this.cx = Math.round(W / 2);
  }
}
