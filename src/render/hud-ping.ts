import { qualitePing, texteLatence } from '@piascwal/lan-kit';
import { C } from './palette';
import { texte } from './police';
import type { Vue } from './vue';

/** Un joueur en réseau, avec sa latence vue par l'hôte. */
export interface LignePing {
  nom: string;
  ms: number | null;
  moi: boolean;
}

const COULEURS = { bon: '#5fe0a0', moyen: C.or, mauvais: '#ff7a90', inconnu: C.grisBleu } as const;

/** Le ping de chaque joueur en réseau, discrètement dans le coin de la piste. */
export function dessinePings(v: Vue, lignes: readonly LignePing[]): void {
  const { g } = v;
  lignes.forEach((l, i) => {
    const y = 4 + i * 9;
    const c = COULEURS[qualitePing(l.ms)];
    g.fillStyle = c;
    g.fillRect(4, y + 2, 3, 3);
    texte(
      g,
      `${l.nom.slice(0, 10)} ${texteLatence(l.ms)}`,
      10,
      y,
      l.moi ? C.blanc : C.grisBleu,
      1,
      'g',
      null,
    );
  });
}
