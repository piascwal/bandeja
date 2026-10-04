/**
 * Match solo au clavier : le joueur n'a qu'à appuyer pour renvoyer (il est
 * guidé vers la balle), le coup armé et le point visé sont affichés.
 */
import { attends } from './outils.mjs';

export default async function (env) {
  const a = await env.appareil('joueur', { pseudo: 'SOLO' });
  const p = a.page;
  await p.evaluate(() => window.bandeja.lanceMatch());
  env.verifie(await env.attendsQue(p, () => window.bandeja.ecranUI === 'jeu'), 'le match démarre');
  // service : deux appuis (lancer la jauge, puis servir) quand le joueur sert
  let coups = 0;
  let capture = false;
  const debut = Date.now();
  while (Date.now() - debut < 40000 && coups < 6) {
    const e = await p.evaluate(() => ({
      phase: window.bandeja.jeu.phase,
      serveurHumain: window.bandeja.jeu.serveur.humain,
      pret: window.bandeja.jeu.pret,
      camp: window.bandeja.jeu.balle.camp,
      intent: !!window.bandeja.jeu.humain?.intent,
    }));
    if (e.phase === 'service' && e.serveurHumain && e.pret) {
      await p.keyboard.press('KeyK');
      await attends(450);
      await p.keyboard.press('KeyK');
    } else if (e.phase === 'jeu' && e.camp === 0) {
      await p.keyboard.press('KeyK');
      coups++;
      await attends(120);
      if (!capture) {
        capture = true;
        await env.capture(p, 'coup-arme');
      }
    }
    await attends(300);
  }
  env.verifie(coups >= 4, `le joueur renvoie la balle avec de simples appuis (${coups} appuis)`);
  const zones = await p.evaluate(() => {
    const { W, H } = window.bandeja;
    return { W, H };
  });
  env.verifie(zones.W > 0, 'écran dessiné');
  await env.capture(p, 'jeu-commandes');
  // le compteur d'échange et les jauges de smash s'affichent sous le tableau
  await p.evaluate(() => {
    const j = window.bandeja.jeu;
    j.phase = 'jeu';
    j.echange = 14;
    j.jaugeSmash = [0.45, 1];
  });
  await attends(150);
  await env.capture(p, 'hud-echange');
}
