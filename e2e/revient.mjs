/**
 * Un invité quitte à la fin du match, l'hôte relance une partie contre le CPU, puis l'invité
 * revient en cours de partie, en spectateur : l'hôte garde la main et son match continue.
 */
import { attends, lan } from './outils.mjs';

export default async function (env) {
  const hote = await env.appareil('hôte', { pseudo: 'HOTE' });
  const invite = await env.appareil('invité', { pseudo: 'INVITE' });
  const h = hote.page;
  const i = invite.page;

  if (!(await lan.ouvrePartie(env, hote))) return;
  if (!(await lan.rejoint(env, invite))) return;
  if (!(await lan.prendSiege(env, invite, 1))) return;
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'lance' }));
  env.verifie(await env.attendsQue(i, () => window.bandeja.ecranUI === 'jeu'), "l'invité est en match");
  await attends(1500);

  await attends(1500);

  // fin du match, l'invité quitte, l'hôte relance contre le CPU
  await h.evaluate(async () => {
    const { gagne } = await import('/src/core/regles.ts');
    const jeu = window.bandeja.jeu;
    jeu.jeux = [jeu.jeuxCible - 1, 0];
    jeu.pts = [3, 0];
    jeu.phase = 'jeu';
    gagne(jeu, 0, 'POINT');
  });
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.ecranUI === 'fin', null, 15000),
    "l'hôte est à l'écran de fin",
  );
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.ecranUI === 'fin', null, 15000),
    "l'invité est à l'écran de fin",
  );
  await i.evaluate(() => window.bandeja.lan.quitte());
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.sieges[1] === null),
    "le siège de l'invité est libéré",
  );
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'rejoue' }));
  env.verifie(await env.attendsQue(h, () => window.bandeja.ecranUI === 'jeu'), "l'hôte rejoue contre le CPU");
  await attends(1000);
  const humains = () => h.evaluate(() => window.bandeja.jeu.humains.map((j) => j.id).join());
  env.verifie((await humains()) === '0', `l'hôte est le seul humain (${await humains()})`);

  // l'invité revient en cours de partie : il regarde
  if (!(await lan.rejoint(env, invite))) return;
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.ecranUI === 'jeu', null, 8000),
    "l'invité arrive dans le match en cours",
  );
  await attends(2500);
  env.verifie(
    (await humains()) === '0',
    `l'hôte garde la main après l'arrivée du spectateur (${await humains()})`,
  );
  env.verifie(
    await h.evaluate(() => window.bandeja.jeu.humain !== null),
    "le joueur de l'hôte est toujours à lui",
  );
  await env.capture(h, 'revient-hote');
  await env.capture(i, 'revient-invite');
}
