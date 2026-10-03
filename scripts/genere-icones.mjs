// Génère les icônes de l'app (PWA, écran d'accueil) à partir du joueur dessiné
// en attente (public/sprites/attente.png), sur le fond de nuit du jeu.
// Les PNG produits sont committés dans public/icons/ : à relancer seulement si
// le dessin change (npm run icones).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const NUIT = '#070914';
const GAZON = '#2459ad';
const joueur = await loadImage(new URL('../public/sprites/attente.png', import.meta.url));

/** marge : part de l'icône laissée libre autour du dessin (les icônes « maskable » sont rognées). */
function icone(taille, marge) {
  const c = createCanvas(taille, taille);
  const g = c.getContext('2d');
  g.fillStyle = NUIT;
  g.fillRect(0, 0, taille, taille);
  // un bout de piste sous les pieds
  g.fillStyle = GAZON;
  g.fillRect(0, Math.round(taille * (1 - marge - 0.06)), taille, taille);
  const h = taille * (1 - 2 * marge);
  const e = Math.max(1, Math.floor(h / joueur.height));
  const w = joueur.width * e;
  g.imageSmoothingEnabled = false;
  g.drawImage(
    joueur,
    Math.round((taille - w) / 2),
    Math.round(taille * (1 - marge) - joueur.height * e),
    w,
    joueur.height * e,
  );
  return c.toBuffer('image/png');
}

const sortie = (nom) => new URL(`../public/icons/${nom}`, import.meta.url);
writeFileSync(sortie('icon-192.png'), icone(192, 0.08));
writeFileSync(sortie('icon-512.png'), icone(512, 0.08));
writeFileSync(sortie('icon-maskable-512.png'), icone(512, 0.2));
console.log('icônes générées dans public/icons/');
