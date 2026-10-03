/**
 * Réglages de développement, jamais actifs dans la version publiée :
 * `?reseau=xxx&courtier=ws://localhost:8883` remplace la détection du réseau
 * et les serveurs de découverte publics par un courtier MQTT local, pour tester
 * à plusieurs onglets sur une seule machine (voir e2e/).
 */
export function reglagesDev(): { reseau: string | null; courtiers: string[] | null } {
  if (!import.meta.env.DEV) return { reseau: null, courtiers: null };
  const q = new URLSearchParams(location.search);
  const c = q.get('courtier');
  return { reseau: q.get('reseau'), courtiers: c ? [c] : null };
}

/** Candidats ICE limités aux plages privées ; relâché en développement, pour les tests. */
export const plageStricte = (): boolean => !reglagesDev().reseau;
