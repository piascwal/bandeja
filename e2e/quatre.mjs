/**
 * Quatre joueurs en 2 contre 2, un spectateur, et un arrivant en plein match :
 * changement de format, sièges, écran retourné des joueurs de l'équipe B,
 * commandes de chacun routées vers son joueur, positions identiques partout.
 */
import { attends, lan } from './outils.mjs';

export default async function (env) {
  const hote = await env.appareil('hôte', { pseudo: 'HOTE' });
  const a2 = await env.appareil('A2', { pseudo: 'AMI DEUX' });
  const b1 = await env.appareil('B1', { pseudo: 'RIVAL UN' });
  const b2 = await env.appareil('B2', { pseudo: 'RIVAL DEUX' });
  const spec = await env.appareil('spectateur', { pseudo: 'SPECTATEUR' });
  const [h, pa2, pb1, pb2, ps] = [hote, a2, b1, b2, spec].map((x) => x.page);

  if (!(await lan.ouvrePartie(env, hote))) return;
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'format', f: '2v2' }));
  for (const x of [a2, b1, b2, spec]) if (!(await lan.rejoint(env, x))) return;
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.config.format === '2v2'),
    'le format 2 contre 2 est réglé',
  );
  env.verifie(
    await env.attendsQue(pa2, () => window.bandeja.lan.client.etat.config.format === '2v2'),
    "l'invité voit le format de l'hôte",
  );
  for (const [x, s] of [
    [a2, 1],
    [b1, 2],
    [b2, 3],
  ])
    if (!(await lan.prendSiege(env, x, s))) return;
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.sieges.every(Boolean)),
    'les quatre sièges sont pris',
  );
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.spectateurs.length === 1),
    'le spectateur est compté',
  );
  await env.capture(h, 'hote-salon-complet');

  // un siège ne se vole pas
  await ps.evaluate(() => window.bandeja.lan.client.agit({ a: 'siege', s: 2 }));
  await attends(500);
  env.verifie(
    (await h.evaluate(() => window.bandeja.lan.hote.etat.sieges[2].nom)) === 'RIVAL UN',
    'le spectateur ne peut pas voler le siège B1',
  );

  // --- le match
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'lance' }));
  for (const x of [hote, a2, b1, b2, spec])
    env.verifie(
      await env.attendsQue(x.page, () => window.bandeja.ecranUI === 'jeu'),
      `${x.nom} est en match`,
    );
  env.verifie(
    (await b1.page.evaluate(() => [window.bandeja.K.miroir, window.bandeja.jeu.humain.id].join())) ===
      'true,2',
    "l'écran de B1 est le même que celui des autres et il pilote le joueur B1",
  );
  env.verifie(
    (await b2.page.evaluate(() => [window.bandeja.K.miroir, window.bandeja.jeu.humain.id].join())) ===
      'true,3',
    "l'écran de B2 est le même que celui des autres et il pilote le joueur B2",
  );
  env.verifie(
    (await a2.page.evaluate(() => window.bandeja.K.miroir)) === true,
    "l'écran de A2 est le même aussi",
  );
  env.verifie(
    (await ps.evaluate(() => window.bandeja.jeu.humain)) === null,
    'le spectateur ne pilote personne',
  );
  await attends(2500);
  await env.capture(pb1, 'b1-match');
  await env.capture(ps, 'spectateur-match');

  const positions = (p) => p.evaluate(() => window.bandeja.jeu.joueurs.map((j) => [j.x, j.y]));
  const ref = await positions(h);
  for (const x of [a2, b1, b2, spec]) {
    const p = await positions(x.page);
    const ecart = Math.max(...ref.flatMap((r, k) => [Math.abs(r[0] - p[k][0]), Math.abs(r[1] - p[k][1])]));
    env.verifie(ecart < 0.8, `${x.nom} voit les mêmes positions que l'hôte (écart ${ecart.toFixed(2)} m)`);
  }

  // --- les commandes de chacun vont à SON joueur, y compris sur un écran retourné
  await lan.versLEchange(env, hote, [hote, a2, b1, b2]);
  const avant = await positions(h);
  await pb1.keyboard.down('ArrowRight'); // la droite de l'écran, pour tous : x qui diminue (vers le filet pour B1)
  await pb2.keyboard.down('ArrowDown');
  await attends(900);
  await pb1.keyboard.up('ArrowRight');
  await pb2.keyboard.up('ArrowDown');
  const apres = await positions(h);
  env.verifie(
    avant[2][0] - apres[2][0] > 0.8,
    `B1 va vers la droite de l'écran (x ${avant[2][0].toFixed(2)} → ${apres[2][0].toFixed(2)})`,
  );
  env.verifie(
    apres[3][1] - avant[3][1] > 0.8,
    `B2 descend (y ${avant[3][1].toFixed(2)} → ${apres[3][1].toFixed(2)})`,
  );
  env.verifie(
    Math.abs(apres[1][0] - avant[1][0]) < 1.5 && Math.abs(apres[1][1] - avant[1][1]) < 1.5,
    "A2, qui n'a rien touché, n'a pas bougé de son côté",
  );

  // --- un arrivant en plein match regarde
  const tard = await env.appareil('retardataire', { pseudo: 'EN RETARD' });
  await lan.rejoint(env, tard);
  env.verifie(
    await env.attendsQue(tard.page, () => window.bandeja.ecranUI === 'jeu'),
    "l'arrivant en plein match prend la partie en route",
  );
  env.verifie((await tard.page.evaluate(() => window.bandeja.jeu.humain)) === null, 'il regarde');
  await attends(1500);
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.spectateurs.length === 2),
    "l'hôte compte deux spectateurs",
  );
  await env.capture(tard.page, 'retardataire');

  // --- un joueur qui part en plein match ramène chacun au salon, sièges libérés
  await pb2.evaluate(() => window.bandeja.lan.quitte());
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.sieges[3] === null),
    'le siège B2 est libéré',
  );
  env.verifie(
    await env.attendsQue(
      h,
      () => !window.bandeja.jeu.joueurs[3].humain && window.bandeja.jeu.humains.length === 3,
    ),
    'le CPU reprend le joueur B2 chez l’hôte',
  );
  env.verifie(
    await env.attendsQue(pb1, () => window.bandeja.jeu.humains.length === 3),
    'les autres appareils le savent aussi',
  );
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.ecranUI === 'jeu'),
    'le match continue quand il reste des joueurs',
  );
}
