import { ACCEL_MAX } from '@core/constants';
import { accelerationEchange } from '@core/coups';
import type { Partie } from '@core/types';
import { C, EQUIPES } from './palette';
import { texte } from './police';
import { px } from './primitives';
import type { Vue } from './vue';

/** Couleur du compteur d'échange : il chauffe avec la vitesse de la balle. */
function couleurEchange(n: number): string {
  if (n >= 18) return '#ff3b1f';
  if (n >= 12) return '#ff8a3c';
  if (n >= 6) return C.or;
  return C.blanc;
}

/**
 * Sous le tableau des scores : le compteur d'échange (coups depuis le service,
 * et la vitesse de la balle qui augmente) et la jauge de smash de chaque
 * équipe, avec la même disposition que le tableau (équipe 1 à gauche).
 */
export function dessineEchange(v: Vue, jeu: Partie): void {
  const { g, W } = v;
  const cx = Math.round(W / 2);
  const y = 24;
  // les jauges de smash : une barre sous chaque camp, qui clignote quand elle est pleine
  const lw = 168;
  const x0 = cx - lw / 2;
  for (const eq of [1, 0] as const) {
    const gauche = eq === 1;
    const k = jeu.jaugeSmash[eq];
    const w = 44;
    const x = gauche ? x0 + 4 : x0 + lw - 4 - w;
    const pleine = k >= 1;
    px(g, x - 1, y - 1, w + 2, 6, C.contour);
    px(g, x, y, w, 4, '#0f1328');
    const couleur =
      pleine && Math.floor(jeu.temps * 6) % 2 === 0 ? '#ffffff' : pleine ? C.or : EQUIPES[eq].clair;
    px(g, gauche ? x : x + w - Math.round(w * k), y, Math.round(w * k), 4, couleur);
    if (pleine) texte(g, 'PAR 3 !', x + w / 2, y + 7, C.or, 1, 'c');
  }
  // le compteur d'échange, au centre
  if (jeu.phase !== 'jeu' || jeu.echange < 3) return;
  const bonus = Math.round((accelerationEchange(jeu.echange) - 1) * 100);
  const maxi = bonus >= Math.round(ACCEL_MAX * 100);
  const pulse = jeu.echange >= 12 && Math.floor(jeu.temps * 8) % 2 === 0;
  texte(g, `ECHANGE ${jeu.echange}`, cx, y - 1, pulse ? '#ffffff' : couleurEchange(jeu.echange), 1, 'c');
  if (bonus > 0) texte(g, `BALLE +${maxi ? 'MAX' : bonus}`, cx, y + 8, couleurEchange(jeu.echange), 1, 'c');
}
