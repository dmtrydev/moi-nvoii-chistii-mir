/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Если задан — режим «Кадастровая» показывает эту страницу во iframe (как ik8map.roscadastres.com). */
  readonly VITE_CADASTRE_IFRAME_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
