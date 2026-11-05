/// <reference types="vite/client" />
// Public configuration only. Vite injects these values; native fixtures use the
// same keys from the process environment. OAuth secrets stay on the website.
// Forge owns the renderer origin in dev. Use the same origin for the window,
// trusted IPC sender and private Hono endpoint. Forge preStart loads .env.local
// into the development main process; packaged apps use their runtime environment.
export const appUrl =
  typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === "string" &&
  MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL
    : (import.meta.env?.VITE_PUBLIC_APP_URL ??
      process.env.VITE_PUBLIC_APP_URL ??
      "");
export const authUrl =
  import.meta.env?.VITE_PUBLIC_AUTH_URL ??
  process.env.VITE_PUBLIC_AUTH_URL ??
  "";
export const oauthClientId =
  import.meta.env?.VITE_PUBLIC_OAUTH_CLIENT_ID ??
  process.env.VITE_PUBLIC_OAUTH_CLIENT_ID ??
  "";
