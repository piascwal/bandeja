import { COULEURS_GESTE, type Point, type TypeGeste } from '@input/geste';
import type { Vue } from './vue';

/** Le trait que trace le doigt (ou le dernier fini, qui s'efface) : sa forme choisit le coup, sa couleur dit lequel. */
export interface TraitAffiche {
  pts: Point[];
  type: TypeGeste;
  /** 1 pendant le tracé, puis de 1 à 0 après le relâchement */
  opacite: number;
}

export function dessineTrait(v: Vue, t: TraitAffiche | null): void {
  if (!t || t.pts.length < 2) return;
  const { g } = v;
  const chemin = () => {
    g.beginPath();
    g.moveTo(t.pts[0]!.x, t.pts[0]!.y);
    for (let i = 1; i < t.pts.length; i++) g.lineTo(t.pts[i]!.x, t.pts[i]!.y);
  };
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = 0.9 * t.opacite;
  // un liseré sombre sous le trait, pour le lire sur la piste comme sur les gradins
  g.strokeStyle = '#0a0d1c';
  g.lineWidth = 5;
  chemin();
  g.stroke();
  g.strokeStyle = COULEURS_GESTE[t.type];
  g.lineWidth = 3;
  chemin();
  g.stroke();
  // la pointe : où le doigt est (ou s'est arrêté)
  const fin = t.pts[t.pts.length - 1]!;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(fin.x, fin.y, 3.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
