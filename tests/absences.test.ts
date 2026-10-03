import { describe, expect, it } from 'vitest';
import { basculePause, finAbsence, marqueAbsent, Minuteries, revient } from '../src/net/absences';
import { REPRISE_S } from '../src/net/protocole';
import {
  appliqueAction,
  arrive,
  jeuActif,
  nouveauSalon,
  valideEtat,
  type EtatSalon,
  type Occupant,
} from '../src/net/salon';

const occ = (n: number): Occupant => ({ nom: `JOUEUR ${n}`, appareil: n.toString(16).padStart(16, '0') });

/** Un match en cours, hôte + A2 + B1 assis. */
function match(): EtatSalon {
  const e = nouveauSalon(occ(1), { format: '2v1', niveau: 1, jeux: 1 });
  for (const n of [2, 3]) arrive(e, occ(n));
  appliqueAction(e, occ(2).appareil, { a: 'siege', s: 1 });
  appliqueAction(e, occ(3).appareil, { a: 'siege', s: 2 });
  e.phase = 'jeu';
  return e;
}

describe("absence d'un joueur en plein match", () => {
  it('fige la partie et garde son siège', () => {
    const e = match();
    expect(jeuActif(e)).toBe(true);
    expect(marqueAbsent(e, 1, 60)).toBe(true);
    expect(e.absents).toEqual([1]);
    expect(e.reconnexion).toBe(60);
    expect(e.sieges[1]?.nom).toBe('JOUEUR 2'); // le siège est gardé
    expect(jeuActif(e)).toBe(false);
  });

  it("ne concerne ni l'hôte, ni un siège vide, ni un salon d'attente, ni deux fois le même", () => {
    const e = match();
    expect(marqueAbsent(e, 0, 60)).toBe(false);
    expect(marqueAbsent(e, 3, 60)).toBe(false);
    expect(marqueAbsent(e, 1, 60)).toBe(true);
    expect(marqueAbsent(e, 1, 60)).toBe(false);
    const attente = match();
    attente.phase = 'attente';
    expect(marqueAbsent(attente, 1, 60)).toBe(false);
  });

  it('un deuxième absent ne prolonge pas le délai', () => {
    const e = match();
    marqueAbsent(e, 1, 60);
    e.reconnexion = 40;
    marqueAbsent(e, 2, 60);
    expect(e.reconnexion).toBe(40);
    expect(e.absents).toEqual([1, 2]);
  });

  it('la partie ne repart que quand tous les absents sont revenus, après le compte à rebours', () => {
    const e = match();
    marqueAbsent(e, 1, 60);
    marqueAbsent(e, 2, 60);
    expect(revient(e, 1)).toBe(true);
    expect(e.absents).toEqual([2]);
    expect(e.reprise).toBe(0); // un autre est encore absent
    expect(jeuActif(e)).toBe(false);
    expect(revient(e, 2)).toBe(true);
    expect(e.reconnexion).toBe(0);
    expect(e.reprise).toBe(REPRISE_S);
    expect(jeuActif(e)).toBe(false); // il reste le compte à rebours
    expect(revient(e, 2)).toBe(false);
  });

  it('au bout du délai, les sièges absents sont libérés et la partie repart', () => {
    const e = match();
    marqueAbsent(e, 1, 60);
    expect(finAbsence(e)).toEqual(['JOUEUR 2']);
    expect(e.sieges[1]).toBeNull();
    expect(e.sieges[2]?.nom).toBe('JOUEUR 3'); // les présents ne bougent pas
    expect(e.absents).toEqual([]);
    expect(e.reprise).toBe(REPRISE_S);
  });
});

describe('pause partagée et reprise', () => {
  it('la reprise passe par le compte à rebours', () => {
    const e = match();
    expect(basculePause(e, true)).toBe(true);
    expect(jeuActif(e)).toBe(false);
    expect(basculePause(e, true)).toBe(false);
    expect(basculePause(e, false)).toBe(true);
    expect(e.reprise).toBe(REPRISE_S);
    expect(jeuActif(e)).toBe(false);
  });

  it("n'existe qu'en match", () => {
    const e = match();
    e.phase = 'attente';
    expect(basculePause(e, true)).toBe(false);
  });
});

describe('minuteries', () => {
  it('arrivent à zéro en REPRISE_S secondes et le disent à chaque seconde', () => {
    const e = match();
    const m = new Minuteries();
    e.reprise = REPRISE_S;
    const secondes: number[] = [];
    let t = 0;
    while (e.reprise > 0 && t < 10) {
      if (m.avance(e, 0.05) === 'seconde') secondes.push(e.reprise);
      t += 0.05;
    }
    expect(secondes).toEqual([2, 1, 0]);
    expect(t).toBeGreaterThan(REPRISE_S - 0.2);
    expect(t).toBeLessThan(REPRISE_S + 0.2);
    expect(jeuActif(e)).toBe(true);
  });

  it('annoncent la fin du délai de reconnexion', () => {
    const e = match();
    const m = new Minuteries();
    marqueAbsent(e, 1, 5);
    let fini = false;
    let t = 0;
    while (!fini && t < 10) {
      fini = m.avance(e, 0.1) === 'fini';
      t += 0.1;
    }
    expect(fini).toBe(true);
    expect(t).toBeGreaterThan(4.8);
    expect(t).toBeLessThan(5.3);
  });

  it('ne décomptent pas la reprise pendant une pause ni hors match', () => {
    const e = match();
    const m = new Minuteries();
    e.pause = true;
    e.reprise = 2;
    expect(m.avance(e, 5)).toBe('rien');
    expect(e.reprise).toBe(2);
  });
});

describe('état partagé avec les nouveaux champs', () => {
  it("fait l'aller-retour, et rejette des absents ou des comptes à rebours délirants", () => {
    const e = match();
    marqueAbsent(e, 1, 30);
    expect(valideEtat(JSON.parse(JSON.stringify(e)))).toEqual(e);
    const abime = (f: (x: Record<string, unknown>) => void) => {
      const c = JSON.parse(JSON.stringify(e)) as Record<string, unknown>;
      f(c);
      return valideEtat(c);
    };
    expect(abime((x) => (x.absents = [7]))).toBeNull();
    expect(abime((x) => (x.absents = [3]))).toBeNull(); // un siège vide ne peut pas être absent
    expect(abime((x) => (x.absents = 'oui'))).toBeNull();
    expect(abime((x) => (x.reconnexion = -1))).toBeNull();
    expect(abime((x) => (x.reconnexion = 1e9))).toBeNull();
    expect(abime((x) => (x.reprise = 99))).toBeNull();
    expect(abime((x) => delete x.reprise)).toBeNull();
  });
});
