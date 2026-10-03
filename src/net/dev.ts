import { RECONNEXION_S } from './protocole';

/**
 * Réglages de développement, jamais actifs dans la version publiée :
 * `?reseau=xxx&courtier=ws://localhost:8883` remplace la détection du réseau
 * et les serveurs de découverte publics par un courtier MQTT local, pour tester
 * à plusieurs onglets sur une seule machine (voir e2e/).
 */
export function reglagesDev(): {
  reseau: string | null;
  courtiers: string[] | null;
  reconnexionS: number | null;
} {
  if (!import.meta.env.DEV) return { reseau: null, courtiers: null, reconnexionS: null };
  const q = new URLSearchParams(location.search);
  const c = q.get('courtier');
  const r = Number(q.get('reconnexion'));
  return { reseau: q.get('reseau'), courtiers: c ? [c] : null, reconnexionS: r > 0 && r <= 600 ? r : null };
}

/** Temps laissé à un joueur déconnecté pour revenir (s) : `?reconnexion=8` le raccourcit en développement. */
export const delaiReconnexion = (): number => reglagesDev().reconnexionS ?? RECONNEXION_S;

/** Candidats ICE limités aux plages privées ; relâché en développement, pour les tests. */
export const plageStricte = (): boolean => !reglagesDev().reseau;
