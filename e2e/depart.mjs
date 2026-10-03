/**
 * L'hôte ferme sa partie : l'invité revient à la liste avec un message, et la
 * partie disparaît de la liste. Un invité peut ensuite en rejoindre une autre.
 */
import { attends, lan } from './outils.mjs';

export default async function (env) {
  const hote = await env.appareil('hôte', { pseudo: 'HOTE' });
  const invite = await env.appareil('invité', { pseudo: 'INVITE' });
  const h = hote.page;
  const i = invite.page;

  if (!(await lan.ouvrePartie(env, hote))) return;
  if (!(await lan.rejoint(env, invite))) return;
  await lan.prendSiege(env, invite, 1);

  // l'hôte quitte en pleine salle d'attente
  await h.evaluate(() => window.bandeja.lan.quitte());
  env.verifie((await h.evaluate(() => window.bandeja.ecranUI)) === 'menu', "l'hôte retourne au menu");
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.ecranUI === 'lan-liste'),
    "l'invité revient à la liste",
  );
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.lan.message === 'L HOTE A QUITTE LA PARTIE'),
    "l'invité est prévenu",
  );
  await env.capture(i, 'invite-apres-depart-hote');

  // la partie a disparu de la liste (l'annonce de l'hôte est effacée par son testament ou son retrait)
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.lan.client?.parties.length === 0, null, 8000),
    'la partie disparaît de la liste',
  );

  // une nouvelle partie se crée et se rejoint sans accroc
  await attends(300);
  const h2 = await env.appareil('nouvel hôte', { pseudo: 'AUTRE' });
  if (!(await lan.ouvrePartie(env, h2))) return;
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.lan.client?.parties.length === 1, null, 8000),
    'la nouvelle partie apparaît dans la liste',
  );
  await i.evaluate(() => window.bandeja.lan.rejoint(window.bandeja.lan.client.parties[0].id));
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.ecranUI === 'lan-salon'),
    "l'invité rejoint la nouvelle partie",
  );
}
