/**
 * Outils communs des tests de bout en bout (navigateur) : un serveur Vite de
 * développement, un courtier MQTT local (la découverte des parties Wi-Fi
 * passe par lui au lieu des serveurs publics) et Chromium piloté par
 * Playwright. Chaque « appareil » est un contexte de navigateur séparé
 * (stockage local à part) ; l'application est exposée en `window.bandeja`
 * (mode développement, voir src/main.ts).
 */
import { mkdirSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Aedes } from 'aedes';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createWebSocketStream, WebSocketServer } from 'ws';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Captures d'écran des tests (ignorées par git). */
export const CAPTURES = join(RACINE, 'e2e', 'captures');

export const attends = (ms) => new Promise((r) => setTimeout(r, ms));

/** Courtier MQTT sur WebSocket, sur un port libre. */
async function demarreCourtier() {
  const aedes = await Aedes.createBroker();
  const serveur = http.createServer();
  const wss = new WebSocketServer({
    server: serveur,
    handleProtocols: (p) => (p.has('mqtt') ? 'mqtt' : false),
  });
  wss.on('connection', (ws) => aedes.handle(createWebSocketStream(ws)));
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  return {
    url: `ws://127.0.0.1:${serveur.address().port}`,
    arrete: async () => {
      for (const c of wss.clients) c.terminate();
      await new Promise((r) => serveur.close(r));
      await new Promise((r) => aedes.close(r));
    },
  };
}

/**
 * Environnement d'un test : serveurs + navigateur. `appareil(nom)` ouvre un
 * nouvel appareil (téléphone en paysage) sur le jeu ; `verifie` compte les
 * échecs, et `fin()` ferme tout et renvoie le nombre d'échecs.
 */
export async function environnement(nomTest) {
  mkdirSync(CAPTURES, { recursive: true });
  const vite = await createServer({
    root: RACINE,
    logLevel: 'error',
    server: { port: 0, host: '127.0.0.1' },
  });
  await vite.listen();
  const courtier = await demarreCourtier();
  const base = `http://127.0.0.1:${vite.httpServer.address().port}/`;
  // la découverte passe par le courtier local, sur un canal propre à ce test
  const urlJeu = `${base}?reseau=${encodeURIComponent(nomTest)}-${Date.now()}&courtier=${encodeURIComponent(courtier.url)}`;
  // sans ce drapeau, Chromium masque les adresses locales derrière du mDNS et WebRTC ne se connecte pas
  const navigateur = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  let echecs = 0;
  const erreursPage = [];

  const env = {
    urlJeu,
    navigateur,
    /** Ouvre un appareil ; `options` : viewport, dpr, nom du joueur. */
    async appareil(nom, options = {}) {
      const { largeur = 844, hauteur = 390, dpr = 2, pseudo = null } = options;
      const contexte = await navigateur.newContext({
        viewport: { width: largeur, height: hauteur },
        deviceScaleFactor: dpr,
        hasTouch: true,
        isMobile: true,
      });
      const page = await contexte.newPage();
      page.on('pageerror', (e) => {
        erreursPage.push(`${nom} : ${e.message}`);
        console.log(`  [${nom}] ERREUR PAGE ${e.message}`);
      });
      page.on('console', (m) => {
        if (m.type() === 'error') console.log(`  [${nom}] console : ${m.text()}`);
      });
      await page.goto(urlJeu);
      await page.waitForFunction(() => !!window.bandeja);
      await attends(800);
      if (pseudo) await page.evaluate((p) => (window.bandeja.pref.nom = p), pseudo);
      // le tout premier geste ne fait que demander le plein écran
      await page.evaluate(() => (window.bandeja.attenteDemarrage = false));
      return { nom, page, contexte };
    },
    /** Attend qu'une condition (évaluée dans la page) devienne vraie. */
    async attendsQue(page, f, arg, ms = 10000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (await page.evaluate(f, arg)) return true;
        await attends(120);
      }
      return false;
    },
    verifie(ok, msg) {
      if (!ok) echecs++;
      console.log(`  ${ok ? 'OK   ' : 'ECHEC'} ${msg}`);
      return ok;
    },
    async capture(page, nom) {
      await page.screenshot({ path: join(CAPTURES, `${nomTest}-${nom}.png`) });
    },
    async fin() {
      if (erreursPage.length)
        env.verifie(false, `aucune erreur JavaScript dans les pages (${erreursPage.length})`);
      await navigateur.close();
      await courtier.arrete();
      await vite.close();
      return echecs;
    },
  };
  return env;
}

// ------------------------------------------------------------ Wi-Fi --

/** Actions de l'application, raccourcis pour les tests Wi-Fi. */
export const lan = {
  /** L'hôte ouvre une partie : elle apparaît dans la liste des autres. */
  async ouvrePartie(env, hote) {
    await hote.page.evaluate(() => window.bandeja.lan.ouvre());
    await env.attendsQue(hote.page, () => window.bandeja.lan.phaseListe === 'pret');
    await hote.page.evaluate(() => window.bandeja.lan.cree());
    return env.verifie(
      await env.attendsQue(hote.page, () => !!window.bandeja.lan.hote),
      `${hote.nom} héberge une partie`,
    );
  },
  /** Un appareil rejoint la première partie de sa liste et attend l'état du salon. */
  async rejoint(env, appareil) {
    await appareil.page.evaluate(() => window.bandeja.lan.ouvre());
    env.verifie(
      await env.attendsQue(appareil.page, () => (window.bandeja.lan.client?.parties.length ?? 0) > 0),
      `${appareil.nom} voit la partie dans la liste`,
    );
    await appareil.page.evaluate(() => window.bandeja.lan.rejoint(window.bandeja.lan.client.parties[0].id));
    return env.verifie(
      await env.attendsQue(appareil.page, () => !!window.bandeja.lan.client?.etat),
      `${appareil.nom} est dans la salle d'attente`,
    );
  },
  /** Prend un siège libre (0 = A1, 1 = A2, 2 = B1, 3 = B2) et attend qu'il soit à soi. */
  async prendSiege(env, appareil, siege) {
    await appareil.page.evaluate((s) => window.bandeja.lan.client.agit({ a: 'siege', s }), siege);
    return env.verifie(
      await env.attendsQue(appareil.page, (s) => window.bandeja.lan.client.siege === s, siege),
      `${appareil.nom} est assis au siège ${siege}`,
    );
  },
  /**
   * Amène la partie à l'échange. Si un humain doit servir, c'est SON appareil
   * (`parSiege[siège]`) qui lance la jauge puis sert (deux appuis) : pour un
   * invité, ça passe par tout le réseau. Les services du CPU partent tout seuls.
   */
  async versLEchange(env, hote, parSiege) {
    const h = hote.page;
    for (let essai = 0; essai < 8; essai++) {
      const e = await h.evaluate(() => ({
        phase: window.bandeja.jeu.phase,
        srv: window.bandeja.jeu.serveur.id,
        humain: window.bandeja.jeu.serveur.humain,
        pret: window.bandeja.jeu.pret,
      }));
      if (e.phase === 'jeu') return true;
      const p = parSiege[e.srv];
      if (e.phase === 'service' && e.humain && e.pret && p) {
        await p.page.keyboard.press('KeyK');
        await attends(350);
        await p.page.keyboard.press('KeyK');
        env.verifie(true, `${p.nom} sert (siège ${e.srv})`);
      }
      await attends(1200);
    }
    return env.verifie(false, "la partie arrive à l'échange");
  },
};
