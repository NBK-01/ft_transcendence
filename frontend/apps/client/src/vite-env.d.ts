/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API prefix. Defaults to "/api" (Vite proxy in dev, nginx in prod). */
  readonly VITE_API_URL?: string;
  /** "true" to serve the mock backend (MSW) instead of calling the real API. */
  readonly VITE_API_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
