import { vibre, type MoteurSon } from '@audio/son';
import type { Evenement, Partie } from '@core/types';
import type { Effets } from '@render/effets';
import { NOMS_SUPER } from '@core/super-coup';
import { C, COULEURS_SUPER, EQUIPES, NOMS_COUPS } from '@render/palette';
import { COULEURS_QUALITE } from '@core/qualite';
import type { Projection } from '@render/projection';

/** Hauteur (m) des bulles de texte au-dessus du joueur qui frappe. */
const HAUT_BULLE = 2.6;
/** Raisons de point annoncées comme exploits : la foule explose. */
const exploit = (raison: string) => raison.startsWith('POR') || NOMS_SUPER.some((n) => n && n === raison);

/**
 * Joue les effets de bord des évènements émis par la simulation : sons,
 * particules, annonces, vibrations. C'est le seul endroit où le jeu « fait du
 * bruit ».
 */
export function joueEvenements(
  jeu: Partie,
  evs: readonly Evenement[],
  fx: Effets,
  son: MoteurSon,
  K: Projection,
): void {
  const match = jeu.mode === 'match';
  const moi = jeu.humain?.eq ?? 0; // l'équipe de cet écran
  for (const ev of evs) {
    switch (ev.type) {
      case 'impact': {
        const [sx, sy] = K.proj(ev.x, ev.y, ev.z);
        if (ev.surface === 'sol') {
          if (ev.force > 1) {
            son.sol();
            fx.poussiere(sx, sy, 3);
          }
        } else if (ev.surface === 'vitre') {
          son.vitre(Math.min(1, ev.force / 18));
          fx.etincelles(sx, sy, 6, '#dff4ff', 70);
          if (ev.force > 14) fx.secousse = Math.max(fx.secousse, 1.5);
        } else if (ev.surface === 'grille') {
          son.grille();
          fx.etincelles(sx, sy, 5, '#8fa0bf', 50);
        } else {
          son.filet();
          fx.poussiere(sx, sy, 4, '#c9cfe0');
        }
        break;
      }
      case 'frappe': {
        const [sx, sy] = K.proj(ev.x, ev.y, HAUT_BULLE);
        const p = ev.puissance;
        const couleurQ = COULEURS_QUALITE[ev.q] ?? C.blanc;
        if (ev.sv > 0) {
          // super coup : explosion de la couleur de sa variante, nom géant, tout l'écran vibre
          const c = COULEURS_SUPER[ev.sv] ?? C.or;
          son.superCoup(ev.sv);
          fx.secousse = 8;
          fx.flash = 0.5;
          fx.etincelles(sx, sy - 4, 50, c, 150);
          fx.etincelles(sx, sy - 4, 20, '#ffffff', 100);
          fx.annonce(NOMS_SUPER[ev.sv] ?? 'SUPER !', 'SUPER COUP', c, 1.3);
          fx.bulle('SUPER !!', sx, sy - 10, c);
          if (ev.humain) vibre(90);
          break;
        }
        if (ev.coup === 'smash') {
          son.smash();
          fx.secousse = (2 + 2 * p) * (0.4 + 0.12 * ev.q);
          fx.flash = 0.15 * p;
          fx.etincelles(sx, sy - 4, 10 + Math.round(10 * p), couleurQ);
          if (ev.humain) vibre(45);
        } else {
          son.frappe(p);
          if (ev.humain) vibre(p > 0.8 ? 25 : 12);
        }
        // le nom du coup, de la couleur de sa qualité : rouge très médiocre, vert parfait
        const nom = ev.portres ? 'PAR 3 !!' : NOMS_COUPS[ev.coup];
        fx.bulle(ev.q === 5 ? `${nom} !` : nom, sx, sy - 10, couleurQ);
        if (ev.q === 5) {
          son.parfait();
          fx.etincelles(sx, sy - 4, 14, COULEURS_QUALITE[5], 80);
        }
        break;
      }
      case 'service': {
        son.frappe(0.4 + ev.jauge * 0.4);
        const [sx, sy] = K.proj(ev.x, ev.y, HAUT_BULLE);
        fx.bulle(ev.service === 'plat' ? 'PLAT' : 'COUPE', sx, sy - 10, C.blanc);
        if (ev.humain) vibre(15);
        break;
      }
      case 'jaugeLancee':
        son.clic();
        break;
      case 'point': {
        const sous = match ? (ev.gagnant === moi ? 'POINT POUR VOUS' : 'POINT ADVERSE') : null;
        fx.annonce(ev.raison, sous, EQUIPES[ev.gagnant].maillot, 1.6);
        son.point(match ? ev.gagnant === moi : true);
        son.ovation(exploit(ev.raison) ? 1 : 0.45);
        fx.excite = exploit(ev.raison) ? 1 : 0.5;
        if (match && ev.gagnant === moi) vibre(30);
        break;
      }
      case 'faute':
        fx.annonce('FAUTE', `${ev.raison} - 2E BALLE`, C.or, 1.2);
        son.point(false);
        break;
      case 'let':
        fx.annonce('LET', 'BALLE A REJOUER', C.blanc, 1.2);
        break;
      case 'jeu':
        fx.annonce(
          `JEU ${match ? EQUIPES[ev.gagnant].nom : ''}`,
          `${ev.jeux[0]} - ${ev.jeux[1]}`,
          EQUIPES[ev.gagnant].maillot,
          1.6,
        );
        break;
      case 'pointEnOr':
        fx.annonce('POINT EN OR', 'QUI LE PREND GAGNE LE JEU', C.or, 1.6);
        break;
      case 'finMatch':
        if (ev.gagnant === moi) {
          son.ovation(1);
          fx.confettis(K.cx, K.yF, moi);
        }
        break;
    }
  }
}
