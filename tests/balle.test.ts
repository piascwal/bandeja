import { describe, expect, it } from 'vitest';
import { lance, nouvelleBalle, physique } from '@core/balle';
import { LONG, MIL, PAS } from '@core/constants';
import { filetH } from '@core/terrain';
import type { Equipe, Surface } from '@core/types';

type Contact = { t: Surface; cote: Equipe; force: number | undefined };

/** Fait voler la balle et note chaque contact, jusqu'au premier qui remplit `jusqua`. */
function vole(b = nouvelleBalle(), jusqua: (c: Contact) => boolean, max = 2000) {
  const contacts: Contact[] = [];
  let fini = false;
  for (let i = 0; i < max && !fini; i++) {
    physique(b, PAS, (t, cote, force) => {
      contacts.push({ t, cote, force });
      if (jusqua(contacts.at(-1)!)) fini = true;
    });
  }
  return contacts;
}

describe('physique de la balle', () => {
  it("signale la force d'un rebond au sol : positive, égale à la vitesse d'arrivée", () => {
    const b = nouvelleBalle();
    Object.assign(b, { x: 5, y: 5, z: 0.05, vx: 0, vy: 0, vz: -8 });
    const sols = vole(b, (k) => k.t === 'sol').filter((c) => c.t === 'sol');
    expect(sols[0]!.force).toBeGreaterThan(7.5);
    expect(sols[0]!.force).toBeLessThan(9);
    // la balle repart vers le haut
    expect(b.vz).toBeGreaterThan(0);
  });

  it('rebondit au sol de plus en plus bas, puis roule', () => {
    const b = nouvelleBalle();
    b.z = 2;
    const sols = vole(b, () => false, 1500).filter((c) => c.t === 'sol');
    expect(sols.length).toBeGreaterThan(2);
    expect(sols.at(-1)!.force).toBe(0);
    expect(b.roule).toBe(true);
  });

  it('est arrêtée par le filet quand elle passe trop bas', () => {
    const b = nouvelleBalle();
    Object.assign(b, { x: 8, y: 5, z: 0.4, vx: 10, vy: 0, vz: 0 });
    const c = vole(b, (k) => k.t === 'filet');
    expect(c.at(-1)!.t).toBe('filet');
    expect(b.x).toBeLessThan(MIL);
  });

  it('rebondit contre la vitre du fond et repart', () => {
    const b = nouvelleBalle();
    Object.assign(b, { x: 1, y: 5, z: 1.5, vx: -12, vy: 0, vz: 1 });
    const c = vole(b, (k) => k.t === 'vitre');
    expect(c.at(-1)).toMatchObject({ t: 'vitre', cote: 0 });
    expect(b.vx).toBeGreaterThan(0);
  });

  it('un coup « por » sort par-dessus le grillage du fond au-delà de 4 m', () => {
    const b = nouvelleBalle();
    Object.assign(b, { x: LONG - 0.5, y: 5, z: 5, vx: 10, vy: 0, vz: 2, por: 4 });
    const c = vole(b, (k) => k.t === 'sortie');
    expect(c.at(-1)).toMatchObject({ t: 'sortie', cote: 1 });
    expect(b.dehors).toBe(true);
  });

  it('tout autre coup est retenu par le grillage : jamais de sortie sans « por »', () => {
    const b = nouvelleBalle();
    Object.assign(b, { x: LONG - 0.5, y: 5, z: 5, vx: 10, vy: 0, vz: 2 });
    const c = vole(b, (k) => k.t === 'grille');
    expect(c.at(-1)).toMatchObject({ t: 'grille', cote: 1 });
    expect(b.dehors).toBe(false);
    expect(b.vx).toBeLessThan(0);
    const l = nouvelleBalle();
    Object.assign(l, { x: 12, y: 9.8, z: 3.5, vx: 0, vy: 8, vz: 2 });
    vole(l, (k) => k.t === 'grille');
    expect(l.dehors).toBe(false);
  });

  it('touche le grillage latéral au milieu de la piste', () => {
    const b = nouvelleBalle();
    Object.assign(b, { x: 8, y: 9, z: 1.5, vx: 0, vy: 8, vz: 1 });
    const c = vole(b, (k) => k.t !== 'sol');
    expect(c.at(-1)!.t).toBe('grille');
  });
});

describe('lance', () => {
  const lancee = () => {
    const b = nouvelleBalle();
    Object.assign(b, { x: 3, y: 3, z: 1 });
    lance(b, 16, 7, 18, 'plat', 0.2);
    return b;
  };

  it('passe le filet avec la marge demandée', () => {
    const b = lancee();
    for (let i = 0; i < 2000 && b.x < MIL; i++) physique(b, PAS);
    expect(b.z).toBeGreaterThan(filetH(b.y));
  });

  it('retombe près de la cible, dans le camp adverse', () => {
    const b = lancee();
    const contacts = vole(b, (k) => k.t === 'sol');
    expect(contacts.at(-1)).toMatchObject({ t: 'sol', cote: 1 });
    expect(Math.abs(b.x - 16)).toBeLessThan(0.3);
    expect(Math.abs(b.y - 7)).toBeLessThan(0.3);
  });
});
