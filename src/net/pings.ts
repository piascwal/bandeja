import type { EtatSalon } from './salon';

/** Les latences des sièges : null pour un CPU, l'hôte lui-même (siège 0) ou un appareil pas encore mesuré. */
export type Pings = (number | null)[];

export const PINGS_VIDES = (): Pings => [null, null, null, null];

/** La latence (ms) de chaque siège, d'après ce que l'hôte mesure sur chaque appareil. */
export function calculePings(
  etat: EtatSalon,
  mesures: readonly { appareil: string | null; latenceMs: number | null }[],
): Pings {
  return etat.sieges.map((o, i) => {
    if (!o || i === 0) return null;
    const ms = mesures.find((m) => m.appareil === o.appareil)?.latenceMs ?? null;
    return ms === null ? null : Math.round(ms);
  });
}
