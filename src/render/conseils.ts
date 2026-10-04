import { HAUT_SMASH } from '@core/constants';
import { contrainte } from '@core/coups';
import { SUPER_CHARGE } from '@core/humain';
import type { Partie } from '@core/types';
import { C } from './palette';
import { largeurTexte, texte } from './police';
import { px } from './primitives';
import type { Vue } from './vue';

/** Le conseil du moment, selon ce que fait le joueur : courts, pour tenir entre le joystick et les boutons. */
export function conseil(jeu: Partie): { txt: string; couleur: string } | null {
  const s = jeu.humain;
  if (!s || jeu.phase !== 'jeu') return null;
  const b = jeu.balle;
  if (s.intent) {
    if (s.charge >= SUPER_CHARGE) return { txt: 'SUPER PRET ! LAISSE-LA ARRIVER', couleur: C.or };
    return { txt: 'COUP ARME : IL PART TOUT SEUL', couleur: C.blanc };
  }
  if (b.camp !== s.eq) return null;
  if (contrainte(b, s)) return { txt: 'LOB SUBI : PAS DE SMASH', couleur: '#ff7a90' };
  if (jeu.jaugeSmash[s.eq] >= 1 && b.z > HAUT_SMASH) return { txt: 'SMASH GARANTI : PAR 3 !', couleur: C.or };
  return { txt: 'APPUIE SUR UN COUP : IL PART SEUL', couleur: C.gris };
}

/** Une ligne d'aide au bas de l'écran, entre le joystick et les boutons : on comprend ce qui se passe. */
export function dessineConseil(v: Vue, jeu: Partie): void {
  const c = conseil(jeu);
  if (!c) return;
  const { g, W, H } = v;
  const cx = Math.round(W / 2);
  const w = largeurTexte(c.txt) + 8;
  g.globalAlpha = 0.75;
  px(g, cx - Math.round(w / 2), H - 15, w, 11, C.contour);
  g.globalAlpha = 1;
  texte(g, c.txt, cx, H - 13, c.couleur, 1, 'c');
}
