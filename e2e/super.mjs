/**
 * Fin spectaculaire d'un super coup (zoom, ascension, lune) et curseur de
 * parade : on déclenche les scènes à la main et on photographie chaque temps.
 */
import { attends } from './outils.mjs';

export default async function (env) {
  const a = await env.appareil('joueur', { pseudo: 'SUPER' });
  const p = a.page;
  await p.evaluate(() => window.bandeja.lanceMatch());
  env.verifie(await env.attendsQue(p, () => window.bandeja.ecranUI === 'jeu'), 'le match démarre');

  // le curseur de parade, côté du joueur
  await p.evaluate(() => {
    const b = window.bandeja;
    b.jeu.parade = { eq: b.jeu.humain.eq, t: 0.1, ecoule: 0, tCpu: 99 };
  });
  await attends(150);
  await env.capture(p, 'super-parade');
  await p.evaluate(() => {
    window.bandeja.jeu.parade = null;
  });

  await p.evaluate(() => {
    const b = window.bandeja;
    b.effets.abime('sol', 5, 3, 0, 4);
    b.effets.debris(b.W / 2, b.H * 0.6);
    b.effets.finale.declenche(4, b.W / 2, b.H * 0.6);
  });
  env.verifie(await p.evaluate(() => window.bandeja.effets.finale.actif), 'la scène finale démarre');
  for (const [nom, ms] of [
    ['choc', 250],
    ['ascension', 700],
    ['lune', 1000],
    ['lune-repos', 1000],
  ]) {
    await attends(ms);
    await env.capture(p, `super-${nom}`);
  }
  env.verifie(
    await env.attendsQue(p, () => !window.bandeja.effets.finale.actif, undefined, 4000),
    'la scène finale se termine',
  );
}
