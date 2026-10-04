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

  // la piste remplit l'écran par défaut ; l'option réserve une bande pour les commandes, hors de la piste
  env.verifie(!(await p.evaluate(() => window.bandeja.pref.bandeCommandes)), 'piste plein écran par défaut');
  const plein = await p.evaluate(() => window.bandeja.K.yN);
  await p.evaluate(() => window.bandeja.basculeBande());
  const bande = await p.evaluate(() => window.bandeja.K.yN);
  env.verifie(bande < plein - 4, `avec la bande de commandes, la piste remonte (${plein} → ${bande})`);
  await p.evaluate(() => window.bandeja.lanceMatch());
  await attends(500);
  await env.capture(p, 'piste-avec-bande');
  await p.evaluate(() => window.bandeja.retourMenu());
  await p.evaluate(() => window.bandeja.basculeBande());
  await p.evaluate(() => window.bandeja.lanceMatch());
  await attends(500);
  await env.capture(p, 'piste-plein-ecran');
}
