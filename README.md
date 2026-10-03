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
