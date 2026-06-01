/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ── Required ────────────────────────────────────────────────────────
  readonly VITE_CONVEX_URL: string;

  // ── Optional ────────────────────────────────────────────────────────
  readonly VITE_CONVEX_SITE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_ANALYTICS_URL?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;

  // ── Built-in Vite flags ─────────────────────────────────────────────
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
