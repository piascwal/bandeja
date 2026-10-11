/**
 * Un invité (équipe adverse, en 1 contre 1) quitte en plein match, puis revient en spectateur : l'hôte garde
 * la main et son match contre le CPU continue.
 */
import { attends, lan } from './outils.mjs';

export default async function (env) {
  const hote = await env.appareil('hôte', { pseudo: 'HOTE' });
  const invite = await env.appareil('invité', { pseudo: 'INVITE' });
  const h = hote.page;
  const i = invite.page;

  if (!(await lan.ouvrePartie(env, hote))) return;
  if (!(await lan.rejoint(env, invite))) return;
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'format', f: '1v1' }));
  if (!(await lan.prendSiege(env, invite, 2))) return;
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'lance' }));
  env.verifie(await env.attendsQue(i, () => window.bandeja.ecranUI === 'jeu'), "l'invité est en match");
  await attends(1500);

  // l'invité quitte en plein match : le CPU reprend son joueur et l'hôte continue
  await i.evaluate(() => window.bandeja.lan.quitte());
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.sieges[1] === null),
    "le siège de l'invité est libéré",
  );
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
