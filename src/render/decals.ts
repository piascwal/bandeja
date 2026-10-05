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

/** Le terrain cassé : un cratère sombre, des fissures qui rayonnent sur la piste, des éclats clairs au bord. */
function cratere(v: Vue, d: Decal, a: number): void {
  const { g, K } = v;
  const alea = graine(d.graine);
  // le cratère : une ellipse sombre, deux fois (le bord, puis le fond)
  for (const [r, c] of [
    [1.5, `rgba(20,16,30,${0.5 * a})`],
    [0.9, `rgba(6,6,16,${0.75 * a})`],
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
  for (let b = 0; b < 12; b++) {
    let ang = (b / 12) * Math.PI * 2 + alea() * 0.4;
    let x = d.x;
    let y = d.y;
    g.beginPath();
    const [x0, y0] = K.proj(x, y, 0);
    g.moveTo(x0, y0);
    const n = 3 + Math.floor(alea() * 3);
    for (let i = 0; i < n; i++) {
      ang += (alea() - 0.5) * 0.9;
      const l = 0.5 + alea() * 0.7;
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
  for (let i = 0; i < 14; i++) {
    const ang = alea() * Math.PI * 2;
    const r = 1 + alea() * 1.6;
    const [sx, sy] = K.proj(d.x + Math.cos(ang) * r * 1.2, d.y + Math.sin(ang) * r * 0.8, 0);
    g.globalAlpha = a;
    px(g, sx, sy, 2, 1, i % 2 ? '#d9c9a8' : '#6b5a48');
  }
  g.globalAlpha = 1;
}

/** La vitre percée : un trou sombre en étoile, des lignes de rupture, quelques éclats restés accrochés. */
function trou(v: Vue, d: Decal, a: number): void {
  const { g, K } = v;
  const alea = graine(d.graine);
  const [cx, cy] = K.proj(d.x, d.y, d.z);
  for (let b = 0; b < 16; b++) {
    const ang = (b / 16) * Math.PI * 2 + alea() * 0.3;
    const l = 8 + alea() * 14;
    let x = cx;
    let y = cy;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 3; i++) {
      x += Math.cos(ang + (alea() - 0.5) * 0.7) * (l / 3);
      y += Math.sin(ang + (alea() - 0.5) * 0.7) * (l / 3);
      g.lineTo(x, y);
    }
    g.strokeStyle = `rgba(6,8,22,${0.8 * a})`;
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = `rgba(235,248,255,${0.9 * a})`;
    g.lineWidth = 1;
    g.stroke();
  }
  g.fillStyle = `rgba(4,6,16,${0.85 * a})`;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const r = 4 + alea() * 4;
    const px0 = cx + Math.cos(ang) * r;
    const py0 = cy + Math.sin(ang) * r;
    if (i === 0) g.moveTo(px0, py0);
    else g.lineTo(px0, py0);
  }
  g.fill();
}

/** Les dégâts des super coups sur la piste et les vitres, dessinés avant les joueurs. */
export function dessineDecals(v: Vue, decals: readonly Decal[]): void {
  for (const d of decals) {
    const a = Math.min(1, d.vie / 1.5);
    if (d.kind === 'sol') cratere(v, d, a);
    else trou(v, d, a);
  }
}
