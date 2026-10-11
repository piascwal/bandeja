/**
 * Les sièges qui ont vu ou passé la scène du point en cours (fin de super coup, ralenti). L'hôte
 * attend que tous ses invités l'aient fait avant de reprendre le jeu.
 */
export class Passes {
  private readonly sieges = new Set<number>();

  /** Un siège a passé (un appareil sans siège, comme un spectateur, ne compte pas : -1). */
  ajoute(siege: number): void {
    if (siege >= 0) this.sieges.add(siege);
  }

  /** Tous les invités assis ont-ils passé ? (l'hôte, siège 0, décide pour lui-même) */
  tousInvites(humains: readonly number[]): boolean {
    return humains.every((s) => s === 0 || this.sieges.has(s));
  }

  /** Un nouveau point : on oublie ce que chacun avait passé. */
  raz(): void {
    this.sieges.clear();
  }
}
