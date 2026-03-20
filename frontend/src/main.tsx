import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import '@/index.css';

async function bootstrap() {
  // Conditionally start MSW in development
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    try {
      const { worker } = await import('@/mocks/browser');
      await worker.start({
        onUnhandledRequest: 'bypass',
      });
      console.log('[MSW] Mock service worker started');
    } catch (e) {
      console.warn('[MSW] Failed to start mock service worker:', e);
    }
  }

  // Register service worker for PWA (skip in e2e preview builds so MSW stays in control)
  if (
    'serviceWorker' in navigator &&
    import.meta.env.PROD &&
    import.meta.env.VITE_SKIP_PWA_SW !== 'true'
  ) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[SW] Registered:', reg.scope))
        .catch((err) => console.warn('[SW] Registration failed:', err));
    });
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Root element not found');

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
