/**
 * Mise à jour proposée au menu : la fenêtre n'est jamais bloquante (« plus
 * tard »), laisse un rappel, et « mettre à jour » appelle bien l'installation.
 */
import { attends } from './outils.mjs';

export default async function (env) {
  const a = await env.appareil('joueur', { pseudo: 'MAJ' });
  const p = a.page;
  await p.evaluate(() => {
    window.__installations = 0;
    window.bandeja.maj.signale(() => window.__installations++, 'V9.9.9');
  });
  await attends(300);
  env.verifie(await p.evaluate(() => window.bandeja.maj.proposee), 'la mise à jour est proposée');
  await env.capture(p, 'proposition');
  // appuis sur « plus tard » (à droite) puis sur le menu : le jeu reste utilisable
  await p.evaluate(() => {
    const z = window.bandeja.boutons;
    z[z.length - 1].act();
  });
  env.verifie(await p.evaluate(() => window.bandeja.maj.refusee), '« plus tard » ferme la fenêtre');
  env.verifie((await p.evaluate(() => window.__installations)) === 0, 'rien n’est installé sans accord');
  await attends(300);
  await env.capture(p, 'rappel');
  await p.evaluate(() => window.bandeja.lanceMatch());
  env.verifie(
    await env.attendsQue(p, () => window.bandeja.ecranUI === 'jeu'),
    'le jeu se lance malgré le refus',
  );
  await p.evaluate(() => window.bandeja.retourMenu());
  await p.evaluate(() => window.bandeja.maj.rouvre());
  await attends(200);
  await p.evaluate(() => {
    const z = window.bandeja.boutons;
    z[0].act(); // METTRE A JOUR
  });
  env.verifie(
    (await p.evaluate(() => window.__installations)) === 1,
    '« mettre à jour » lance l’installation',
  );
}
