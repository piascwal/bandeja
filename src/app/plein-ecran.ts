/**
 * Plein écran façon « webview » : le jeu doit occuper tout l'écran du
 * téléphone, sans barre d'adresse.
 *
 * - Installée sur l'écran d'accueil (PWA), l'app s'ouvre directement sans
 *   barre de navigateur grâce au manifeste (`display: fullscreen`,
 *   `orientation: landscape`, voir vite.config.ts), y compris sur iPhone
 *   (balises apple-mobile-web-app-* de index.html).
 * - Ouverte dans le navigateur, on demande l'API Fullscreen au tout premier
 *   geste (les navigateurs la refusent sans geste), puis le verrouillage en
 *   paysage. Safari iPhone ne l'implémente pas : il faut alors l'installer.
 */

type ElementPleinEcran = HTMLElement & {
  webkitRequestFullscreen?: (o?: FullscreenOptions) => Promise<void> | void;
};
type DocumentPleinEcran = Document & { webkitFullscreenElement?: Element | null };

export function estPleinEcran(): boolean {
  const doc = document as DocumentPleinEcran;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/** L'app tourne-t-elle installée (PWA), donc déjà sans barre de navigateur ? */
export function estAutonome(): boolean {
  return (
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Tente le plein écran puis le verrou paysage ; résout true si l'écran est en plein écran. */
export async function demandePleinEcranPaysage(): Promise<boolean> {
  if (estPleinEcran()) return true;
  const el = document.documentElement as ElementPleinEcran;
  const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (!req) return false;
  try {
    await req({ navigationUI: 'hide' });
  } catch {
    // refusé : pas de geste valable (le doigt n'active qu'au pointerup) ou pas de support (iPhone)
    return false;
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o?.lock?.('landscape');
  } catch {
    /* verrou refusé (ordinateur) ou API indisponible : tant pis */
  }
  return estPleinEcran();
}

/**
 * Passe en plein écran au premier geste possible, puis se tait : si le joueur
 * quitte volontairement le plein écran, on ne le lui réimpose qu'au lancement
 * d'un match.
 */
export class PleinEcranAuPremierGeste {
  private obtenu = estAutonome();
  private enCours = false;

  tente(): void {
    if (this.obtenu || this.enCours) return;
    this.enCours = true;
    void demandePleinEcranPaysage().then((ok) => {
      this.enCours = false;
      if (ok) this.obtenu = true;
    });
  }

  /** Au lancement d'un match : on redemande, même après une sortie volontaire. */
  relance(): void {
    this.obtenu = estAutonome();
    this.tente();
  }
}
