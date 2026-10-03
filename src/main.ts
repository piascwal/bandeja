import { BandejaApp } from '@app/app';

const canvas = document.getElementById('ecran') as HTMLCanvasElement;
const app = new BandejaApp(canvas);
void app.demarre();
// outil de test et de mise au point (jamais présent dans la version publiée)
if (import.meta.env.DEV) (window as unknown as { bandeja: BandejaApp }).bandeja = app;

if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      /* pas de PWA en dev, ou plugin indisponible : tant pis */
    });
}
