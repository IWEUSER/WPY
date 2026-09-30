/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIVE_BUILT_AT?: string;
  readonly VITE_VERCEL_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
