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

  // les commandes : pas de bouton du haut sans jauge pleine, le bouton SUPER dès qu'elle l'est
  await p.evaluate(() => {
    window.bandeja.jeu.phase = 'jeu';
  });
  await attends(200);
  await env.capture(p, 'commandes-sans-super');
  await p.evaluate(() => {
    const b = window.bandeja;
    b.jeu.jaugeSmash[b.jeu.humain.eq] = 1;
  });
  await attends(200);
  await env.capture(p, 'commandes-super');
  await p.evaluate(() => {
    const b = window.bandeja;
    b.jeu.jaugeSmash[b.jeu.humain.eq] = 0;
  });

  // le curseur de parade, côté du joueur
  await p.evaluate(() => {
    const b = window.bandeja;
    b.jeu.phase = 'jeu';
    b.jeu.parade = { eq: b.jeu.humain.eq, t: 0.1, ecoule: 0, tCpu: null };
  });
  await attends(100);
  await env.capture(p, 'super-parade');
  // vu par l'autre camp : une petite jauge sous le tableau
  await p.evaluate(() => {
    const b = window.bandeja;
    b.jeu.phase = 'jeu';
    b.jeu.parade = { eq: 1 - b.jeu.humain.eq, t: 0.1, ecoule: 0, tCpu: null };
  });
  await attends(150);
  await env.capture(p, 'super-parade-spectateur');
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

  // un vrai super coup : SUPER alors que la balle est loin dans notre camp, le joueur court la chercher,
  // la balle tape le sol, et la scène finale s'ouvre sur ce choc (jamais sur une vitre)
  let reussi = false;
  for (let essai = 0; essai < 4 && !reussi; essai++) {
    await p.evaluate(() => {
      const b = window.bandeja;
      const j = b.jeu;
      const eq = j.humain.eq;
      j.phase = 'jeu';
      j.parade = null;
      b.effets.finale.reinitialise();
      j.jaugeSmash[eq] = 1;
      j.humain.x = eq === 0 ? 1.5 : 18.5;
      j.humain.y = 8;
      Object.assign(j.balle, {
        x: eq === 0 ? 9 : 11,
        y: 3,
        z: 1.1,
        vx: eq === 0 ? -3 : 3,
        vy: 0,
        vz: 0,
        camp: eq,
        sol: 0,
        coup: 'plat',
        super: 0,
        dehors: false,
        roule: false,
      });
    });
    await p.keyboard.press('KeyI');
    reussi = await env.attendsQue(p, () => window.bandeja.effets.finale.declenchee, undefined, 6000);
  }
  env.verifie(reussi, 'un super coup lancé de loin ouvre la scène finale');
  await attends(250);
  await env.capture(p, 'super-reel-choc');
}
