/**
 * Coupure de Wi-Fi d'un invité en plein match : l'hôte fige la partie et
 * garde son siège, l'invité se reconnecte tout seul avec son jeton, un
 * compte à rebours relance le jeu. Puis un invité qui ne revient pas : au
 * bout du délai, son siège passe au CPU.
 */
import { attends, lan } from './outils.mjs';

export default async function (env) {
  const hote = await env.appareil('hôte', { pseudo: 'HOTE', requete: '&reconnexion=20' });
  const invite = await env.appareil('invité', { pseudo: 'INVITE' });
  const h = hote.page;
  const i = invite.page;

  if (!(await lan.ouvrePartie(env, hote))) return;
  if (!(await lan.rejoint(env, invite))) return;
  if (!(await lan.prendSiege(env, invite, 1))) return;
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'lance' }));
  env.verifie(await env.attendsQue(i, () => window.bandeja.ecranUI === 'jeu'), "l'invité est en match");
  await attends(1500);

  // --- coupure brutale côté invité
  await i.evaluate(() => window.bandeja.lan.client.perdre());
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.absents.join() === '1'),
    "l'hôte note l'invité absent et garde son siège",
  );
  env.verifie(
    await h.evaluate(() => window.bandeja.lan.hote.etat.sieges[1] !== null),
    'le siège de l’absent est conservé',
  );
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.lan.vueAttente()?.type === 'reconnexion'),
    "l'invité affiche « reconnexion »",
  );
  await env.capture(h, 'hote-attend');
  await env.capture(i, 'invite-reconnexion');
  const t0 = await h.evaluate(() => window.bandeja.jeu.temps);
  await attends(800);
  env.verifie(
    Math.abs((await h.evaluate(() => window.bandeja.jeu.temps)) - t0) < 0.05,
    'la partie est figée pendant l’absence',
  );

  // --- retour : même siège, puis compte à rebours, puis le jeu repart
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.absents.length === 0, undefined, 25000),
    "l'invité est revenu",
  );
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.lan.client?.siege === 1, undefined, 8000),
    "l'invité retrouve le siège A2",
  );
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.vueAttente()?.type === 'reprise', undefined, 3000),
    'compte à rebours de reprise',
  );
  await env.capture(h, 'hote-reprise');
  const t1 = await h.evaluate(() => window.bandeja.jeu.temps);
  env.verifie(await env.attendsQue(h, (t) => window.bandeja.jeu.temps > t + 0.5, t1, 8000), 'le jeu repart');
  env.verifie(
    (await i.evaluate(() => window.bandeja.ecranUI)) === 'jeu',
    "l'invité est de retour dans le match",
  );
}
