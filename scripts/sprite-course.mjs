/**
 * Prépare les images de course supplémentaires (scripts/sources/course-N.jpg, des
 * dessins sur fond magenta) comme les autres poses de public/sprites/ : fond retiré,
 * même échelle, rognées au plus juste. Usage : `node scripts/sprite-course.mjs`.
 *
 * Les dessins sources sont à la même échelle : un seul facteur pour tous, calé sur
 * la taille de la pose de course d'origine (111 pixels de haut), et la tête garde la
 * même place d'une image à l'autre (elle ne saute pas dans l'animation).
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Taille d'un pixel du dessin source ramenée au sprite : 111 pixels pour 650 de haut. */
const ECHELLE = 111 / 650;
const SEUIL = 70;

async function traite(n) {
  const img = await loadImage(join(RACINE, 'scripts/sources', `course-${n}.jpg`));
  const c = createCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  // le fond : la couleur des coins, avec le grain de la compression
  const bg = [d[0], d[1], d[2]];
  const W = c.width;
  const H = c.height;
  const masque = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const dist = Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]);
    masque[i] = dist > SEUIL ? 1 : 0;
  }
  // on grignote 2 pixels du bord : la frange rosée de la compression disparaît
  for (let k = 0; k < 2; k++) {
    const copie = masque.slice();
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (copie[i] && (!copie[i - 1] || !copie[i + 1] || !copie[i - W] || !copie[i + W])) masque[i] = 0;
      }
  }
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0;
  let tete = 0;
  for (let i = 0; i < W * H; i++) {
    if (!masque[i]) {
      d[i * 4 + 3] = 0;
      continue;
    }
    const x = i % W;
    const y = (i / W) | 0;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  // l'abscisse de la tête : le milieu de la casquette, dans les 90 premières lignes du dessin
  let somme = 0;
  let nb = 0;
  for (let y = y0; y < y0 + 90; y++)
    for (let x = x0; x <= x1; x++)
      if (masque[y * W + x]) {
        somme += x;
        nb++;
      }
  tete = somme / nb;
  g.putImageData(im, 0, 0);
  return { c, x0, y0, x1, y1, tete };
}

const frames = [await traite(2), await traite(3)];
// la tête (le haut du dessin) est calée au même endroit sur toutes les images
const haut = Math.min(...frames.map((f) => f.y0));
frames.forEach((f, i) => {
  const w = Math.ceil((f.x1 - f.x0 + 1) * ECHELLE);
  const h = Math.ceil((f.y1 - haut + 1) * ECHELLE);
  const sortie = createCanvas(w, h);
  const g = sortie.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(f.c, f.x0, haut, f.x1 - f.x0 + 1, f.y1 - haut + 1, 0, 0, w, h);
  writeFileSync(join(RACINE, 'public/sprites', `course${i + 2}.png`), sortie.toBuffer('image/png'));
  console.log(
    `course${i + 2}: w ${w}, h ${h}, pied.y ${h - 1}, tete ${((f.tete - f.x0) * ECHELLE).toFixed(1)}`,
  );
});
