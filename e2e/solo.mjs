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
  // le geste tactile : ARMER tenu, puis un trait choisit le coup (haut = lob, court = amorti, autre = fort)
  const doigt = (type, lx, ly) =>
    p.evaluate(
      ({ type, lx, ly }) => {
        const c = document.querySelector('canvas');
        const r = c.getBoundingClientRect();
        const { W, H } = window.bandeja;
        c.dispatchEvent(
          new PointerEvent(type, {
            clientX: r.left + (lx / W) * r.width,
            clientY: r.top + (ly / H) * r.height,
            pointerId: 7,
            pointerType: 'touch',
            bubbles: true,
          }),
        );
        return H;
      },
      { type, lx, ly },
    );
  await p.evaluate(() => {
    window.bandeja.entrees.tactile = true;
    window.bandeja.jeu.phase = 'jeu';
    window.bandeja.jeu.balle.camp = 1;
  });
  const { W: LW, H: LH } = await p.evaluate(() => ({ W: window.bandeja.W, H: window.bandeja.H }));
  const intent = () => p.evaluate(() => window.bandeja.jeu.humain.intent?.type ?? null);
  const arme = () => p.evaluate(() => window.bandeja.entrees.trait !== null);
  /** Un trait : le doigt se pose, suit les points, puis se relève (ou non). */
  const reprise = () =>
    p.evaluate(() => {
      const j = window.bandeja.jeu;
      j.phase = 'jeu';
      j.tPhase = 0;
      j.humain.intent = null;
      Object.assign(j.balle, { x: 15, y: 5, z: 4, vx: 0, vy: 0, vz: 0, camp: 1, sol: 0, super: 0 });
    });
  const trace = async (points, relache = true) => {
    await reprise();
    await doigt('pointerdown', points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) await doigt('pointermove', x, y);
    await attends(120);
    if (relache) await doigt('pointerup', ...points[points.length - 1]);
  };
  const x0 = LW * 0.72;
  const y0 = LH * 0.55;
  // un doigt posé sur la piste arme (sans bouton), rien ne part tant qu'il est posé
  await reprise();
  await doigt('pointerdown', x0, y0);
  await attends(150);
  env.verifie((await intent()) === 'plat' && (await arme()), 'poser le doigt arme le coup, sans bouton');
  await doigt('pointerup', x0, y0);
  await attends(60);
  // un trait courbe (creusé vers le haut) : COURBE ; on le voit à l'écran pendant qu'on le trace
  const arc = Array.from({ length: 14 }, (_, i) => {
    const t = i / 13;
    return [x0 - 90 * t, y0 - 28 * 4 * t * (1 - t)];
  });
  await trace(arc, false);
  await env.capture(p, 'trait-courbe');
  await doigt('pointerup', ...arc[arc.length - 1]);
  await attends(60);
  env.verifie((await intent()) === 'courbe', 'un trait courbe : COURBE');
  await env.capture(p, 'trait-fondu');
  await attends(900);
  // un trait vers le haut : LOB ; un tout petit trait : AMORTI ; un trait droit : FORT
  await trace(Array.from({ length: 8 }, (_, i) => [x0 + 4 * i * 0.2, y0 - 9 * i]));
  await attends(40);
  env.verifie((await intent()) === 'lobe', 'un trait vers le haut : LOB');
  await attends(600);
  await trace([
    [x0, y0],
    [x0 - 8, y0 - 3],
    [x0 - 14, y0 - 6],
  ]);
  await attends(40);
  env.verifie((await intent()) === 'amorti', 'un tout petit trait : AMORTI');
  await attends(600);
  await trace(Array.from({ length: 10 }, (_, i) => [x0 - 9 * i, y0 - i]));
  await attends(40);
  env.verifie((await intent()) === 'lourd', 'un trait droit : FORT');
  await attends(600);
  // CHANGE (touche U) : en plein point, on prend la main sur le partenaire, l'ancien joueur repasse au CPU
  const avant = await p.evaluate(() => {
    const j = window.bandeja.jeu;
    j.phase = 'jeu';
    return j.humain.id;
  });
  await p.keyboard.press('KeyU');
  await attends(150);
  const apres = await p.evaluate(() => ({
    id: window.bandeja.jeu.humain.id,
    ancien: window.bandeja.jeu.joueurs[0].humain,
    n: window.bandeja.jeu.humains.length,
  }));
  env.verifie(
    apres.id !== avant && apres.n === 1,
    `CHANGE donne la main au partenaire (${avant} -> ${apres.id})`,
  );
  await env.capture(p, 'change');
  // le service : la jauge avec sa zone or (ace) au milieu du vert, et seulement PLAT et COUPE
  await p.evaluate(() => {
    const j = window.bandeja.jeu;
    j.phase = 'service';
    j.serveur = j.humain;
    j.pret = true;
    j.jauge = { type: 'plat', t: 0.4 };
  });
  await attends(150);
  await env.capture(p, 'service-jauge-or');
  // le compteur d'échange et les jauges de smash s'affichent sous le tableau
  await p.evaluate(() => {
    const j = window.bandeja.jeu;
    j.phase = 'jeu';
    j.echange = 14;
    j.jaugeSmash = [0.45, 1];
    j.humain.intent = { type: 'plat', t: 0 };
    j.humain.charge = 1;
  });
  await attends(150);
  await env.capture(p, 'hud-echange');

  // les quatre super coups, joués pour de bon : en vol (traînée de feu), puis à la sortie (cratère, vitre brisée, écran fissuré)
  for (const v of [1, 2, 3, 4]) {
    await p.evaluate(async (variante) => {
      const { executeCoup } = await import('/src/core/coups.ts');
      const { xProf } = await import('/src/core/terrain.ts');
      const j = window.bandeja.jeu;
      const h = j.joueurs[0];
      j.phase = 'jeu';
      j.echange = 3;
      h.x = variante === 3 ? 2 : variante === 4 ? 8.5 : 6;
      h.y = 5;
      Object.assign(j.balle, {
        x: h.x + 0.3,
        y: 5,
        z: variante === 1 ? 2.5 : 0.9,
        vx: -3,
        vy: 0,
        vz: 0,
        camp: 0,
        sol: 1,
        coup: 'plat',
        service: false,
        super: 0,
        dehors: false,
        roule: false,
      });
      executeCoup(j, h, 'plat', 1, xProf(1, 3), 5, null, { super: variante, precision: 1, charge: 1 });
    }, v);
    await attends(150);
    await env.capture(p, `super-${v}-vol`);
    await attends(420);
    await env.capture(p, `super-${v}-impact`);
    await attends(250);
    await env.capture(p, `super-${v}-fin`);
    await attends(2200);
  }
}
