import { describe, expect, it } from 'vitest';
import type { Commande } from '@core/types';
import { PAS } from '@core/constants';
import { pas } from '@core/partie';
import { EmetteurEntrees, EntreeDistante, SILENCE_ENTREE_S } from '../src/net/entrees';
import { lisEvenement, lisMessageEvenement } from '../src/net/evenements';
import { VERSION_PROTOCOLE } from '../src/net/protocole';
import { partieTest } from './outils';

const cmd = (o: Partial<Commande> = {}): Commande => ({ dx: 0, dy: 0, appuis: [], sprint: false, ...o });
const appuis = (c: Commande) => c.appuis.join(',');

describe('entrées distantes en compteurs cumulés', () => {
  it('transmet direction et course', () => {
    const e = new EmetteurEntrees();
    const h = new EntreeDistante();
    e.suit(cmd({ dx: 0.6, dy: -0.8, sprint: true }));
    expect(h.recoit(e.encode(), 0)).toBe(true);
    const c = h.commande(0.01);
    expect(c.dx).toBeCloseTo(0.6, 1);
    expect(c.dy).toBeCloseTo(-0.8, 1);
    expect(c.sprint).toBe(true);
  });

  it('transmet chaque appui une seule fois', () => {
    const e = new EmetteurEntrees();
    const h = new EntreeDistante();
    h.recoit(e.encode(), 0);
    e.suit(cmd({ appuis: ['plat'] }));
    h.recoit(e.encode(), 0.01);
    expect(appuis(h.commande(0.02))).toBe('plat');
    expect(appuis(h.commande(0.03))).toBe(''); // déjà rendu
    h.recoit(e.encode(), 0.04); // même compteur renvoyé : rien de nouveau
    expect(appuis(h.commande(0.05))).toBe('');
  });

  it("n'en perd aucun malgré un paquet perdu", () => {
    const e = new EmetteurEntrees();
    const h = new EntreeDistante();
    h.recoit(e.encode(), 0);
    e.suit(cmd({ appuis: ['plat'] }));
    e.encode(); // ce paquet-ci est perdu
    e.suit(cmd({ appuis: ['lobe'] }));
    h.recoit(e.encode(), 0.03);
    expect(appuis(h.commande(0.04)).split(',').sort()).toEqual(['lobe', 'plat']);
  });

  it('ignore les doublons et les messages arrivés dans le désordre', () => {
    const e = new EmetteurEntrees();
    const h = new EntreeDistante();
    h.recoit(e.encode(), 0);
    e.suit(cmd({ appuis: ['coupe'] }));
    const m1 = e.encode();
    e.suit(cmd({ dx: 1 }));
    const m2 = e.encode();
    expect(h.recoit(m2, 0.01)).toBe(true);
    expect(h.recoit(m1, 0.02)).toBe(false); // plus vieux, arrivé après
    expect(h.recoit(m2, 0.03)).toBe(false); // doublon
    expect(appuis(h.commande(0.04))).toBe('coupe');
  });

  it("ne rejoue pas les appuis d'avant la connexion", () => {
    const e = new EmetteurEntrees();
    for (let i = 0; i < 7; i++) e.suit(cmd({ appuis: ['plat'] }));
    const h = new EntreeDistante();
    h.recoit(e.encode(), 0);
    expect(appuis(h.commande(0.01))).toBe('');
  });

  it('arrête un joueur distant qui se tait', () => {
    const e = new EmetteurEntrees();
    const h = new EntreeDistante();
    e.suit(cmd({ dx: 1 }));
    h.recoit(e.encode(), 0);
    expect(h.commande(SILENCE_ENTREE_S - 0.1).dx).toBeGreaterThan(0.9);
    expect(h.commande(SILENCE_ENTREE_S + 0.1).dx).toBe(0);
    expect(new EntreeDistante().commande(0).dx).toBe(0);
  });

  it("borne tout ce qu'un client malhonnête enverrait", () => {
    const h = new EntreeDistante();
    const e = new EmetteurEntrees();
    e.suit(cmd());
    const buf = e.encode();
    const v = new DataView(buf);
    v.setInt8(3, 127);
    v.setInt8(4, 127);
    expect(h.recoit(buf, 0)).toBe(true);
    const c = h.commande(0.01);
    expect(Math.hypot(c.dx, c.dy)).toBeLessThanOrEqual(1.0001);
    // une rafale de compteurs truqués ne mitraille pas
    const faux = buf.slice(0);
    new DataView(faux).setUint16(1, 50, true);
    new DataView(faux).setUint8(6, 200);
    expect(h.recoit(faux, 0.02)).toBe(true);
    expect(h.commande(0.03).appuis.length).toBeLessThanOrEqual(2);
    // taille et version
    expect(h.recoit(new ArrayBuffer(3), 1)).toBe(false);
    const v2 = buf.slice(0);
    new DataView(v2).setUint8(0, VERSION_PROTOCOLE + 1);
    expect(h.recoit(v2, 1)).toBe(false);
  });
});

