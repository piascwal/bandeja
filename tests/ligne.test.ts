import { describe, expect, it } from 'vitest';
import { ouvreReseau } from '../src/net/canal';
import { lisCtrl } from '../src/net/ctrl';
import { calculePings } from '../src/net/pings';
import { arrive, nouveauSalon } from '../src/net/salon';
import { construitPings, type ContexteVues } from '../src/app/vues-lan';

const salon = () => {
  const e = nouveauSalon({ nom: 'HOTE', appareil: 'a'.repeat(16) }, { format: 'coop', niveau: 1, jeux: 1 });
  arrive(e, { nom: 'LEA', appareil: 'b'.repeat(16) });
  e.sieges[1] = e.spectateurs.pop() ?? null;
  return e;
};

describe('jeu en ligne', () => {
  it('un salon en ligne a son propre salon chiffré, un code invalide est refusé', async () => {
    const r = await ouvreReseau({ type: 'ligne', code: 'KYNX-4K7P' });
    expect(r.enLigne).toBe(true);
    expect(r.salons).toHaveLength(1);
    expect(r.salons[0]!.base).toMatch(/\/ligne\//);
    await expect(ouvreReseau({ type: 'ligne', code: 'nimporte' })).rejects.toThrow('code');
  });

  it('valide le message des pings : quatre sièges, des durées bornées ou rien', () => {
    expect(lisCtrl({ t: 'pings', p: [null, 42, null, 0] })).toEqual({ t: 'pings', p: [null, 42, null, 0] });
    for (const p of [
      [1, 2, 3],
      [null, -1, null, null],
      [null, 1.5, null, null],
      [null, 99999, null, null],
      'x',
    ])
      expect(lisCtrl({ t: 'pings', p }), JSON.stringify(p)).toBeNull();
  });

  it('calcule la latence de chaque siège, sans celle de l’hôte ni des CPU', () => {
    const e = salon();
    const p = calculePings(e, [{ appareil: 'b'.repeat(16), latenceMs: 41.6 }]);
    expect(p).toEqual([null, 42, null, null]);
    expect(calculePings(e, [{ appareil: 'b'.repeat(16), latenceMs: null }])[1]).toBeNull();
  });

  it('affiche le ping des joueurs humains, le sien repéré', () => {
    const e = salon();
    const c = {
      hote: null,
      client: { pings: [null, 42, null, null], appareil: 'b'.repeat(16) },
      etat: e,
    } as unknown as ContexteVues;
    expect(construitPings(c)).toEqual([{ nom: 'LEA', ms: 42, moi: true }]);
  });
});
