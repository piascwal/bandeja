import { clamp01, h } from './finale-outils';
import { texte } from './police';
import { px } from './primitives';
import type { Vue } from './vue';

/**
 * L'écran bleu de l'erreur 404 : il remplace le jeu quelques secondes, avec son message qui s'écrit ligne après
 * ligne et sa barre de redémarrage, puis le « téléviseur » s'éteint (l'image se réduit en ligne puis en point).
 * `p` : avancement de l'écran bleu (0 → 1) ; `sortie` : avancement de l'extinction (0 → 1).
 */
const BLEU = '#0000a8';

export function ecranBleu(v: Vue, p: number, sortie: number, t: number): void {
  const { g, W, H } = v;
  const cx = Math.round(W / 2);
  // l'extinction : l'image s'écrase en une ligne lumineuse, puis en un point, sur fond noir
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const ecrase = sortie > 0 ? Math.max(0.012, (1 - clamp01(sortie / 0.6)) ** 2) : 1;
  const largeur = sortie > 0.6 ? Math.max(2, (1 - (sortie - 0.6) / 0.4) * W) : W;
  const hh = Math.round(H * ecrase);
  g.save();
  g.beginPath();
  g.rect(Math.round((W - largeur) / 2), Math.round((H - hh) / 2), Math.round(largeur), hh);
  g.clip();
  g.fillStyle = sortie > 0.4 ? '#cfd8ff' : BLEU;
  g.fillRect(0, 0, W, H);
  if (sortie === 0) contenu(g, W, H, cx, p, t);
  g.restore();
  // le balayage de lignes d'un vieux téléviseur
  g.globalAlpha = 0.12;
  g.fillStyle = '#000';
  for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
  g.globalAlpha = 1;
}

function contenu(g: CanvasRenderingContext2D, W: number, H: number, cx: number, p: number, t: number): void {
  const blanc = '#ffffff';
  const e = H >= 160 ? 2 : 1;
  // le titre en vidéo inversée
  const titre = 'CRT_TENNIS';
  const lt = titre.length * 6 * e;
  px(g, cx - lt / 2 - 6, H * 0.08, lt + 12, 7 * e + 4, blanc);
  texte(g, titre, cx, H * 0.08 + 2, BLEU, e, 'c', null);
  const lignes: [string, number, number][] = [
    ['404', H * 0.2, 5],
    ['ERREUR SYSTEME', H * 0.46, 2],
    ['CRT_TENNIS_ERREUR_404', H * 0.56, 2],
  ];
  lignes.forEach(([txt, y, taille], i) => {
    if (p < i * 0.06) return;
    texte(
      g,
      txt,
      cx,
      y,
      blanc,
      Math.max(1, Math.min(taille, Math.floor((W - 20) / (txt.length * 6)))),
      'c',
      null,
    );
  });
  const petites = [
    'LA BALLE A TRAVERSE L ECRAN.',
    'LA PARTIE NE PEUT PLUS CONTINUER.',
    'REDEMARRAGE EN COURS...',
  ];
  petites.forEach((l, i) => {
    if (p > 0.2 + i * 0.08) texte(g, l, cx, H * 0.7 + i * 11, blanc, 1, 'c', null);
  });
  // la barre de redémarrage
  const bw = Math.round(W * 0.5);
  const by = Math.round(H * 0.7 + 3 * 11 + 4);
  px(g, cx - bw / 2 - 2, by - 2, bw + 4, 8, blanc);
  px(g, cx - bw / 2, by, bw, 4, BLEU);
  px(g, cx - bw / 2, by, Math.round(bw * clamp01(p * 1.05)), 4, blanc);
  texte(g, `${Math.floor(clamp01(p * 1.05) * 100)}%`, cx, by + 9, blanc, 1, 'c', null);
  // quelques adresses mémoire qui défilent
  for (let i = 0; i < 3; i++) {
    const hex = `0X${(0x404e0000 + Math.floor(h(i + Math.floor(t * 6)) * 0xffff)).toString(16).toUpperCase()}`;
    texte(g, hex, 6, H - 40 + i * 9, '#7a7aff', 1, 'g', null);
  }
}