describe('évènements reçus', () => {
  it('relit tous les évènements que la simulation produit, à l’identique', () => {
    const jeu = partieTest({ mode: 'match', jeux: 0, sieges: [0] }, 11);
    const vus = new Set<string>();
    for (let i = 0; i < 120 * 150; i++) {
      pas(jeu, PAS, () => cmd({ appuis: i % 36 === 0 ? ['plat'] : [] }));
      for (const ev of jeu.evenements.splice(0)) {
        vus.add(ev.type);
        const apres = JSON.parse(JSON.stringify(ev));
        expect(lisEvenement(apres), JSON.stringify(ev)).toEqual(ev);
      }
    }
    // la partie a assez vécu pour produire l'essentiel des évènements
    for (const t of ['impact', 'frappe', 'service', 'point', 'jeu']) expect(vus.has(t), t).toBe(true);
  });

  it('rejette ce qui est inconnu, hors limites ou piégé', () => {
    expect(lisEvenement({ type: 'virus' })).toBeNull();
    expect(lisEvenement(null)).toBeNull();
    expect(lisEvenement({ type: 'point', gagnant: 2, raison: 'POINT' })).toBeNull();
    expect(lisEvenement({ type: 'point', gagnant: 0, raison: '<script>' })).toBeNull();
    expect(lisEvenement({ type: 'point', gagnant: 0, raison: 'A'.repeat(500) })).toBeNull();
    expect(
      lisEvenement({ type: 'frappe', coup: 'plat', puissance: 7, portres: false, humain: false, x: 1, y: 1 }),
    ).toBeNull();
    expect(lisEvenement({ type: 'impact', surface: 'sol', x: NaN, y: 1, z: 1, force: 1 })).toBeNull();
    expect(lisEvenement({ type: 'impact', surface: 'lave', x: 1, y: 1, z: 1, force: 1 })).toBeNull();
    expect(lisEvenement({ type: 'jeu', gagnant: 0, jeux: [1, 1000] })).toBeNull();
  });

  it('reconstruit chaque évènement champ par champ, sans laisser passer de champ en trop', () => {
    const e = lisEvenement({ type: 'point', gagnant: 1, raison: 'POR TRES !', pirate: 'x'.repeat(10_000) });
    expect(e).toEqual({ type: 'point', gagnant: 1, raison: 'POR TRES !' });
    expect(e).not.toHaveProperty('pirate');
  });

  it("valide l'enveloppe datée", () => {
    expect(lisMessageEvenement({ t: 12.5, e: { type: 'let' } })).toEqual({ t: 12.5, e: { type: 'let' } });
    expect(lisMessageEvenement({ t: -1, e: { type: 'let' } })).toBeNull();
    expect(lisMessageEvenement({ t: 'x', e: { type: 'let' } })).toBeNull();
    expect(lisMessageEvenement({ t: 1, e: { type: 'nope' } })).toBeNull();
  });
});
