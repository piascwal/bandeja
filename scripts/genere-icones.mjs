// Génère les icônes de l'app (PWA, écran d'accueil, onglet) à partir de
// l'illustration carrée assets/icone-app.jpg : la remplacer puis lancer
// `npm run icones` pour changer l'icône. Les PNG produits sont committés dans
// public/icons/.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const illustration = await loadImage(new URL('../assets/icone-app.jpg', import.meta.url));

/** Recadre l'illustration au centre (si elle n'est pas carrée) et la met à la taille demandée. */
function icone(taille) {
  const c = createCanvas(taille, taille);
  const g = c.getContext('2d');
  const cote = Math.min(illustration.width, illustration.height);
  const sx = (illustration.width - cote) / 2;
  const sy = (illustration.height - cote) / 2;
  g.imageSmoothingQuality = 'high';
  g.drawImage(illustration, sx, sy, cote, cote, 0, 0, taille, taille);
  return c.toBuffer('image/png');
}

const sortie = (nom) => new URL(`../public/icons/${nom}`, import.meta.url);
writeFileSync(sortie('icon-180.png'), icone(180)); // apple-touch-icon (iPhone, iPad)
writeFileSync(sortie('icon-192.png'), icone(192));
writeFileSync(sortie('icon-512.png'), icone(512));
// l'illustration couvre déjà toute la surface (fond de piste jusqu'aux bords) :
// elle convient telle quelle aux icônes « maskable » rognées en cercle ou en goutte
writeFileSync(sortie('icon-maskable-512.png'), icone(512));
console.log('icônes générées dans public/icons/');
