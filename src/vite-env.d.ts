/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIVE_BUILT_AT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
