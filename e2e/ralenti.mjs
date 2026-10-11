/**
 * Ralenti des points en réseau : la partie tourne toute seule (les humains
 * passent la main au CPU), et à la fin d'un bel échange chaque écran, hôte
 * comme invité, rejoue les dernières secondes au ralenti sur sa propre copie.
 * Pour passer un rejeu, tous les joueurs doivent avoir touché ; sinon le point suit son cours
 * et reprend dès que tous les rejeux sont finis.
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

  // les deux joueurs de l'équipe passent la main au CPU : les échanges se jouent seuls
  await h.evaluate(() => {
    const jeu = window.bandeja.jeu;
    for (const s of jeu.joueurs) {
      s.humain = false;
      s.err = s.niv.err;
    }
    jeu.humains = [];
    jeu.humain = null;
  });

  const rejeu = await env.attendsQue(h, () => window.bandeja.ralenti.actif, undefined, 120000);
  env.verifie(rejeu, "l'hôte rejoue un beau point au ralenti");
  env.verifie(
    await env.attendsQue(i, () => window.bandeja.ralenti.actif, undefined, 8000),
    "l'invité rejoue lui aussi le point",
  );
  await env.capture(h, 'hote-ralenti');
  await env.capture(i, 'invite-ralenti');

  // passer le rejeu demande l'accord de tous : l'invité touche, mais son rejeu continue et l'hôte ne change rien
  await i.evaluate(() => window.bandeja.passeRalenti());
  await attends(400);
  env.verifie(await i.evaluate(() => window.bandeja.passe.touche), "l'invité a touché pour passer");
  env.verifie(
    await i.evaluate(() => window.bandeja.ralenti.actif),
    "le rejeu de l'invité continue : l'hôte n'a pas encore touché",
  );
  env.verifie(await h.evaluate(() => window.bandeja.ralenti.actif), "l'hôte poursuit le sien");
  env.verifie(
    (await h.evaluate(() => window.bandeja.jeu.phase)) === 'point',
    'le point continue chez l’hôte',
  );
  await env.capture(i, 'invite-ralenti-attente');

  // l'hôte touche à son tour : tout le monde a passé, le point suivant démarre aussitôt chez les deux
  await h.evaluate(() => window.bandeja.passeRalenti());
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.jeu.phase !== 'point', undefined, 3000),
    "quand tous ont touché, l'hôte repart sur un nouveau point",
  );
  env.verifie(
    await env.attendsQue(
      i,
      () => !window.bandeja.ralenti.actif && window.bandeja.jeu.phase !== 'point',
      undefined,
      3000,
    ),
    "l'invité quitte lui aussi son rejeu pour le nouveau point",
  );

  // sans que personne touche : le point suivant arrive dès que tous les rejeux sont finis, sans délai de plus
  const rejeu2 = await env.attendsQue(h, () => window.bandeja.ralenti.actif, undefined, 120000);
  env.verifie(rejeu2, "un deuxième beau point est rejoué à l'hôte");
  env.verifie(await env.attendsQue(i, () => window.bandeja.ralenti.actif, undefined, 8000), "et à l'invité");
  env.verifie(
    await env.attendsQue(h, () => !window.bandeja.ralenti.actif, undefined, 12000),
    "le rejeu de l'hôte se termine",
  );
  env.verifie(
    await env.attendsQue(i, () => !window.bandeja.ralenti.actif, undefined, 12000),
    "le rejeu de l'invité se termine",
  );
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.jeu.phase !== 'point', undefined, 2500),
    'la partie repart juste après le dernier rejeu (moins de 2,5 s)',
  );
}
