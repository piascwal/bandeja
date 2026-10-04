import type { Fissure } from './effets';
import type { Vue } from './vue';

/** Générateur pseudo-aléatoire reproductible : la même fissure à chaque image. */
function graine(a: number): () => number {
  let t = a >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * L'écran qui se fissure : des lignes qui partent du point d'impact et zigzaguent
 * jusqu'aux bords, puis s'estompent. Dessiné par-dessus tout, tableau compris.
 */
export function dessineFissure(v: Vue, f: Fissure): void {
  const { g, W, H } = v;
  const alea = graine(f.graine);
  const k = Math.min(1, f.vie / 0.5); // s'estompe sur la fin
  g.save();
  g.lineJoin = 'miter';
  for (let b = 0; b < 16; b++) {
    const a0 = (b / 16) * Math.PI * 2 + alea() * 0.4;
    let x = f.x;
    let y = f.y;
    let a = a0;
    const longueur = 0.35 + alea() * 0.65;
    const pas = 6 + Math.floor(alea() * 4);
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < pas && x > -10 && x < W + 10 && y > -10 && y < H + 10; i++) {
      a += (alea() - 0.5) * 0.9;
      const l = (10 + alea() * 18) * longueur;
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      g.lineTo(x, y);
    }
    g.strokeStyle = `rgba(10,14,40,${0.7 * k})`;
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = `rgba(235,248,255,${0.95 * k})`;
    g.lineWidth = 1;
    g.stroke();
  }
  // l'impact, éclat blanc au centre
  g.fillStyle = `rgba(255,255,255,${0.9 * k})`;
  g.fillRect(f.x - 2, f.y - 2, 5, 5);
  g.restore();
}
