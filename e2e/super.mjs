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
    b.effets.abime(5, 3, 1);
    b.effets.debris(b.W / 2, b.H * 0.6);
    b.effets.finale.declenche(1, b.W / 2, b.H * 0.6, 0.8);
  });
  env.verifie(await p.evaluate(() => window.bandeja.effets.finale.actif), 'la scène finale démarre');
  await attends(150);
  // seul le bouton PASSER coupe la scène : pas de zone plein écran, un appui ailleurs ne fait rien
  env.verifie(
    await p.evaluate(() => {
      const z = window.bandeja.boutons;
      return z.length === 1 && z[0].w < window.bandeja.W / 3 && z[0].h < window.bandeja.H / 3;
    }),
    'la scène ne se coupe que par le bouton PASSER',
  );
  // on photographie les temps clés de la scène en réglant son horloge
  for (const [nom, t] of [
    ['choc', 0.3],
    ['ascension', 1.0],
    ['ascension-haut', 1.4],
    ['lune-arrivee', 1.55 + 0.4],
    ['lune-impact', 1.55 + 0.75],
    ['lune-cratere', 1.55 + 1.3],
    ['lune-repos', 1.55 + 1.9],
  ]) {
    await p.evaluate((x) => {
      const f = window.bandeja.effets.finale;
      f.t = x;
      f.actif = true;
    }, t);
    await attends(60);
    await env.capture(p, `super-${nom}`);
  }
  env.verifie(
    await env.attendsQue(p, () => !window.bandeja.effets.finale.actif, undefined, 6000),
    'la scène finale se termine',
  );

  // les scènes qui quittent la lune : le volcan (plongée dans la Terre, geyser), l'orbite (satellite),
  // les voyages au-dessus de la Terre (la tour de Pise qui penche, le nez du Sphinx cassé, le Titanic coupé en deux)
  // et l'erreur 404 (écran fissuré, écran bleu)
  for (const [variante, temps] of [
    [2, [0.7, 1.1, 1.5, 1.8, 2.0, 2.2, 2.35, 2.6, 3.0]],
    [3, [1.6, 1.9, 2.3, 2.6, 2.8, 2.9, 2.97, 3.1, 3.3]],
    [4, [0.8, 1.2, 1.6, 1.85, 2.15, 2.3, 2.45, 2.7, 3.3]],
    [5, [1.2, 1.9, 2.15, 2.4, 2.55, 2.75, 2.8, 3.0, 3.3]],
    [6, [1.0, 2.3, 2.9, 3.2, 3.4, 3.5, 3.75, 3.9, 4.2, 4.7]],
    [7, [0.9, 1.15, 1.3, 1.5, 1.85, 2.2, 2.9, 3.9, 4.1, 4.25]],
  ]) {
    await p.evaluate((v) => {
      const b = window.bandeja;
      b.effets.finale.reinitialise();
      b.effets.finale.declenche(v, b.W / 2, b.H * 0.6, 0.3);
    }, variante);
    for (const t of temps) {
      await p.evaluate((x) => {
        const b = window.bandeja;
        // le jeu tourne derrière la scène : on l'empêche de finir son échange (le point suivant arrêterait la scène)
        b.jeu.phase = 'jeu';
        b.jeu.tFrappe = 0;
        const f = b.effets.finale;
        f.t = x;
        f.actif = true;
      }, t);
      await attends(60);
      await env.capture(p, `super-v${variante}-${String(t).replace('.', '_')}`);
    }
  }
  await p.evaluate(() => window.bandeja.effets.finale.reinitialise());

  // la course : quatre images de foulée, saisies en plein mouvement
  await p.evaluate(() => {
    const b = window.bandeja;
    const j = b.jeu;
    j.phase = 'jeu';
    j.parade = null;
    j.approche = null;
    Object.assign(j.balle, {
      x: j.humain.eq === 0 ? 14 : 6,
      y: 5,
      z: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      camp: 1 - j.humain.eq,
      sol: 0,
      coup: 'plat',
    });
    j.humain.x = j.humain.eq === 0 ? 8 : 12;
    j.humain.y = 8;
  });
  await p.keyboard.down('ArrowUp');
  for (let i = 0; i < 3; i++) {
    await attends(180);
    await env.capture(p, `course-${i}`);
  }
  await p.keyboard.up('ArrowUp');

  // un vrai super coup : SUPER alors que la balle est loin dans notre camp, le joueur court la chercher,
  // la balle tape le sol, et la scène finale s'ouvre sur ce choc (jamais sur une vitre)
  let reussi = false;
  for (let essai = 0; essai < 4 && !reussi; essai++) {
    await p.evaluate(() => {
      const b = window.bandeja;
      const j = b.jeu;
      const eq = j.humain.eq;
      j.phase = 'jeu';
      // un échange qui démarre : ni durée de point héritée (rejeu), ni délai d'échange épuisé, ni scène en cours
      j.tPhase = 0;
      j.tFrappe = 0;
      j.dureePoint = 1.9;
      b.ralenti.arrete();
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
    if (essai === 0) {
      await attends(110);
      await env.capture(p, 'super-approche');
      env.verifie(
        await p.evaluate(() => window.bandeja.jeu.approche !== null || window.bandeja.jeu.balle.super > 0),
        'SUPER fige la scène : le joueur part vers la balle',
      );
    }
    reussi = await env.attendsQue(p, () => window.bandeja.effets.finale.declenchee, undefined, 6000);
  }
  env.verifie(reussi, 'un super coup lancé de loin ouvre la scène finale');
  await attends(250);
  await env.capture(p, 'super-reel-choc');
}
