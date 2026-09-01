/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_DEMO_COURSE_CATALOG?: string;
  readonly VITE_QA_DEMO_BUILD?: string;
  readonly VITE_RELEASE_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
