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
  appuyés) ; le code qui la fabrique (`src/input/`) est séparé de
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

Le regard des joueurs et l'image de course ne sont pas dans la simulation : ils
dépendent de l'écran (`render/regard.ts`). Un humain de l'équipe 1 voit la
piste retournée (`Projection.miroir`) et joue lui aussi à droite.

### Multijoueur : en ligne ou sur le Wi-Fi

Menu → **MULTI**, puis **EN LIGNE** (Internet) ou **RESEAU LOCAL** (même Wi-Fi). Le
**pseudo** se change dans cet écran et dans les réglages avancés (un champ de saisie se
pose sur le jeu, qui fait apparaître le clavier du téléphone) ; il est gardé et nettoyé
(majuscules, chiffres, espaces, 14 caractères).

**En ligne.** **CREER UN SALON** donne un code (`KT2A-NVK6`) affiché dans la salle
d'attente avec un bouton **LIEN** (feuille de partage du téléphone, ou presse-papiers) ;
les amis font **REJOINDRE AVEC UN CODE**, ou ouvrent le lien (`#salon=CODE` : un
bouton REJOINDRE leur est proposé). Aucun serveur à vous : le code dérive la clé qui
chiffre la mise en relation sur des serveurs MQTT publics, puis les appareils se
connectent en pair à pair (voir lan-kit 0.2.0). La salle d'attente, le match, la pause
et la reconnexion sont ceux du Wi-Fi ; la veille tolère un silence plus long (12 s).
Chaque joueur voit l'adresse IP des autres ; sur environ 15 à 20 % des réseaux (4G à NAT
strict, Wi-Fi d'entreprise) la connexion est impossible tant qu'un relais TURN n'est pas
branché (voir `docs/TURN.md` de lan-kit). Le code est dans `app/parcours-ligne.ts`,
`app/saisie.ts`, `net/canal.ts`, `render/lan-choix.ts` et `render/ligne-accueil.ts`.

**Pings.** L'hôte mesure la latence de chaque joueur (ping/pong de lan-kit) et la renvoie
à tous chaque seconde (message `pings`, protocole 9) : elle s'affiche sur chaque carte de
la salle d'attente et, en match, en haut à gauche de l'écran (vert sous 60 ms, orange sous
150 ms, rouge au-delà).

**Sur le Wi-Fi.** L'appareil qui fait **CREER UNE PARTIE** devient le
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
réseau qui bloque STUN, empêchent la liaison sur le Wi-Fi ; le jeu en ligne passe par
un code de salon. Les spectateurs avec réactions ne sont
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

## Mise à jour

Le service worker de la PWA (`registerType: 'prompt'`) télécharge la nouvelle
version en arrière-plan quand elle existe, **sans l'installer de force** : le menu
affiche alors « MISE A JOUR DISPONIBLE » (`app/mise-a-jour.ts`,
`render/mise-a-jour-vue.ts`) avec METTRE A JOUR (installe et recharge) et PLUS
TARD. Rien n'est bloquant : hors ligne, la recherche échoue en silence et le jeu
reste jouable avec la version en cache ; après un « plus tard », un petit bouton
MISE A JOUR reste en haut à gauche du menu, et la proposition revient au
prochain lancement. La recherche a lieu au lancement, toutes les 30 minutes et au
retour au premier plan (une app installée peut rester des jours ouverte).
`version.json`, publié à chaque build et jamais mis en cache, donne le numéro de la
version proposée. On ne propose qu'au menu, jamais en plein match.

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

|             | Tactile                                      | Clavier                    |
| ----------- | -------------------------------------------- | -------------------------- |
| Se déplacer | joystick (moitié gauche)                     | flèches / ZQSD / WASD      |
| Frappe      | bouton rouge, en bas du losange              | K                          |
| Amorti      | bouton turquoise, à gauche                   | J                          |
| Lobe        | bouton bleu, à droite                        | L                          |
| Super coup  | bouton doré, en haut, seulement jauge pleine | I ou Espace (jauge pleine) |
| Pause       | ⏸ en haut à droite                           | Échap / P                  |

**Arcade, pas simulation.** Il n'y a plus de course : le joueur est plus rapide
que le CPU et la portée est généreuse. En option (Réglages › _Aide au
déplacement_, désactivée par défaut), le joueur qui va jouer la balle y est
conduit tout seul quand le joystick est au repos ; en réseau, c'est le réglage
de l'hôte qui vaut pour tous.

