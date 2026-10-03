/**
 * Ralenti des points en réseau : la partie tourne toute seule (les humains
 * passent la main au CPU), et à la fin d'un bel échange chaque écran, hôte
 * comme invité, rejoue les dernières secondes au ralenti sur sa propre copie.
 * Un invité qui touche son écran ferme son rejeu sans rien changer chez l'hôte.
 */
import { lan } from './outils.mjs';

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

  // l'invité ferme son rejeu : l'hôte continue le sien
  await i.evaluate(() => window.bandeja.passeRalenti());
  env.verifie(!(await i.evaluate(() => window.bandeja.ralenti.actif)), "l'invité a fermé son rejeu");
  env.verifie(await h.evaluate(() => window.bandeja.ralenti.actif), "l'hôte poursuit le sien");

  // le rejeu finit avant la reprise du jeu, puis le service suivant arrive
  env.verifie(
    await env.attendsQue(h, () => !window.bandeja.ralenti.actif, undefined, 12000),
    "le rejeu de l'hôte se termine",
  );
  env.verifie(
    await env.attendsQue(h, () => window.bandeja.jeu.phase !== 'point', undefined, 8000),
    'la partie repart après le rejeu',
  );
}
