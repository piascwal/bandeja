/**
 * Jeu en ligne par code de salon, à deux « téléphones » : choix du mode, création
 * du salon (son code), entrée par ce code (un mauvais code ne trouve rien), pings
 * des joueurs, match, et changement de pseudo par le champ de saisie.
 */
import { attends } from './outils.mjs';

export default async function (env) {
  const hote = await env.appareil('hôte', { pseudo: 'HOTE' });
  const invite = await env.appareil('invité', { pseudo: 'INVITE' });
  const intrus = await env.appareil('intrus', { pseudo: 'INTRUS' });
  const h = hote.page;
  const i = invite.page;

  // --- l'écran de choix, puis la création du salon
  await h.evaluate(() => window.bandeja.lan.ligne.ouvreChoix());
  await attends(200);
  await env.capture(h, 'choix');
  await h.evaluate(() => window.bandeja.lan.ligne.ouvre());
  await attends(200);
  await env.capture(h, 'accueil');
  await h.evaluate(() => window.bandeja.lan.ligne.cree());
  env.verifie(await env.attendsQue(h, () => !!window.bandeja.lan.hote), "l'hôte crée un salon en ligne");
  const code = await h.evaluate(() => window.bandeja.lan.canal.code);
  env.verifie(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(code), `le salon a un code lisible (${code})`);

  // --- un mauvais code ne trouve aucun salon
  await intrus.page.evaluate(() => window.bandeja.lan.ligne.rejoint('ABCD-EFGH'));
  env.verifie(
    await env.attendsQue(
      intrus.page,
      () => window.bandeja.lan.phaseListe === 'pret' && !!window.bandeja.lan.message,
      undefined,
      15000,
    ),
    'un mauvais code ne trouve aucun salon',
  );
  await env.capture(intrus.page, 'mauvais-code');

  // --- le bon code
  await i.evaluate((c) => window.bandeja.lan.ligne.rejoint(c), code);
  env.verifie(
    await env.attendsQue(i, () => !!window.bandeja.lan.client?.etat, undefined, 20000),
    "l'invité entre dans le salon avec le code",
  );
  env.verifie(
    (await i.evaluate(() => window.bandeja.ecranUI)) === 'lan-salon',
    "l'invité est dans la salle d'attente",
  );
  await i.evaluate(() => window.bandeja.lan.client.agit({ a: 'siege', s: 1 }));
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.sieges[1] !== null),
    "l'hôte voit l'invité assis",
  );

  // --- les pings
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.pings[1] !== null, undefined, 8000),
    "l'hôte mesure le ping de l'invité",
  );
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.lan.client.pings[1] !== null, undefined, 8000),
    "l'invité reçoit son ping vu par l'hôte",
  );
  await env.capture(h, 'salon-hote');
  await env.capture(i, 'salon-invite');

  // --- le match
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'lance' }));
  env.verifie(await env.attendsQue(h, () => window.bandeja.ecranUI === 'jeu'), "l'hôte est en match");
  env.verifie(await env.attendsQue(i, () => window.bandeja.ecranUI === 'jeu'), "l'invité est en match");
  await attends(1500);
  await env.capture(h, 'match-hote');
  await env.capture(i, 'match-invite');

  // --- le pseudo, par le champ de saisie
  await intrus.page.evaluate(() => {
    window.bandeja.ecranUI = 'reglages';
  });
  await attends(300);
  await intrus.page.evaluate(() => window.bandeja.boutons[0].act());
  env.verifie(
    await env.attendsQue(intrus.page, () => !!document.querySelector('input')),
    'le champ de saisie du pseudo s’ouvre',
  );
  await env.capture(intrus.page, 'saisie-pseudo');
  await intrus.page.fill('input', 'élodie_99 !');
  await intrus.page.press('input', 'Enter');
  env.verifie(
    (await intrus.page.evaluate(() => window.bandeja.pref.nom)) === 'ELODIE99',
    'le pseudo est nettoyé et gardé',
  );
}