**Vitesse visible.** Le compteur affiche « ECHANGE n » puis « VITESSE X1.7 » avec une
jauge (×1,0 au service, jusqu'à ×1,9), et la balle elle-même a un halo qui grandit et
chauffe (jaune, orange, rouge) avec une traînée qui apparaît plus tôt.

**Quand part le coup ?** Il faut d'abord se placer, puis déclencher au bon moment. L'appui
_arme_ le coup, qui part tout seul dès que la balle est à portée de raquette (1,15 m : on
ne rattrape plus tout, un lob au-dessus d'un joueur au filet passe donc souvent). Armer trop
tôt coûte cher : le joueur **ralentit de moitié** tant que le coup est armé, et l'appui
est **oublié au bout de 0,7 s** s'il n'a rien touché. Un appui plus tôt donne un coup plus
fort (la charge monte pendant 0,6 s), mais on court moins vite pour se placer : à chacun
son compromis. Le CPU n'a pas ces règles. Le bouton du haut n'apparaît que pour le super
coup, et la touche I ou Espace vaut FRAPPE tant que la jauge n'est pas pleine : l'appui
n'est jamais perdu.

**SUPER, le coup assuré.** Jauge pleine et balle dans notre camp, un appui sur SUPER **fige la
scène** (`core/approche.ts`) : seul le joueur bouge. Il court vers la balle (plus de quatre fois
sa vitesse) et **s'envole** (`Joueur.saut`, synchronisé dans l'instantané) jusqu'au niveau de
l'impact, puis frappe avec la pose pieds en l'air. La scène se débloque sur le coup ; la
parade (ci-dessous) reprend alors au ralenti jusqu'au clic de l'adversaire. Le gros coup n'est
jamais raté pour cause de placement, mais la balle doit rester jouable (pas deux rebonds, pas
au-dessus de 4,5 m) ; l'approche s'annule après 1,3 s.

**Poses de coup.** Course en 4 temps (`course`, `course2`, `course`, `course3`, un temps tous les
0,55 m parcourus ; images produites par `scripts/sprite-course.mjs`). Bandeja et víbora gardent
la pose de préparation (`smash1`, pieds au sol) ; seuls le smash et les coups SUPER utilisent
la pose pieds en l'air (`smash2`).

**La balle accélère** de 6 % à chaque coup après le deuxième, jusqu'à +90 %
(`ACCEL_*` dans `core/constants.ts`), sauf le lob et l'amorti. Un compteur
« ECHANGE n » sous le tableau des scores chauffe de couleur (blanc, or, orange,
rouge) et affiche le bonus de vitesse de la balle.

**Piste plein écran.** Par défaut la piste remplit tout l'écran et les commandes (semi-
transparentes) se posent par-dessus ; Réglages avancés › _Commandes hors terrain_ réserve
une bande noire en bas pour que les boutons ne couvrent pas la piste (`Projection.place`).

**Même affichage pour tous**, en solo comme en réseau : l'équipe 0 à droite,
l'équipe 1 à gauche, joystick et boutons identiques. Les positions de service
(haut/bas, gauche/droite) sont celles d'un vrai terrain vu de côté.

**Quand part le coup ?** Dès que la balle est à portée après l'appui, tout
seul : on peut donc appuyer un peu avant. Plus l'appui est précoce, plus le
coup est puissant (la jauge au-dessus du joueur se remplit) ; le nom du coup
qui partira s'affiche au-dessus de la jauge, et un losange marque sur le
terrain adverse où la balle ira. Armer un coup ralentit nettement la course (`FREIN_ARME` 0,3) : on dose mieux la direction.

