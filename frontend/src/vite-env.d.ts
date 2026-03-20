/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL: string;
  readonly VITE_ENABLE_MOCKS: string;
  /** When "true", production builds skip registering the app service worker (E2E preview + MSW). */
  readonly VITE_SKIP_PWA_SW?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
