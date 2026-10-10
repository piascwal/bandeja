import { LARG, LONG } from '@core/constants';
import type { Decal } from './effets';
import { px } from './primitives';
import type { Vue } from './vue';

/** Générateur pseudo-aléatoire reproductible : le même dégât à chaque image. */
function graine(a: number): () => number {
  let t = a >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Le terrain cassé (petit : il se lit sans cacher le jeu) : un cratère sombre, des fissures qui rayonnent sur la piste, des éclats clairs au bord. */
function cratere(v: Vue, d: Decal, a: number): void {
  const { g, K } = v;
  const alea = graine(d.graine);
  // le cratère : une ellipse sombre, deux fois (le bord, puis le fond)
  for (const [r, c] of [
    [0.7, `rgba(20,16,30,${0.5 * a})`],
    [0.4, d.variante === 2 ? `rgba(255,90,26,${0.9 * a})` : `rgba(6,6,16,${0.75 * a})`],
  ] as [number, string][]) {
    g.fillStyle = c;
    g.beginPath();
    for (let i = 0; i <= 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const rr = r * (0.85 + alea() * 0.3);
      const [sx, sy] = K.proj(d.x + Math.cos(ang) * rr * 1.1, d.y + Math.sin(ang) * rr * 0.8, 0);
      if (i === 0) g.moveTo(sx, sy);
      else g.lineTo(sx, sy);
    }
    g.fill();
  }
  // les fissures : des lignes brisées qui partent du cratère
  for (let b = 0; b < 8; b++) {
    let ang = (b / 8) * Math.PI * 2 + alea() * 0.4;
    let x = d.x;
    let y = d.y;
    g.beginPath();
    const [x0, y0] = K.proj(x, y, 0);
    g.moveTo(x0, y0);
    const n = 2 + Math.floor(alea() * 2);
    for (let i = 0; i < n; i++) {
      ang += (alea() - 0.5) * 0.9;
      const l = 0.25 + alea() * 0.35;
      x += Math.cos(ang) * l * 1.2;
      y += Math.sin(ang) * l * 0.8;
      const [sx, sy] = K.proj(x, y, 0);
      g.lineTo(sx, sy);
    }
    g.strokeStyle = `rgba(6,8,22,${0.9 * a})`;
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = `rgba(210,225,255,${0.6 * a})`;
    g.lineWidth = 1;
    g.stroke();
  }
  // des éclats clairs jetés autour
  for (let i = 0; i < 8; i++) {
    const ang = alea() * Math.PI * 2;
    const r = 0.5 + alea() * 0.8;
    const [sx, sy] = K.proj(d.x + Math.cos(ang) * r * 1.2, d.y + Math.sin(ang) * r * 0.8, 0);
    g.globalAlpha = a;
    px(g, sx, sy, 2, 1, i % 2 ? '#d9c9a8' : '#6b5a48');
  }
  g.globalAlpha = 1;
}

/** Les cratères des super coups sur la piste, dessinés avant les joueurs. */
export function dessineDecals(v: Vue, decals: readonly Decal[]): void {
  const { g, K } = v;
  if (!decals.length) return;
  g.save();
  {
    // le sol cassé reste sur le sol : rien ne déborde sur les vitres, qui sont dessinées par-dessus
    g.beginPath();
    [
      [0, 0],
      [LONG, 0],
      [LONG, LARG],
      [0, LARG],
    ].forEach(([x, y], i) => {
      const [sx, sy] = K.proj(x!, y!, 0);
      if (i === 0) g.moveTo(sx, sy);
      else g.lineTo(sx, sy);
    });
    g.closePath();
    g.clip();
  }
  for (const d of decals) cratere(v, d, Math.min(1, d.vie / 1.5));
  g.restore();
}
