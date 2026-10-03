import { JEUX, NIVEAUX } from '@core/constants';
import type { Partie } from '@core/types';
import { C, EQUIPES } from './palette';
import { largeurTexte, texte } from './police';
import { bouton, panneau, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

/** Les réglages affichés au menu et leurs bilans. */
export interface ReglagesMenu {
  niveau: number;
  jeux: number;
  son: boolean;
  victoires: number[];
  matchs: number[];
}

export interface ActionsMenu {
  joue: () => void;
  niveauSuivant: () => void;
  jeuxSuivants: () => void;
  basculeSon: () => void;
}

const BLEU = { couleur: '#1f7fb3', clair: '#6fd0ff', fonce: '#0f4d73' };
const ROUGE = { couleur: '#d12f4c', clair: '#ff7a90', fonce: '#8c1b3a' };

export function dessineMenu(
  v: Vue,
  zones: ZoneBouton[],
  r: ReglagesMenu,
  a: ActionsMenu,
  tactile: boolean,
  t: number,
  version: string,
): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.45);
  const cx = Math.round(W / 2);
  const titre = 'BANDEJA!';
  const e = W > 300 ? 4 : 3;
  const ox = cx - largeurTexte(titre, e) / 2;
  const ty = Math.max(6, Math.round(H * 0.04));
  for (let i = 0; i < titre.length; i++) {
    const dy = Math.round(Math.sin(t * 3 + i * 0.6) * 1.5);
    const col = i < 3 ? EQUIPES[0].maillot : i < 7 ? C.balle : EQUIPES[1].maillot;
    texte(g, titre[i]!, ox + i * 6 * e + 2.5 * e, ty + dy, col, e, 'c');
  }
  texte(g, 'PADEL ARCADE', cx, ty + 7 * e + 5, C.or, 1, 'c');

  const pw = 196;
  const ph = 91;
  const py = ty + 7 * e + 16;
  panneau(g, cx - pw / 2, py, pw, ph);
  const lignes: [string, string, () => void][] = [
    ['NIVEAU', NIVEAUX[r.niveau]!.nom, a.niveauSuivant],
    ['MATCH', `${JEUX[r.jeux]} JEUX`, a.jeuxSuivants],
    ['SON', r.son ? 'OUI' : 'NON', a.basculeSon],
  ];
  lignes.forEach(([k, val, act], i) => {
    const y = py + 5 + i * 15;
    texte(g, k, cx - pw / 2 + 10, y + 4, C.gris, 1, 'g');
    bouton(g, zones, `< ${val} >`, cx - 14, y, 104, 13, act, { couleur: '#232a58' });
  });
  const pulse = Math.sin(t * 5) > 0;
  bouton(g, zones, 'JOUER', cx - 50, py + ph - 29, 100, 24, a.joue, {
    ...ROUGE,
    e: 2,
    couleur: pulse ? '#e63a58' : ROUGE.couleur,
  });

  const vict = r.victoires[r.niveau] ?? 0;
  const mt = r.matchs[r.niveau] ?? 0;
  const aide = [
    mt ? `VICTOIRES ${vict} / ${mt}` : 'EN DOUBLE : VOUS EN HAUT A DROITE, AVEC UN CPU',
    tactile
      ? 'BOUTONS EN LOSANGE : FRAPPE COUPE LOBE AMORTI'
      : 'K FRAPPE  J COUPE  L LOBE  I AMORTI  MAJ COURIR',
    'BALLE HAUTE : BANDEJA AU CENTRE, VIBORA JOYSTICK HAUT/BAS',
    'JOYSTICK VERS UNE VITRE A L IMPACT : REBOND CONTRE LA VITRE',
  ];
  const bas = py + ph + 5;
  aide.forEach((l, i) => {
    if (bas + 8 + i * 10 + (i ? 1 : 0) < H) texte(g, l, cx, bas + i * 10, i ? C.grisBleu : C.gris, 1, 'c');
  });
  texte(g, version, W - 3, H - 9, '#3a4166', 1, 'd', null);
}

