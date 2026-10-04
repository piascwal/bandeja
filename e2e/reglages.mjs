/**
 * Réglages avancés (un réglage par ligne) et écran des commandes à part ;
 * l'aide au déplacement est désactivée par défaut et se retient.
 */
import { attends } from './outils.mjs';

export default async function (env) {
  const a = await env.appareil('joueur', { pseudo: 'REGLAGE' });
  const p = a.page;
  env.verifie(
    !(await p.evaluate(() => window.bandeja.pref.aide)),
    "l'aide au déplacement est désactivée par défaut",
  );
  await p.evaluate(() => window.bandeja.ouvreReglages(true));
  await attends(300);
  await env.capture(p, 'reglages');
  await p.evaluate(() => window.bandeja.basculeAide());
  env.verifie(await p.evaluate(() => window.bandeja.pref.aide), "l'aide s'active");
  await p.evaluate(() => window.bandeja.ouvreCommandes(true));
  await attends(300);
  env.verifie(
    (await p.evaluate(() => window.bandeja.ecranUI)) === 'commandes',
    "l'écran des commandes s'ouvre",
  );
  await env.capture(p, 'commandes');
  await p.keyboard.press('Escape');
  env.verifie((await p.evaluate(() => window.bandeja.ecranUI)) === 'reglages', 'Échap revient aux réglages');
}
