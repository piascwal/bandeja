import { C } from './palette';
import { texte } from './police';
import { bouton, panneau, voile, type ZoneBouton } from './ui';
import type { Vue } from './vue';

export interface VueMiseAJour {
  /** version proposée, si on la connaît */
  version: string | null;
  onMaj: () => void;
  onPlusTard: () => void;
}

/** La proposition de mise à jour, au-dessus du menu : jamais bloquante, « plus tard » est toujours possible. */
export function dessineMiseAJour(v: Vue, zones: ZoneBouton[], m: VueMiseAJour): void {
  const { g, W, H } = v;
  zones.length = 0; // la fenêtre prend tous les appuis : le menu dessous attend
  voile(g, W, H, 0.7);
  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  const pw = 230;
  const ph = 84;
  panneau(g, cx - pw / 2, cy - ph / 2, pw, ph);
  texte(g, 'MISE A JOUR DISPONIBLE', cx, cy - ph / 2 + 8, C.or, 1, 'c');
  texte(
    g,
    m.version ? `VERSION ${m.version}` : 'UNE NOUVELLE VERSION EST PRETE',
    cx,
    cy - ph / 2 + 22,
    C.blanc,
    1,
    'c',
  );
  texte(g, 'LE JEU RESTE JOUABLE HORS LIGNE', cx, cy - ph / 2 + 34, C.grisBleu, 1, 'c');
  const y = cy - ph / 2 + 50;
  bouton(g, zones, 'METTRE A JOUR', cx - 108, y, 120, 20, m.onMaj, {
    couleur: '#1f9d55',
    clair: '#6fe3a0',
    fonce: '#0f6a38',
    e: 1,
  });
  bouton(g, zones, 'PLUS TARD', cx + 18, y, 90, 20, m.onPlusTard, { couleur: '#232a58', e: 1 });
}

/** Après un « plus tard » : un petit bouton rappelle la mise à jour, dans un coin du menu. */
export function dessineRappelMiseAJour(v: Vue, zones: ZoneBouton[], onOuvre: () => void): void {
  bouton(v.g, zones, 'MISE A JOUR', 4, 4, 78, 12, onOuvre, {
    couleur: '#1f9d55',
    clair: '#6fe3a0',
    fonce: '#0f6a38',
  });
}