**Les coups.** FRAPPE peu chargé est un coup _coupé_ (lent, qui revient de la
vitre), chargé un coup _plat_ (qui ricoche de la vitre vers le filet). Sur une
balle haute, FRAPPE choisit seul selon la place et la charge : au filet et
bien armé, un smash (par 3 / par 4 si c'est très fort et très haut) ; à
mi-court, une víbora ; au fond, une bandeja. Un bon timing (balle proche de la
raquette) rend le coup précis.

**Moteur de qualité des coups** (`core/qualite.ts`, `tests/qualite.test.ts`). Un coup
n'est jamais « réussi ou raté » : sa qualité, de 1 (rouge, très médiocre) à 5 (vert,
parfait), dépend de la situation : hauteur et vitesse de la balle reçue, ce qui vient
de se passer (un lob, un amorti, un renvoi de vitre), où l'on est (filet ou fond), le
timing (balle bien au contact) et la charge. Exemples : un lob lent et haut reçu au
filet fait un smash parfait ; un smash après un amorti très bas est médiocre ; un
super lob est bien plus facile après une balle lente revenue de la vitre à mi-hauteur ;
un amorti ne marche qu'au filet. Le nom du coup s'affiche, de la couleur de sa qualité,
au moment du coup (et en direct au-dessus du joueur pendant qu'il arme son coup). La
qualité règle la trajectoire : un coup parfait est rapide et net, un lob raté est
lent, haut et court alors qu'un lob parfait monte haut, loin et vite, un amorti raté est
trop long et trop vif.

Ce que la couleur dit, et ne dit pas : elle juge **le choix du coup** pour la situation
(c'est l'essentiel) puis **l'exécution** (timing et charge, qui ne pèsent que 20 % et 15 %).
Une balle rapide ne rend pas un bon coup rouge : elle le rend un peu moins beau. Les
adversaires comptent : un lob prend à revers ceux du filet, un amorti surprend ceux du
fond. Sur une balle haute (joueur en position d'attaque), FRAPPE donne le
coup aérien (smash, víbora ou bandeja, selon la place et la charge) ; seul un LOB ou un
AMORTI y reste un coup de finesse, jugé comme tel. La couleur ne dit rien du résultat
(un smash vert peut finir en faute, un coup orange peut gagner le point) : elle dit
« c'était le bon coup, bien joué ».

**Jauge du super coup.** Chaque coup la remplit selon sa qualité (+1 % pour un
coup très médiocre, jusqu'à +10 % pour un coup parfait, +2,5 % de plus après un renvoi de
vitre). Deux barres de part et d'autre du tableau des scores (équipe 1 à gauche, équipe
0 à droite) : dégradé qui scintille, halo dès 75 %, et pleine, un cadre doré qui flashe,
une étoile et « SUPER ! ». Quand elle se remplit : une petite fanfare (pas de bannière), le bouton SUPER apparaît en haut du losange, doré et animé,
et toute l'équipe est entourée de flammes dorées et d'un SUPER clignotant : l'adversaire
voit venir le coup.

**Super coups.** Jauge pleine, le bouton SUPER lance un super coup (même sur un lob subi) :
quasi sans erreur, **imparable** (aucun adversaire ne peut toucher la balle) et qui gagne
le point à son premier rebond. Il est toujours rapide (la balle file au plus vite que le
filet le permet, puis repart comme un boulet après son rebond), avec une longue traînée de
feu, et finit en cassant quelque chose. Quatre variantes, choisies selon la situation :
la **MÉTÉORE** sur une balle haute (boule de feu qui s'écrase, cratère, puis repart dans
l'espace), la **COMÈTE** à mi-court (feu bleu et blanc, défonce la vitre du fond et sort de
la piste), le **PHÉNIX** depuis le fond (oiseau de feu aux ailes dorées qui défonce la vitre
de côté), l'**ÉCLAIR** au filet (zigzag électrique : l'écran se fissure, puis la balle repart
dans l'espace). Vitre brisée = gerbe d'éclats, écran qui tremble et flashe. Le CPU lâche aussi
son super coup, rarement (12 % de ses coups quand sa jauge est pleine). Les coups ordinaires
restent plafonnés à 0,97 de puissance.

**Parade.** Au moment où un super coup part, le jeu passe au ralenti (environ 2 s) pour
laisser le temps de comprendre. Le camp qui subit voit, à la place de ses boutons d'action,
la jauge et un gros bouton STOP : il doit arrêter le curseur dans le vert, bien plus
étroit qu'au service (un appui), pour stopper le super coup, seul moyen d'y échapper. Les
autres voient une petite jauge sous le tableau des scores. Réussi : le super est annulé
(renvoi normal, la jauge du défenseur gagne 20 %) ; raté, ou trop lent : le super reste
imparable. Le CPU tente sa chance au hasard. Le curseur est synchronisé dans l'instantané
(protocole 8) et l'évènement `parade` annonce le résultat. Les dégâts de la piste
(cratère, vitre brisée) disparaissent quand le jeu reprend sur un nouveau point.

**Fin spectaculaire.** La balle d'un super coup **tape toujours le sol d'abord** (jamais
une vitre), et ce choc ouvre la scène : avant le ralenti, chaque écran joue sa propre scène (`finale-super.ts`, `finale-vue.ts`) : coup de
zoom sur l'impact, terrain cratérisé ou vitre fissurée (`decals.ts` : le cratère est dessiné sous les vitres et
coupé aux limites de la piste ; il disparaît quand le ralenti commence),
filtre de particules sur tout l'écran, puis la balle monte dans le ciel jusqu'à l'espace en gardant le cap pris au rebond (elle penche du côté où elle partait),
arrive à toute vitesse sur la lune (une grosse boule grise à l'horizon arrondi, criblée d'un ensemble fixe de
cratères) et s'y écrase (éclair, onde de choc, débris) toujours dans le même cratère
(rien n'est mémorisé d'une partie à l'autre). Le bandeau du point s'affiche alors ; un
appui passe la scène. Le ralenti d'un super coup est toujours rejoué, après la scène.

**Lob subi.** Quand un lob a passé le joueur (la balle a rebondi, ou il est loin
du filet), le renvoi est normal, son coup est limité à mi-puissance
et l'équipe qui a lobé a l'avantage : son prochain coup est plus fort (+0,2). Un
lob encore haut au-dessus d'un joueur au filet peut toujours être smashé.

**Por 3 et por 4** (`core/por.ts`, `tests/por.test.ts`). Faire sortir la balle de la piste
n'est possible que dans des situations précises, sinon le grillage la retient (`b.por` :
seule une balle qui en a le droit passe par-dessus les murs).

