/**
 * Coop contre CPU, à deux « téléphones » : découverte sur le Wi-Fi, salle
 * d'attente, choix du siège, match synchronisé (positions, commandes de
 * l'invité), pause partagée, fin de match, retour au salon, départ de l'invité.
 */
import { attends, lan } from './outils.mjs';

export default async function (env) {
  const hote = await env.appareil('hôte', { pseudo: 'HOTE' });
  const invite = await env.appareil('invité', { pseudo: 'INVITE' });
  const h = hote.page;
  const i = invite.page;

  // --- découverte et salle d'attente
  if (!(await lan.ouvrePartie(env, hote))) return;
  if (!(await lan.rejoint(env, invite))) return;
  await env.capture(i, 'invite-salon-sans-siege');
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.spectateurs.length === 1),
    "l'hôte voit l'arrivant parmi les spectateurs",
  );
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'lance' }));
  await attends(300);
  env.verifie(
    (await h.evaluate(() => window.bandeja.ecranUI)) === 'lan-salon',
    "l'hôte ne peut pas lancer seul en coop",
  );
  if (!(await lan.prendSiege(env, invite, 1))) return;
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.lan.hote.etat.sieges[1] !== null),
    "l'hôte voit le siège A2 pris",
  );
  await env.capture(h, 'hote-salon-pret');

  // --- le match : même partie des deux côtés
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'lance' }));
  env.verifie(await env.attendsQue(h, () => window.bandeja.ecranUI === 'jeu'), "l'hôte est en match");
  env.verifie(await env.attendsQue(i, () => window.bandeja.ecranUI === 'jeu'), "l'invité est en match");
  env.verifie((await i.evaluate(() => window.bandeja.jeu.humain?.id)) === 1, "l'invité pilote le joueur A2");
  env.verifie(
    (await h.evaluate(() => window.bandeja.jeu.humains.map((j) => j.id).join())) === '0,1',
    "l'hôte simule deux humains (A1 et A2)",
  );
  await attends(2500);
  await env.capture(h, 'hote-match');
  await env.capture(i, 'invite-match');

  const positions = (p) => p.evaluate(() => window.bandeja.jeu.joueurs.map((j) => [j.x, j.y]));
  const ecartMax = async () => {
    const [a, b] = [await positions(h), await positions(i)];
    return Math.max(...a.flatMap((p, k) => [Math.abs(p[0] - b[k][0]), Math.abs(p[1] - b[k][1])]));
  };
  env.verifie(
    (await ecartMax()) < 0.8,
    `les positions des quatre joueurs concordent (écart ${(await ecartMax()).toFixed(2)} m)`,
  );

  // --- les touches de l'invité pilotent SON joueur chez l'hôte
  await lan.versLEchange(env, hote, [hote, invite]);
  const avant = (await positions(h))[1];
  await i.keyboard.down('ArrowUp');
  await attends(900);
  await i.keyboard.up('ArrowUp');
  const apres = (await positions(h))[1];
  env.verifie(
    Math.abs(apres[1] - avant[1]) > 0.8,
    `la commande de l'invité déplace son joueur chez l'hôte (y ${avant[1].toFixed(2)} → ${apres[1].toFixed(2)})`,
  );
  await attends(300);
  const vue = (await positions(i))[1];
  env.verifie(Math.abs(vue[1] - apres[1]) < 1, "l'invité voit son joueur au même endroit");

  // --- un appui de l'invité arrive une fois : la balle et le score restent synchronisés
  const etatCote = (p) =>
    p.evaluate(() => ({
      pts: window.bandeja.jeu.pts,
      jeux: window.bandeja.jeu.jeux,
      phase: window.bandeja.jeu.phase,
    }));
  await attends(3000);
  const [eh, ei] = [await etatCote(h), await etatCote(i)];
  env.verifie(
    JSON.stringify(eh.pts) === JSON.stringify(ei.pts) && JSON.stringify(eh.jeux) === JSON.stringify(ei.jeux),
    `le score est le même des deux côtés (${eh.pts})`,
  );

  // --- pause partagée : demandée par l'invité, vue par l'hôte
  await i.evaluate(() => window.bandeja.pause(true));
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.ecranUI === 'pause'),
    "la pause de l'invité fige l'hôte",
  );
  env.verifie(await env.attendsQue(i, () => window.bandeja.ecranUI === 'pause'), "l'invité est en pause");
  const t0 = await h.evaluate(() => window.bandeja.jeu.temps);
  await attends(700);
  env.verifie(
    (await h.evaluate(() => window.bandeja.jeu.temps)) === t0,
    'la simulation est figée pendant la pause',
  );
  await env.capture(i, 'invite-pause');
  await h.evaluate(() => window.bandeja.pause(false));
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.ecranUI === 'jeu'),
    "la reprise de l'hôte relance l'invité",
  );
  await attends(500);

  // --- fin de match : l'équipe A gagne, écran de fin partagé
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
    "l'hôte voit l'écran de fin",
  );
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.ecranUI === 'fin', null, 15000),
    "l'invité voit l'écran de fin",
  );
  await attends(500);
  await env.capture(i, 'invite-fin');
  env.verifie(
    (await i.evaluate(() => window.bandeja.jeu.jeux[0])) ===
      (await h.evaluate(() => window.bandeja.jeu.jeux[0])),
    'le score final est le même',
  );

  // --- revanche : retour au salon, les sièges sont gardés
  await h.evaluate(() => window.bandeja.lan.hote.agit({ a: 'salon' }));
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.ecranUI === 'lan-salon'),
    "l'invité revient au salon",
  );
  env.verifie((await i.evaluate(() => window.bandeja.lan.client.siege)) === 1, 'son siège est gardé');

  // --- départ de l'invité : son siège se libère chez l'hôte
  await i.evaluate(() => window.bandeja.lan.quitte());
  env.verifie(
    await env.attendsQue(
      h,
      () =>
        window.bandeja.lan.hote.etat.sieges[1] === null &&
        window.bandeja.lan.hote.etat.spectateurs.length === 0,
    ),
    "le départ de l'invité libère son siège",
  );
  await env.capture(h, 'hote-apres-depart');
}
