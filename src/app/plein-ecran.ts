type ElementPleinEcran = HTMLElement & {
  webkitRequestFullscreen?: (o?: FullscreenOptions) => Promise<void> | void;
};
type DocumentPleinEcran = Document & { webkitFullscreenElement?: Element | null };

/** Plein écran et verrouillage en paysage, quand le navigateur le permet (pas sur iPhone). */
export function pleinEcran(): void {
  const el = document.documentElement as ElementPleinEcran;
  const doc = document as DocumentPleinEcran;
  const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!req || doc.fullscreenElement || doc.webkitFullscreenElement) return;
  const verrou = () => {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    o?.lock?.('landscape').catch(() => {});
  };
  try {
    const r = req.call(el, { navigationUI: 'hide' });
    if (r instanceof Promise) r.then(verrou).catch(() => {});
    else verrou();
  } catch {
    /* pas de plein écran : tant pis */
  }
}
