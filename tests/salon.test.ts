import { describe, expect, it } from 'vitest';
import { FORMATS, nomSiege, peutLancer, siegeOuvert, siegesOuverts } from '../src/net/formats';
import {
  appliqueAction,
  appliqueActionHote,
  arrive,
  nbPresents,
  nouveauSalon,
  occupes,
  part,
  siegeDe,
  siegesHumains,
  valideAction,
  valideEtat,
  type EtatSalon,
  type Occupant,
} from '../src/net/salon';

const occ = (n: number): Occupant => ({ nom: `JOUEUR ${n}`, appareil: n.toString(16).padStart(16, '0') });
const HOTE = occ(1);

/** Un salon avec l'hôte et `n` autres appareils qui regardent. */
function salon(format: 'coop' | '1v1' | '2v1' | '1v2' | '2v2' = '2v2', n = 3): EtatSalon {
  const e = nouveauSalon(HOTE, { format, niveau: 1, jeux: 1 });
  for (let i = 0; i < n; i++) arrive(e, occ(i + 2));
  return e;
}

describe('formats', () => {
  it('chaque format ouvre les bons sièges', () => {
    expect(siegesOuverts('coop')).toEqual([0, 1]);
    expect(siegesOuverts('1v1')).toEqual([0, 2]);
    expect(siegesOuverts('2v1')).toEqual([0, 1, 2]);
    expect(siegesOuverts('1v2')).toEqual([0, 2, 3]);
    expect(siegesOuverts('2v2')).toEqual([0, 1, 2, 3]);
    expect(siegeOuvert('coop', 2)).toBe(false);
    expect(FORMATS).toHaveLength(5);
  });

  it('nomme les sièges A1 à B2', () => {
    expect([0, 1, 2, 3].map(nomSiege)).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('exige quelqu’un en face, ou en coop le second siège', () => {
    expect(peutLancer('coop', [true, false, false, false])).toBe(false);
    expect(peutLancer('coop', [true, true, false, false])).toBe(true);
    expect(peutLancer('1v1', [true, false, false, false])).toBe(false);
    expect(peutLancer('1v1', [true, false, true, false])).toBe(true);
    expect(peutLancer('1v2', [true, false, false, true])).toBe(true);
    expect(peutLancer('2v2', [true, true, false, false])).toBe(false);
  });
});

describe('salon', () => {
  it("l'hôte est assis d'office au premier siège, les arrivants regardent", () => {
    const e = salon('2v2', 2);
    expect(siegeDe(e, HOTE.appareil)).toBe(0);
    expect(e.spectateurs).toHaveLength(2);
    expect(siegesHumains(e)).toEqual([0]);
  });

  it('prendre un siège libre, en changer, puis regarder', () => {
    const e = salon();
    const [b, c] = [occ(2), occ(3)];
    expect(appliqueAction(e, b.appareil, { a: 'siege', s: 2 })).toBe(true);
    expect(siegeDe(e, b.appareil)).toBe(2);
    expect(e.spectateurs.find((x) => x.appareil === b.appareil)).toBeUndefined();
    // personne ne vole un siège pris
    expect(appliqueAction(e, c.appareil, { a: 'siege', s: 2 })).toBe(false);
    // changer de siège libère l'ancien
    expect(appliqueAction(e, b.appareil, { a: 'siege', s: 3 })).toBe(true);
    expect(e.sieges[2]).toBeNull();
    expect(appliqueAction(e, c.appareil, { a: 'siege', s: 2 })).toBe(true);
    // repasser spectateur
    expect(appliqueAction(e, b.appareil, { a: 'regarde' })).toBe(true);
    expect(e.sieges[3]).toBeNull();
    expect(e.spectateurs.some((x) => x.appareil === b.appareil)).toBe(true);
    expect(nbPresents(e)).toBe(4);
  });

  it("ne laisse prendre que les sièges du format, et jamais celui de l'hôte", () => {
    const e = salon('coop');
    expect(appliqueAction(e, occ(2).appareil, { a: 'siege', s: 2 })).toBe(false);
    expect(appliqueAction(e, occ(2).appareil, { a: 'siege', s: 0 })).toBe(false);
    expect(appliqueAction(e, occ(2).appareil, { a: 'siege', s: 1 })).toBe(true);
    expect(appliqueAction(e, HOTE.appareil, { a: 'siege', s: 1 })).toBe(false);
    expect(appliqueAction(e, HOTE.appareil, { a: 'regarde' })).toBe(false);
  });

  it('refuse un appareil inconnu et une action hors salle d’attente', () => {
    const e = salon();
    expect(appliqueAction(e, occ(99).appareil, { a: 'siege', s: 1 })).toBe(false);
    appliqueAction(e, occ(2).appareil, { a: 'siege', s: 2 });
    expect(appliqueActionHote(e, { a: 'lance' })).toBe(true);
    expect(e.phase).toBe('jeu');
    expect(appliqueAction(e, occ(3).appareil, { a: 'siege', s: 3 })).toBe(false);
  });

  it('un appareil déjà présent ne se présente pas deux fois ; la salle a un plafond', () => {
    const e = salon('2v2', 1);
    expect(arrive(e, occ(2))).toBe(false);
    expect(arrive(e, HOTE)).toBe(false);
    for (let i = 10; i < 30; i++) arrive(e, occ(i));
    expect(e.spectateurs.length).toBe(8);
  });

  it('un appareil qui part libère son siège', () => {
    const e = salon();
    appliqueAction(e, occ(2).appareil, { a: 'siege', s: 1 });
    part(e, occ(2).appareil);
    expect(e.sieges[1]).toBeNull();
    expect(nbPresents(e)).toBe(3);
  });
});

describe("actions de l'hôte", () => {
  it("lance seulement s'il y a quelqu'un en face", () => {
    const e = salon('1v1');
    expect(appliqueActionHote(e, { a: 'lance' })).toBe(false);
    appliqueAction(e, occ(2).appareil, { a: 'siege', s: 2 });
    expect(occupes(e)).toEqual([true, false, true, false]);
    expect(appliqueActionHote(e, { a: 'lance' })).toBe(true);
  });

  it('changer le format renvoie regarder ceux dont le siège disparaît', () => {
    const e = salon('2v2');
    appliqueAction(e, occ(2).appareil, { a: 'siege', s: 1 });
    appliqueAction(e, occ(3).appareil, { a: 'siege', s: 3 });
    expect(appliqueActionHote(e, { a: 'format', f: '1v1' })).toBe(true);
    expect(siegesHumains(e)).toEqual([0]);
    expect(e.spectateurs.map((x) => x.appareil).sort()).toEqual(
      [occ(2).appareil, occ(3).appareil, occ(4).appareil].sort(),
    );
    expect(appliqueActionHote(e, { a: 'format', f: '1v1' })).toBe(false); // déjà le bon
  });

  it('règle le niveau et les jeux dans les limites, exclut sauf soi-même', () => {
    const e = salon();
    expect(appliqueActionHote(e, { a: 'niveau', n: 2 })).toBe(true);
    expect(appliqueActionHote(e, { a: 'niveau', n: 9 })).toBe(false);
    expect(appliqueActionHote(e, { a: 'jeux', n: -1 })).toBe(false);
    appliqueAction(e, occ(2).appareil, { a: 'siege', s: 1 });
    expect(appliqueActionHote(e, { a: 'exclut', s: 0 })).toBe(false);
    expect(appliqueActionHote(e, { a: 'exclut', s: 1 })).toBe(true);
    expect(e.sieges[1]).toBeNull();
  });

  it('enchaîne la fin de match, la revanche et le retour au salon', () => {
    const e = salon('1v1');
    appliqueAction(e, occ(2).appareil, { a: 'siege', s: 2 });
    expect(appliqueActionHote(e, { a: 'rejoue' })).toBe(false); // pas encore fini
    appliqueActionHote(e, { a: 'lance' });
    e.phase = 'fin';
    expect(appliqueActionHote(e, { a: 'rejoue' })).toBe(true);
    expect(e.phase).toBe('jeu');
    e.phase = 'fin';
    expect(appliqueActionHote(e, { a: 'salon' })).toBe(true);
    expect(e.phase).toBe('attente');
    expect(e.sieges[2]?.nom).toBe('JOUEUR 2'); // les sièges sont gardés
  });
});

/** Un état JSON qu'on abîme à la main dans les tests. */
interface Brut {
  config: { format: unknown; niveau: unknown; jeux: unknown };
  sieges: { nom: unknown; appareil: unknown }[];
  spectateurs: unknown;
  phase: unknown;
  pause: unknown;
  [k: string]: unknown;
}

describe('validation de ce qui vient du réseau', () => {
  it("fait l'aller-retour d'un état par JSON", () => {
    const e = salon('2v1');
    appliqueAction(e, occ(2).appareil, { a: 'siege', s: 1 });
    expect(valideEtat(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });

  it('rejette un état abîmé ou piégé', () => {
    const e = JSON.parse(JSON.stringify(salon()));
    const mauvais = (f: (x: Brut) => void) => {
      const c = JSON.parse(JSON.stringify(e));
      f(c);
      return valideEtat(c);
    };
    expect(valideEtat(null)).toBeNull();
    expect(mauvais((x) => (x.config.format = 'tennis'))).toBeNull();
    expect(mauvais((x) => (x.config.niveau = 7))).toBeNull();
    expect(mauvais((x) => x.sieges.pop())).toBeNull();
    expect(mauvais((x) => (x.sieges[0]!.nom = '<script>'))).toBeNull();
    expect(mauvais((x) => (x.sieges[0]!.appareil = 'x'))).toBeNull();
    expect(mauvais((x) => (x.phase = 'fin du monde'))).toBeNull();
    expect(mauvais((x) => (x.pause = 1))).toBeNull();
    expect(mauvais((x) => (x.spectateurs = Array(50).fill(x.sieges[0])))).toBeNull();
    expect(mauvais((x) => (x.pirate = 'x'.repeat(10_000)))).not.toBeNull();
    expect(mauvais((x) => (x.pirate = 1))).not.toHaveProperty('pirate');
  });

  it('valide les actions des invités, et refuse celles qui sont réservées à l’hôte', () => {
    expect(valideAction({ a: 'siege', s: 2 })).toEqual({ a: 'siege', s: 2 });
    expect(valideAction({ a: 'regarde' })).toEqual({ a: 'regarde' });
    expect(valideAction({ a: 'siege', s: 4 })).toBeNull();
    expect(valideAction({ a: 'siege', s: 1.5 })).toBeNull();
    for (const a of ['lance', 'format', 'exclut', 'niveau', 'rejoue', 'salon'])
      expect(valideAction({ a, s: 1, f: '1v1', n: 1 })).toBeNull();
  });
});