export function dessinePause(
  v: Vue,
  zones: ZoneBouton[],
  reprendre: () => void,
  abandonner: () => void,
): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.6);
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  texte(g, 'PAUSE', cx, cy - 40, C.blanc, 3, 'c');
  bouton(g, zones, 'REPRENDRE', cx - 55, cy - 6, 110, 18, reprendre, BLEU);
  bouton(g, zones, 'ABANDONNER', cx - 55, cy + 18, 110, 18, abandonner);
}

export function dessineFin(
  v: Vue,
  zones: ZoneBouton[],
  jeu: Partie,
  r: ReglagesMenu,
  rejouer: () => void,
  menu: () => void,
  t: number,
): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.62);
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  const gagne = jeu.jeux[0] > jeu.jeux[1];
  const titre = gagne ? 'VICTOIRE !' : 'DEFAITE';
  texte(g, titre, cx, cy - 60 + Math.round(Math.sin(t * 4) * 1.5), gagne ? C.or : EQUIPES[1].maillot, 3, 'c');
  texte(g, `${jeu.jeux[0]} - ${jeu.jeux[1]}`, cx, cy - 32, C.blanc, 2, 'c');
  const st = jeu.stats;
  texte(g, `COUPS GAGNANTS  ${st.gagnants[0]} - ${st.gagnants[1]}`, cx, cy - 12, C.gris, 1, 'c');
  texte(g, `POR TRES  ${st.portres[0]} - ${st.portres[1]}`, cx, cy - 2, C.gris, 1, 'c');
  bouton(g, zones, 'REJOUER', cx - 108, cy + 12, 100, 20, rejouer, ROUGE);
  bouton(g, zones, 'MENU', cx + 8, cy + 12, 100, 20, menu);
  const bilan = `NIVEAU ${NIVEAUX[r.niveau]!.nom}   VICTOIRES ${r.victoires[r.niveau] ?? 0} / ${r.matchs[r.niveau] ?? 0}`;
  texte(g, bilan, cx, cy + 42, C.grisBleu, 1, 'c');
}

/**
 * Premier écran, par-dessus le menu : un seul geste (clic, appui, touche)
 * suffit à passer en plein écran, avant que le joueur touche un vrai bouton.
 */
export function dessineDemarrage(v: Vue, t: number): void {
  const { g, W, H } = v;
  voile(g, W, H, 0.82);
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  texte(g, 'APPUYEZ POUR COMMENCER', cx, cy - 5, Math.sin(t * 5) > 0 ? C.or : C.blanc, 2, 'c');
  texte(g, 'LE JEU PASSE EN PLEIN ECRAN', cx, cy + 15, C.grisBleu, 1, 'c');
}

/** En portrait : un téléphone qui tourne, pour inviter à passer en paysage. */
export function dessinePortrait(v: Vue, t: number): void {
  const { g, W, H } = v;
  g.fillStyle = C.nuit;
  g.fillRect(0, 0, W, H);
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  const a = ((Math.sin(t * 2) * 0.5 + 0.5) * Math.PI) / 2;
  g.save();
  g.translate(cx, cy - 30);
  g.rotate(-a);
  g.fillStyle = C.contour;
  g.fillRect(-15, -26, 30, 52);
  g.fillStyle = '#b6c2e0';
  g.fillRect(-14, -25, 28, 50);
  g.fillStyle = '#2459ad';
  g.fillRect(-12, -21, 24, 40);
  g.fillStyle = '#eef3ff';
  g.fillRect(-12, -1, 24, 1);
  g.fillStyle = '#c9cfe0';
  g.fillRect(-1, -21, 2, 40);
  g.restore();
  texte(g, 'TOURNEZ', cx, cy + 20, C.blanc, 2, 'c');
  texte(g, 'VOTRE TELEPHONE', cx, cy + 40, C.or, 1, 'c');
  texte(g, 'LE MATCH SE JOUE', cx, cy + 58, C.gris, 1, 'c');
  texte(g, 'EN PAYSAGE', cx, cy + 68, C.gris, 1, 'c');
}
