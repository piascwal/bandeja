# Bandeja — Padel Arcade

Padel arcade en pixel art, vu de côté : **en double**, vous et un partenaire
CPU contre deux CPU. Frappe, lobe, coupé, amorti, smash, víbora, bandeja,
jeu contre les vitres et service à la jauge. À jouer en paysage sur téléphone
(ou au clavier sur ordinateur).

**Jouer : https://piascwal.github.io/bandeja/**

Ce dépôt reprend le POC monofichier (`padel-arcade.html`, né dans
[piascwal/hub](https://github.com/piascwal/hub)) et le restructure en projet
maintenable, à parité avec l'original. Le POC reste jouable, gelé, à
[`/bandeja/reference/poc-2026-10.html`](https://piascwal.github.io/bandeja/reference/poc-2026-10.html)
(`public/reference/`, à ne pas modifier).

## Stack

Même stack que [Face-Off](https://github.com/piascwal/face-off) :

| Domaine            | Choix                                 | Pourquoi                                                                                                                                         |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Langage            | **TypeScript** (strict)               | La physique, l'IA et les règles sont le genre de code où une faute de frappe silencieuse coûte cher.                                             |
| Build / dev server | **Vite**                              | Zéro config pour un jeu canvas, rechargement instantané, site statique déployable partout.                                                       |
| Rendu              | **Canvas 2D natif**, aucune librairie | Le style du jeu (petit canvas logique agrandi sans lissage) n'a pas besoin d'un moteur.                                                          |
| PWA                | **vite-plugin-pwa** (Workbox)         | Manifeste `display: fullscreen` + `landscape` : une fois ajoutée à l'écran d'accueil, l'app s'ouvre sans barre de navigateur, y compris sur iOS. |
| Tests              | **Vitest**                            | Verrouille la simulation pure (physique, règles, service).                                                                                       |
| Lint / format      | **ESLint (flat config) + Prettier**   | Standard, peu de friction.                                                                                                                       |
| CI / déploiement   | **GitHub Actions** → **GitHub Pages** | `ci.yml` : typecheck → lint → format → tests → build ; `deploy.yml` : publication à chaque push sur `main`.                                      |

Pas de dépendance à l'exécution : le jeu compilé est du HTML/CSS/JS statique.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
```

Autres commandes :

```bash
npm run typecheck
npm run lint
npm run format       # Prettier (format:check en CI)
npm test             # Vitest
npm run build        # build de prod dans dist/
npm run e2e          # tests de bout en bout (voir plus bas)
npm run preview      # sert le build de prod localement
npm run icones       # régénère public/icons/ depuis assets/icone-app.jpg
```

En développement, l'application est accessible en `window.bandeja` (état du
match : `bandeja.jeu`).

## Architecture

```
src/
  core/     — la simulation, pure : ni DOM, ni canvas, ni window
  audio/    — synthèse Web Audio (aucun fichier son)
  input/    — clavier + tactile → Commande
  render/   — tout le dessin canvas (décor, joueurs, balle, HUD, menus)
  app/      — assemble le tout : boucle de jeu, écrans, préférences
  net/      — synchronisation réseau : instantané binaire, évènements, entrées
              (le socle Wi-Fi vient de lan-kit)
public/
  sprites/  — les six poses du joueur (PNG, recolorées par équipe au chargement)
  icons/    — icônes de l'app (générées depuis assets/icone-app.jpg)
  reference/— le POC d'origine, gelé
tests/      — tests Vitest de la simulation
```

### `core/` : la simulation isolée du rendu

Tout le gameplay vit dans `src/core/` et se pilote par une seule fonction :

```ts
const jeu = nouvellePartie({ mode: 'match', niveau: 1, jeux: 1 });
pas(jeu, PAS, () => entrees.lireCommande()); // avance d'un pas fixe (1/120 s)
```

- La simulation travaille **en mètres** : x le long de la piste (0 → 20,
  filet à 10), y en profondeur (0 au fond de l'écran → 10 devant), z en
  hauteur. L'équipe 0 (vous) défend x < 10.
- **Entrées** : le joueur humain reçoit une `Commande` (direction, boutons
  appuyés, sprint) ; le code qui la fabrique (`src/input/`) est séparé de
  celui qui l'applique (`core/humain.ts`).
- **Effets de bord** : la simulation ne joue jamais un son ni ne dessine une
  particule. Elle émet des `Evenement` (`jeu.evenements` : impact, frappe,
  point, faute, jeu...) que `app/evenements.ts` traduit en sons, particules,
  annonces et vibrations.
- **Hasard injectable** : `Partie.rng` vaut `Math.random` en jeu, et un
  générateur à graine (`graine(n)`) dans les tests, qui deviennent
  reproductibles.

| Fichier                                                                | Rôle                                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `partie.ts`                                                            | Création d'une partie, `pas()` : l'ordre de mise à jour d'un pas                         |
| `balle.ts`                                                             | Vol de la balle : gravité, filet, rebonds au sol, vitres, grillages, sorties ; `lance()` |
| `regles.ts`                                                            | Arbitrage des contacts, compte des points (point en or), jeux, fin de match              |
| `service.ts`                                                           | Mise en place, jauge, service de l'ordinateur                                            |
| `coups.ts`                                                             | Exécution d'un coup (trajectoire, erreur, effet), replacement des équipes                |
| `contre-vitre.ts`                                                      | Recherche d'un élan qui rebondit contre sa propre vitre                                  |
| `prevision.ts`                                                         | Prévision de trajectoire et choix de qui joue la balle                                   |
| `ia.ts`                                                                | Choix des coups et déplacements de l'ordinateur                                          |
| `humain.ts`                                                            | Application de la `Commande` du joueur (coups anticipés, visée, vitres)                  |
| `deplacement.ts`                                                       | Course, écartement des partenaires, regard                                               |
| `constants.ts`, `types.ts`, `terrain.ts`, `joueurs.ts`, `aleatoire.ts` | Dimensions, réglages, types, aides                                                       |

### `net/` : la synchronisation réseau

Un appareil héberge la partie (l'hôte simule, comme en solo), les autres
reçoivent son état et envoient leurs commandes. Le socle de découverte et de
liaison (salons chiffrés, WebRTC limité au réseau local, MQTT public comme
boîte aux lettres) est le paquet partagé
[`lan-kit`](https://github.com/piascwal/lan-kit), figé sur une étiquette dans
`package.json` ; ce dossier n'en garde que ce qui est propre à Bandeja.

| Fichier         | Rôle                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `protocole.ts`  | Version du protocole, identité sur le réseau (`APP`), limites, listes d'énumérations                 |
| `instantane.ts` | Photographie de la partie → 166 octets binaires ; décodage strict (tout ce qui est abîmé est rejeté) |
| `appliquer.ts`  | Pose un instantané sur la partie locale d'un invité ; recalcule la prévision du rebond               |
| `synchro.ts`    | Tampon de l'invité : léger retard adaptatif, interpolation, jamais d'extrapolation                   |
| `evenements.ts` | Validation des évènements reçus (sons et effets), reconstruits champ par champ                       |
| `entrees.ts`    | Commandes des joueurs distants, en compteurs cumulés : un appui n'est ni perdu ni doublé             |
| `binaire.ts`    | Lecture et écriture binaires bornées                                                                 |

Règles : **toute modification incompatible d'un message incrémente
`VERSION_PROTOCOLE`** (c'est aussi le nom du salon : les appareils d'une autre
version ne se voient pas) ; les listes d'énumérations ne se réordonnent jamais
sans cela. L'hôte est autoritaire : il ne reçoit que des intentions bornées.

Le regard des joueurs et la pose de course ne sont pas dans la simulation : ils
dépendent de l'écran (`render/regard.ts`). Un humain de l'équipe 1 voit la
piste retournée (`Projection.miroir`) et joue lui aussi à droite.

### Multijoueur Wi-Fi

Menu → **MULTI WIFI**. L'appareil qui fait **CREER UNE PARTIE** devient le
serveur ; les autres appareils du même Wi-Fi voient la partie dans leur liste,
sans saisir d'adresse. Chacun arrive d'abord en spectateur et prend un siège
(**PRENDRE**) ; les sièges libres sont tenus par le CPU.

| Format                  | Sièges ouverts aux humains          |
| ----------------------- | ----------------------------------- |
| COOP CONTRE CPU         | A1 (l'hôte) et A2 contre deux CPU   |
| 1 CONTRE 1              | A1 contre B1                        |
| 2 CONTRE 1 / 1 CONTRE 2 | A1 A2 contre B1, ou A1 contre B1 B2 |
| 2 CONTRE 2              | quatre humains                      |

L'hôte règle le format, le niveau du CPU et la longueur du match, exclut un
joueur (la croix sur sa carte) et lance quand quelqu'un est en face (en coop :
quand le second siège de l'équipe est pris). Une fois la partie lancée, les
sièges sont verrouillés : quiconque arrive ensuite regarde. La pause est
partagée ; en fin de match, l'hôte choisit REJOUER ou SALON. Un joueur qui part
est remplacé par le CPU.

Chaque joueur de l'équipe B voit la piste retournée et joue lui aussi à droite ;
une flèche rouge repère les autres humains. Le code est dans `app/parcours-lan.ts`
(navigation et boucle de match), `net/session-hote.ts` et `net/session-client.ts`
(connexions), `net/salon.ts` et `net/formats.ts` (règles du salon, pures et
testées), `net/ctrl.ts` (messages), `render/lan-liste.ts` et `render/lan-salon.ts`.

**Limites connues.** Les Wi-Fi « invités » qui isolent les appareils, ou un
réseau qui bloque STUN, empêchent la liaison ; le jeu par Internet est
volontairement impossible (voir lan-kit). Les spectateurs avec réactions ne sont
pas encore là.

**Coupure et reprise.** Si un invité perd la connexion en plein match, l'hôte
garde son siège, fige la partie et affiche « en attente de… » (60 s, ou
« NE PLUS ATTENDRE » : le CPU prend le joueur). L'invité relance la découverte
et se représente avec son identifiant et un jeton secret (`app/reconnexion-lan.ts`) :
lui seul retrouve son siège. Un compte à rebours de 3 s relance ensuite le jeu,
comme après une pause. Les règles sont pures et testées dans `net/absences.ts` ;
en développement, `?reconnexion=20` raccourcit le délai. Le code à 4 chiffres
affiché sur chaque carte du salon est le même chez l'hôte et chez le joueur :
s'il diffère, quelqu'un s'est interposé.

En développement, `?reseau=xxx&courtier=ws://localhost:8883` remplace la
détection du réseau et les serveurs publics par un courtier local (c'est ce
qu'utilisent les tests de bout en bout).

### Ralenti des points

Un échange d'au moins 2,5 s est rejoué après l'annonce du point : ses 2,4 dernières
secondes, à 60 % de la vitesse, sous une pastille RALENTI (constantes `RALENTI_*`
dans `core/constants.ts`). Chaque écran enregistre ce qu'il affiche (`app/ralenti.ts`)
et rejoue sur une partie à part : aucun message réseau. Le cœur ne fait qu'allonger
l'annonce du point (`jeu.dureePoint`). Toucher l'écran passe le rejeu ; seul ou chez
l'hôte, cela passe aussi l'annonce, un invité ne ferme que le sien.

### Tests de bout en bout

```bash
npx playwright install chromium   # une fois
npm run e2e                       # tous
npm run e2e -- coop quatre        # certains
```

Les scénarios de `e2e/` pilotent le vrai jeu dans Chromium : chaque appareil est
un contexte de navigateur séparé, avec un faux courtier MQTT local, sans matériel.

| Scénario      | Ce qu'il vérifie                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `coop`        | Découverte, salon, siège, match synchronisé, commandes de l'invité (dont un service), pause partagée, fin, retour au salon, départ                                                                           |
| `quatre`      | 2 contre 2 à quatre appareils plus un spectateur et un arrivant en plein match : écran retourné de l'équipe B, commandes routées vers le bon joueur, siège non volable, reprise d'un joueur parti par le CPU |
| `reconnexion` | Coupure brutale d'un invité : partie figée, siège gardé, reconnexion automatique, compte à rebours, le jeu repart                                                                                            |
| `depart`      | L'hôte ferme sa partie : l'invité est prévenu, la partie disparaît de la liste, une nouvelle se rejoint                                                                                                      |

### Rendu

Même procédé que Face-Off : un petit canvas logique (~200 px de haut)
dessiné avec des primitives pixel (`px`, `disque`, `anneau`) et une police
bitmap maison, agrandi d'un facteur entier sans lissage. Les joueurs sont
dessinés plus fins (un pixel du dessin est plus petit qu'un pixel du décor)
pour garder leurs détails. La projection (`render/projection.ts`) est en
miroir : votre équipe joue à droite, loin du joystick.

Le décor (foule, gazon, murs, vitre de devant) est calculé une fois par
taille d'écran, pixel par pixel, en retrouvant pour chaque pixel le point de
la piste qu'il montre (`decor.ts`, `decor-murs.ts`).

## Plein écran (webview)

Le jeu se comporte comme une app plein écran, sans barre de navigateur :

- **Installé sur l'écran d'accueil** (« Ajouter à l'écran d'accueil ») : le
  manifeste PWA (`display: fullscreen`, `orientation: landscape`) et les
  balises `apple-mobile-web-app-*` l'ouvrent directement en plein écran,
  y compris sur iPhone, avec l'illustration `assets/icone-app.jpg` comme
  icône.
- **Ouvert dans le navigateur** : un écran « APPUYEZ POUR COMMENCER »
  couvre le menu ; ce premier geste ne fait que passer en plein écran et
  verrouiller le paysage (`app/plein-ecran.ts`), sans toucher un bouton.
  Safari sur iPhone n'a pas d'API plein écran : il faut installer l'app.

Pour changer l'icône : remplacer `assets/icone-app.jpg` (carrée), puis
`npm run icones`.

## Conventions

- **Taille des fichiers** : aucun fichier TypeScript ne dépasse 300 lignes de
  code (règle `max-lines` d'ESLint, vérifiée en CI). Au-delà, on découpe par
  responsabilité.
- `core/` n'importe rien de `render/`, `audio/`, `input/` ni `app/`, et
  n'utilise pas `Math.random` directement (toujours `jeu.rng`).
- Toute règle de jeu modifiée s'accompagne d'un test dans `tests/`.
- Code, commentaires et commits en français, comme le reste du projet.

## Commandes du jeu

|                  | Tactile                                                     | Clavier               |
| ---------------- | ----------------------------------------------------------- | --------------------- |
| Se déplacer      | joystick (moitié gauche)                                    | flèches / ZQSD / WASD |
| Frappe (✕)       | bouton rouge, en bas du losange                             | K                     |
| Coupé (□)        | bouton vert, à gauche                                       | J                     |
| Lobe (○)         | bouton bleu, à droite                                       | L                     |
| Amorti (△)       | bouton turquoise, en haut                                   | I                     |
| Bandeja / víbora | bouton du centre (balle haute) ; joystick haut/bas : víbora | Espace                |
| Courir           | COURIR                                                      | Maj                   |
| Pause            | ⏸ en haut à droite                                          | Échap / P             |

On peut appuyer **avant** que la balle arrive : le coup part dès qu'elle est
à portée, et plus l'appui est précoce, plus il est puissant. Joystick vers sa
vitre au moment de l'impact : rebond voulu contre la vitre du fond ou de côté.
Au service, ✕ (plat) ou □ (coupé) lance la jauge, un second appui sert ;
le vert de la jauge est le service parfait.

## Licence

Apache 2.0 — voir [LICENSE](LICENSE).
