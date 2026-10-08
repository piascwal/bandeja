import { describe, expect, it } from 'vitest';
import { PAS } from '@core/constants';
import { pas } from '@core/partie';
import { appliqueInstantane } from '../src/net/appliquer';
import { decodeInstantane, encodeInstantane, instantaneDe, TAILLE_INSTANTANE } from '../src/net/instantane';
import { VERSION_PROTOCOLE } from '../src/net/protocole';
import { frappeurImmobile, partieTest } from './outils';

/** Une partie réelle, jouée un moment, dont on photographie plusieurs instants. */
function instants(seed: number, n: number) {
  const jeu = partieTest({ mode: 'match', sieges: [0, 1] }, seed);
  const photos = [];
  for (let i = 0; i < n * 60; i++) {
    pas(jeu, PAS, () => frappeurImmobile(i));
    jeu.evenements.length = 0;
    if (i % 60 === 0) photos.push(instantaneDe(jeu, i / 60));
  }
  return { jeu, photos };
}

describe('instantané binaire', () => {
  it('a une taille fixe et petite', () => {
    const { photos } = instants(1, 5);
    for (const p of photos) expect(encodeInstantane(p).byteLength).toBe(TAILLE_INSTANTANE);
    expect(TAILLE_INSTANTANE).toBeLessThan(200);
  });

  it("fait l'aller-retour de vraies positions de match, à la précision d'un flottant 32 bits", () => {
    const { photos } = instants(7, 90);
    expect(photos.length).toBe(90);
    for (const p of photos) {
      const d = decodeInstantane(encodeInstantane(p))!;
      expect(d).not.toBeNull();
      expect(d.phase).toBe(p.phase);
      expect(d.pts).toEqual(p.pts);
      expect(d.jeux).toEqual(p.jeux);
      expect(d.serveur).toBe(p.serveur);
      expect(d.stats).toEqual(p.stats);
      expect(d.jauge?.type).toBe(p.jauge?.type);
      expect(d.balle.coup).toBe(p.balle.coup);
      expect(d.balle.spin).toBe(p.balle.spin);
      expect(d.balle.sol).toBe(p.balle.sol);
      expect(d.balle.x).toBeCloseTo(p.balle.x, 3);
      expect(d.balle.z).toBeCloseTo(p.balle.z, 3);
      p.joueurs.forEach((j, i) => {
        const r = d.joueurs[i]!;
        expect(r.x).toBeCloseTo(j.x, 3);
        expect(r.y).toBeCloseTo(j.y, 3);
        expect(r.haut).toBe(j.haut);
        expect(r.intent).toBe(j.intent);
        expect(r.poseCoup).toBe(j.poseCoup);
        expect(Math.abs(r.swing - j.swing)).toBeLessThan(1 / 255);
        expect(Math.abs(r.charge - j.charge)).toBeLessThan(1 / 255);
      });
    }
  });

  it('transmet les trois poses de coup et la hauteur du saut', () => {
    const { jeu } = instants(3, 20);
    const photo = instantaneDe(jeu, 0);
    for (const pose of ['attente', 'smash1', 'smash2'] as const) {
      photo.joueurs[0]!.poseCoup = pose;
      photo.joueurs[0]!.saut = pose === 'smash2' ? 2.4 : 0;
      const d = decodeInstantane(encodeInstantane(photo))!;
      expect(d.joueurs[0]!.poseCoup).toBe(pose);
      expect(d.joueurs[0]!.saut).toBeCloseTo(photo.joueurs[0]!.saut, 1);
    }
  });

  it("pose l'instantané sur la partie locale d'un invité", () => {
    const { jeu } = instants(3, 20);
    const invite = partieTest({ mode: 'match', sieges: [0, 1], local: 1 }, 99);
    appliqueInstantane(invite, decodeInstantane(encodeInstantane(instantaneDe(jeu, 0)))!);
    expect(invite.phase).toBe(jeu.phase);
    expect(invite.serveur.id).toBe(jeu.serveur.id);
    expect(invite.pts).toEqual(jeu.pts);
    expect(invite.joueurs[2]!.x).toBeCloseTo(jeu.joueurs[2]!.x, 3);
    expect(invite.balle.x).toBeCloseTo(jeu.balle.x, 3);
    expect(invite.balle.trace.length).toBe(1);
    // le joueur de cet écran reste celui de l'invité, pas celui de l'hôte
    expect(invite.humain?.id).toBe(1);
  });

  it('rejette tout ce qui est tronqué, trop long, de la mauvaise version ou délirant', () => {
    const { photos } = instants(5, 3);
    const buf = encodeInstantane(photos[1]!);
    expect(decodeInstantane(buf.slice(0, TAILLE_INSTANTANE - 1))).toBeNull();
    expect(decodeInstantane(new ArrayBuffer(TAILLE_INSTANTANE + 1))).toBeNull();
    expect(decodeInstantane(new ArrayBuffer(0))).toBeNull();
    const modifie = (f: (v: DataView) => void) => {
      const c = buf.slice(0);
      f(new DataView(c));
      return decodeInstantane(c);
    };
    expect(modifie((v) => v.setUint8(0, VERSION_PROTOCOLE + 1))).toBeNull(); // version
    expect(modifie((v) => v.setFloat32(3, NaN, true))).toBeNull(); // temps
    expect(modifie((v) => v.setUint8(7, 99))).toBeNull(); // phase inconnue
    expect(modifie((v) => v.setFloat32(7 + 2 + 3 + 3 + 8 + 5, 1e9, true))).toBeNull(); // x du premier joueur
    expect(modifie((v) => v.setFloat32(7 + 2 + 3 + 3 + 8 + 5, Infinity, true))).toBeNull();
    expect(modifie(() => {})).not.toBeNull();
  });

  it('survit à des paquets aléatoires sans jamais lever d’exception', () => {
    let graine = 12345;
    const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) & 0xff;
    for (let n = 0; n < 500; n++) {
      const octets = new Uint8Array(TAILLE_INSTANTANE).map(hasard);
      octets[0] = VERSION_PROTOCOLE; // on passe la porte de la version pour atteindre le reste
      expect(() => decodeInstantane(octets.buffer)).not.toThrow();
    }
  });
});
