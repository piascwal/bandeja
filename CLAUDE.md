# Bandeja — notes pour Claude

Lire le README (architecture, conventions) avant toute modification.

- Avant de proposer un changement : `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`.
- `src/core/` reste pur (pas de DOM, pas de `Math.random` : `jeu.rng`) ; les effets passent par `jeu.evenements`.
- Aucun fichier TypeScript au-delà de 300 lignes de code (ESLint `max-lines`) : découper par responsabilité.
- `public/reference/` contient le POC gelé : ne jamais le modifier.
- Tout en français (code, commentaires, commits). Incrémenter `version` dans `package.json` à chaque évolution visible.
