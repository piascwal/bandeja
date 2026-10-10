import { ASCENSION_FIN_S, FINALE_FIN_S, LUNE_FIN_S, type FinaleSuper } from './finale-super';
import { clamp01, h } from './finale-outils';
import { C, COULEURS_SUPER } from './palette';
import { px } from './primitives';
import type { Vue } from './vue';

/**
 * L'ORBITE : la balle se met en orbite autour de la Terre (vue entière), fait deux tours à toute
 * vitesse, puis un petit ralenti la montre arriver sur un satellite immobile (géostationnaire) :
 * explosion en chaîne, anneaux de choc, gerbe de rayons, panneaux solaires qui tournoient.
 */
const TOURS_FIN = 1.0; // les deux tours (temps depuis le début du plan)
const CHOC = 1.35; // fin du petit ralenti : le choc
const A_SAT = Math.PI * 0.3; // le satellite, devant la Terre, en bas à droite
const A_DEPART = -Math.PI / 2;
const APPROCHE = 0.5; // ce qu'il reste à parcourir pendant le ralenti (rad)
const PARCOURS = A_SAT - APPROCHE - A_DEPART + 4 * Math.PI;

const lisse = (x: number): number => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

/** L'angle de la balle sur l'orbite au temps tau du plan : elle accélère, fait deux tours, puis arrive au ralenti. */
function angle(tau: number): number {
  if (tau < TOURS_FIN) {
    const k = tau / TOURS_FIN;
    return A_DEPART + PARCOURS * k * k * (2 - k);
  }
  if (tau < CHOC) return A_SAT - APPROCHE + APPROCHE * ((tau - TOURS_FIN) / (CHOC - TOURS_FIN));
  return A_SAT;
}

export function orbite(v: Vue, f: FinaleSuper): void {
  const { g, W, H } = v;
  const tau = f.t - ASCENSION_FIN_S;
  const fondu = f.t > LUNE_FIN_S ? clamp01(1 - (f.t - LUNE_FIN_S) / (FINALE_FIN_S - LUNE_FIN_S)) : 1;
  const age = tau - CHOC;
  const secousse = age >= 0 ? 8 * (1 - clamp01(age / 0.45)) : 0;
  g.fillStyle = '#02030a';
  g.globalAlpha = fondu;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 110; i++) {
    g.globalAlpha = fondu * (0.35 + 0.65 * h(i + Math.floor(f.t * 4)));
    px(g, h(i) * W, h(i + 77) * H, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1, '#ffffff');
  }
  g.save();
  g.translate(
    (h(Math.floor(f.t * 50)) - 0.5) * secousse * 2,
    (h(Math.floor(f.t * 50) + 5) - 0.5) * secousse * 2,
  );
  const cx = W / 2;
  const cy = H * 0.55;
  const R = Math.round(H * 0.22);
  const rx = R * 2.2;
  const ry = R * 0.8;
  const couleur = COULEURS_SUPER[3]!;
  // le rayon de l'orbite : la balle part de la surface et s'éloigne en spirale pendant le premier tour
  const rayon = (tt: number) => 0.45 + 0.55 * lisse(tt / 0.35);
  const pos = (a: number, tt: number): [number, number] => [
    cx + Math.cos(a) * rx * rayon(tt),
    cy + Math.sin(a) * ry * rayon(tt),
  ];
  const aBalle = angle(tau);
  // la traînée : des points un peu plus tôt sur la trajectoire (derrière la Terre quand ils sont en haut)
  const trace: { x: number; y: number; k: number; devant: boolean }[] = [];
  const ralenti = tau >= TOURS_FIN && tau < CHOC + 0.25;
  for (let i = 30; i >= 0; i--) {
    const tt = Math.max(0, tau - i * (ralenti ? 0.012 : 0.006));
    const a = angle(tt);
    const [x, y] = pos(a, tt);
    trace.push({ x, y, k: 1 - i / 30, devant: Math.sin(a) >= 0 });
  }
  const dessineTrace = (devant: boolean) => {
    for (const p of trace) {
      if (p.devant !== devant) continue;
      g.globalAlpha = fondu * p.k * 0.9;
      const t = Math.round(1 + p.k * 4);
      px(g, p.x - t / 2, p.y - t / 2, t, t, p.k > 0.7 ? '#ffffff' : couleur);
    }
  };
  dessineTrace(false);
  terre(g, cx, cy, R, f.t, fondu, age);
  // le satellite, immobile, jusqu'au choc
  const [sx, sy] = pos(A_SAT, 1);
  if (age < 0) satellite(g, sx, sy, f.t);
  dessineTrace(true);
  // la balle
  // après le choc, la balle file tout droit (tangente à l'orbite), à travers le nuage de l'explosion
  const tx = -Math.sin(A_SAT) * rx;
  const ty = Math.cos(A_SAT) * ry;
  const tn = Math.hypot(tx, ty);
  const [bx, by] = age < 0 ? pos(aBalle, tau) : [sx + (tx / tn) * age * 320, sy + (ty / tn) * age * 320];
  if (Math.sin(aBalle) >= 0 || age >= 0) {
    g.globalAlpha = fondu * 0.5;
    px(g, bx - 7, by - 7, 14, 14, couleur);
    g.globalAlpha = fondu;
    px(g, bx - 3, by - 3, 6, 6, C.contour);
    px(g, bx - 2, by - 2, 4, 4, C.balle);
  }
  if (age >= 0) explosion(g, sx, sy, age, fondu);
  g.restore();
  // le petit ralenti : bandes de cinéma épaisses et teinte froide
  if (ralenti) {
    const k = clamp01(Math.min(tau - TOURS_FIN, CHOC + 0.25 - tau) / 0.1);
    g.globalAlpha = 0.85 * k;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, 26);
    g.fillRect(0, H - 26, W, 26);
    g.globalAlpha = 0.12 * k;
    g.fillStyle = '#4a7aff';
    g.fillRect(0, 26, W, H - 52);
  }
  // l'éclair du choc, sur tout l'écran
  if (age >= 0 && age < 0.14) {
    g.globalAlpha = (1 - age / 0.14) * fondu;
    g.fillStyle = age < 0.05 ? '#ffffff' : '#bfe6ff';
    g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1;
}

