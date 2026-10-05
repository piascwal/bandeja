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

/** La variante du super coup en vol (0 : aucun) : elle décide des effets de ses impacts. */
let superEnCours = 0;
/** Le dernier impact à l'écran : c'est là que la fin spectaculaire du super coup se joue. */
let dernierImpact: [number, number] = [0, 0];

/** Les effets d'un impact de super coup : cratère, vitre qui explose, écran qui se fissure. */
function impactSuper(
  variante: number,
  ev: Extract<Evenement, { type: 'impact' }>,
  sx: number,
  sy: number,
  fx: Effets,
  son: MoteurSon,
): void {
  const c = COULEURS_SUPER[variante] ?? C.or;
  dernierImpact = [sx, sy];
  if (ev.surface === 'vitre') {
    fx.abime('vitre', ev.x, ev.y, ev.z, variante);
    // la balle traverse la vitre : elle vole en éclats
    son.vitre(1);
    son.smash();
    fx.eclatsVitre(sx, sy);
    fx.etincelles(sx, sy, 30, c, 180);
    fx.secousse = 14;
    fx.flash = 0.7;
  } else if (ev.surface === 'sol') {
    // toujours le sol d'abord : la balle y tape, puis elle part (la scène finale s'ouvre sur ce choc)
    if (!fx.finale.declenchee) fx.finale.declenche(variante, sx, sy);
    fx.abime('sol', ev.x, ev.y, 0, variante);
    fx.debris(sx, sy);
    fx.etincelles(sx, sy, 50, c, 170);
    fx.poussiere(sx, sy, 30, '#ffb36a');
    fx.secousse = 12;
    fx.flash = 0.8;
    // l'éclair fait voler l'écran en éclats : l'écran se fissure
    if (variante === 4) fx.fissurer(sx, sy);
  }
}

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
        if (superEnCours) impactSuper(superEnCours, ev, sx, sy, fx, son);
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
        superEnCours = ev.sv;
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
        superEnCours = 0;
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
        if (superEnCours > 0 && match) {
          // super coup : la scène finale (ouverte au choc sur le sol) se joue d'abord, le bandeau vient à sa fin, avant le ralenti
          if (!fx.finale.declenchee) fx.finale.declenche(superEnCours, dernierImpact[0], dernierImpact[1]);
          fx.differe(ev.raison, sous, EQUIPES[ev.gagnant].maillot);
          superEnCours = 0;
        } else fx.annonce(ev.raison, sous, EQUIPES[ev.gagnant].maillot, 1.6);
        son.point(match ? ev.gagnant === moi : true);
        son.ovation(exploit(ev.raison) ? 1 : 0.45);
        fx.excite = exploit(ev.raison) ? 1 : 0.5;
        if (match && ev.gagnant === moi) vibre(30);
        break;
      }
      case 'parade': {
        if (ev.ok) {
          // super coup arrêté : plus de scène finale
          superEnCours = 0;
          son.parfait();
          fx.flash = 0.5;
          fx.secousse = 6;
          fx.annonce('PARE !', 'SUPER COUP ARRETE', COULEURS_QUALITE[5] ?? C.blanc, 1.2);
        } else fx.annonce('RATE', null, C.or, 0.8); // le super coup suit sa route : sa scène finale aura lieu
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
