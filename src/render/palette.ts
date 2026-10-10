import type { Coup } from '@core/types';

export interface CouleursEquipe {
  nom: string;
  maillot: string;
  fonce: string;
  clair: string;
}

/** Équipe 0 : vous (bleu), équipe 1 : l'ordinateur (rouge). */
export const EQUIPES: readonly [CouleursEquipe, CouleursEquipe] = [
  { nom: 'VOUS', maillot: '#2ec8f5', fonce: '#155f9e', clair: '#b6f0ff' },
  { nom: 'CPU', maillot: '#f5415e', fonce: '#8c1b3a', clair: '#ffc2cc' },
];

export const C = {
  nuit: '#070914',
  contour: '#0b0e1d',
  blanc: '#ffffff',
  or: '#ffd35c',
  gris: '#8a93b0',
  grisBleu: '#6f7aa6',
  balle: '#e4ff3a',
  vitre: '#bfe6ff',
  panneau: '#161b36',
} as const;

export const PEAUX = ['#f1c7a0', '#d9a07a', '#a86b4a', '#f6d7bd'] as const;

/** Traînée de la balle et halo des boutons, selon le coup. */
export const TRAINEES: Partial<Record<Coup, string>> = {
  vibora: '#c77dff',
  bandeja: '#ffd35c',
  smash: '#ff8a3c',
  vitre: '#bfe6ff',
  cote: '#bfe6ff',
};

/** Noms annoncés au-dessus du joueur qui frappe. */
export const NOMS_COUPS: Record<Coup, string> = {
  plat: 'FRAPPE',
  lobe: 'LOBE',
  coupe: 'COUPE',
  amorti: 'AMORTI',
  smash: 'SMASH',
  vibora: 'VIBORA',
  bandeja: 'BANDEJA',
  vitre: 'VITRE DU FOND',
  cote: 'VITRE DE COTE',
};

/** Couleur de chaque super coup : 1 météore, 2 comète, 3 phénix, 4 éclair, 5 volcan, 6 orbite. */
export const COULEURS_SUPER: readonly string[] = [
  '',
  '#ff6a2a',
  '#5fd0ff',
  '#ff9a2a',
  '#fff23a',
  '#ff3b12',
  '#9ab8ff',
];