/** La Terre, entière : mers, continents qui tournent, atmosphère ; l'explosion l'éclaire. */
function terre(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  t: number,
  fondu: number,
  age: number,
): void {
  g.globalAlpha = fondu * 0.3;
  g.fillStyle = '#4a8cff';
  g.beginPath();
  g.arc(cx, cy, R + 6, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = fondu;
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#1d4fb0';
  g.fillRect(cx - R, cy - R, R * 2, R * 2);
  const rot = t * 18;
  for (let i = 0; i < 8; i++) {
    const x = cx - R + (((h(i) * R * 3 + rot) % (R * 3)) - R * 0.5);
    px(g, x, cy - R + h(i + 20) * R * 1.8, 10 + h(i + 9) * 24, 5 + h(i + 3) * 10, '#3e9a4a');
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 6; i++)
    g.fillRect(
      cx - R + (((h(i + 70) * R * 3 + rot * 1.6) % (R * 3)) - R * 0.5),
      cy - R + h(i + 80) * R * 1.8,
      22,
      3,
    );
  // l'ombre de la nuit, et la lueur orange de l'explosion
  g.fillStyle = 'rgba(0,0,20,0.35)';
  g.beginPath();
  g.arc(cx - R * 0.5, cy - R * 0.3, R * 1.4, 0, Math.PI * 2);
  g.arc(cx + R * 0.6, cy + R * 0.2, R * 1.2, 0, Math.PI * 2, true);
  g.fill();
  if (age >= 0) {
    g.globalAlpha = fondu * 0.5 * (1 - clamp01(age / 0.5));
    g.fillStyle = '#ff9a3a';
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  g.restore();
  g.globalAlpha = 1;
}

/** Le satellite : un corps argenté, deux grands panneaux solaires, une antenne, une lumière qui clignote. */
function satellite(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  px(g, x - 4, y - 4, 9, 9, '#c8ccd8');
  px(g, x - 4, y - 4, 9, 2, '#ffffff');
  for (const d of [-1, 1]) {
    px(g, x + d * 6 - (d < 0 ? 14 : 0), y - 3, 14, 7, '#2a4fd8');
    for (let k = 0; k < 3; k++) px(g, x + d * 6 - (d < 0 ? 14 : 0) + k * 5, y - 3, 1, 7, '#8fb0ff');
  }
  px(g, x, y - 9, 1, 5, '#ffffff');
  px(g, x - 2, y - 10, 5, 1, '#ffffff');
  if (Math.floor(t * 6) % 2 === 0) px(g, x + 3, y - 7, 2, 2, '#ff3b3b');
}

/** L'explosion du satellite : boule de feu, anneaux de choc, rayons, explosions en chaîne, panneaux qui tournoient. */
function explosion(g: CanvasRenderingContext2D, x: number, y: number, age: number, fondu: number): void {
  const fin = 1 - clamp01(age / 0.6);
  // les rayons de la gerbe
  g.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + h(i) * 0.3;
    const l = 30 + age * (260 + h(i + 5) * 160);
    g.globalAlpha = fondu * fin * 0.8;
    g.strokeStyle = i % 2 ? '#ffffff' : '#ffd27a';
    g.beginPath();
    g.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // quatre anneaux de choc, de couleurs différentes, à des vitesses différentes
  for (const [v, c] of [
    [520, '#ffffff'],
    [380, '#ffd27a'],
    [260, '#5fd0ff'],
    [170, '#ff5ab0'],
  ] as [number, string][]) {
    g.globalAlpha = fondu * fin;
    g.strokeStyle = c;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(x, y, age * v, age * v * 0.45, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // la boule de feu, qui gonfle et vacille, puis explosions en chaîne autour
  const boule = (bx: number, by: number, a: number, taille: number) => {
    if (a < 0 || a > 0.5) return;
    const r = taille * (0.3 + Math.sqrt(a / 0.5)) * (0.9 + 0.1 * Math.sin(a * 60));
    for (const [k, c] of [
      [1, '#ff4a1a'],
      [0.75, '#ffa028'],
      [0.5, '#fff2b0'],
      [0.25, '#ffffff'],
    ] as [number, string][]) {
      g.globalAlpha = fondu * (1 - a / 0.5);
      g.fillStyle = c;
      g.beginPath();
      g.arc(bx, by, r * k, 0, Math.PI * 2);
      g.fill();
    }
  };
  boule(x, y, age, 46);
  boule(x + 26, y - 14, age - 0.1, 24);
  boule(x - 30, y + 8, age - 0.18, 22);
  boule(x + 8, y + 22, age - 0.26, 18);
  // les deux panneaux solaires, arrachés, qui tournoient
  for (const d of [-1, 1]) {
    g.save();
    g.globalAlpha = fondu * clamp01(1.2 - age);
    g.translate(x + d * age * 140, y - age * 60 + age * age * 80);
    g.rotate(age * 14 * d);
    g.fillStyle = '#2a4fd8';
    g.fillRect(-8, -4, 16, 8);
    g.fillStyle = '#8fb0ff';
    g.fillRect(-8, -4, 16, 1);
    g.restore();
  }
  // les débris et les étincelles
  for (let i = 0; i < 90; i++) {
    const a = h(i + 600) * Math.PI * 2;
    const vit = 40 + h(i + 650) * 220;
    g.globalAlpha = fondu * clamp01(1 - age * (i < 30 ? 1.2 : 2));
    const gros = i < 18;
    px(
      g,
      x + Math.cos(a) * vit * age,
      y + Math.sin(a) * vit * age * 0.7,
      gros ? 3 : 1,
      gros ? 3 : 1,
      gros ? '#c8ccd8' : i % 3 ? '#ffd27a' : '#ffffff',
    );
  }
  g.globalAlpha = 1;
}