- **Smash** : le seul coup qui les cherche. Balle haute (au-dessus de 2,2 m), joueur au
  filet (moins de 4,5 m), bien armé (puissance 0,75 ou plus), bien joué (qualité 0,6 ou plus),
  face à des adversaires collés au filet ou sur un lob ; jamais sur un lob subi. Même alors,
  une fois sur deux la balle reste en jeu. À plat vers le centre de la vitre du fond : **por 4**
  (elle monte et passe par-dessus le mur du fond) ; en diagonale : **por 3** (par-dessus la
  vitre de côté).
- **Víbora** : très rarement (12 %), très forte et très bien jouée, depuis le filet : por 3.
- **Jamais** : bandeja, volée (balle sous la hauteur de smash), lob, amorti, coupé, service,
  renvois de vitre. Les super coups, eux, sortent toujours (c'est leur effet).
  En simulation CPU contre CPU, les por sont passés de 38 % des points à environ 7 %.
  Non repris du guide : le vent et la température (pas de météo), le rulo à la grille.

**Rebond contre la vitre du fond.** La balle qui tape le sol puis la vitre du fond monte
maintenant haut et reste dans son camp près de deux fois sur trois (`rebondVitre` : vitesse
vers le filet plafonnée à 5 m/s, chandelle de 5,2 m/s) ; sinon elle revient comme avant.
Avant, un plat chargé ou une bandeja revenait seul chez celui qui avait frappé neuf fois sur
dix ; maintenant une sur trois environ (`tests/vitres.test.ts`).

**Repère au sol.** Après le premier rebond de la balle (donc aussi quand elle revient de la
vitre), une croix au sol marque l'endroit où se placer pour la jouer : clignotante si c'est
vous qui devez la prendre, discrète sinon.

**Jeu de vitre.** Un coup _plat_ chargé (au-delà de la moitié de la jauge) a un
rebond vif (`Balle.vif`) : plus il est chargé, plus la balle bondit après son
premier rebond, file vers la vitre et en revient en hauteur, jouable à ce
moment-là ; à fond, elle peut sortir de la piste (par 3 / par 4) ou repartir très
haut. Le coupé et la bandeja bondissent un peu, pour ne plus mourir au fond du
court. La vitre elle-même relance la balle vers le haut (`COUP_VITRE`) : tous les
renvois de vitre reviennent à hauteur de jeu. FRAPPE reste un coup normal même
sur une balle haute (FRAPPE y donne le coup aérien). Les coups très rapides laissent une traînée de feu (rouge, orange, jaune).
Quand la balle va d'abord rebondir sur une vitre, le joueur n'est pas guidé :
c'est à lui d'anticiper (se rapprocher du filet, par exemple). Il reste à 0,8 m
du filet pour que son dessin ne le dépasse pas.

**Viser.** Le joystick au moment de l'impact (sa dernière direction compte
encore 0,4 s après le relâchement) donne le côté (haut / bas de l'écran) et la
profondeur (vers le filet : plus long ; vers sa vitre : plus court). Au
neutre, la balle part en croisé.

Au service, FRAPPE (plat) ou AMORTI (coupé) lance la jauge, un second appui
sert ; le vert de la jauge est le service parfait.

## Licence

Apache 2.0 — voir [LICENSE](LICENSE).
