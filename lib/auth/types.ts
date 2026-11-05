export interface AuthSnapshot {
  loginBrowser?: "default" | "gorth";
  user: {
    id: string;
    name: string;
    email?: string;
    username?: string;
    image?: string;
    emailVerified?: boolean;
    expiresAt: number;
    verifiedAt?: number;
    canRefresh?: boolean;
    needsLogin: boolean;
  } | null;
  locked: boolean;
  configured: boolean;
  busy: boolean;
}
export type AuthAction =
  "login" | "register" | "unlock" | "logout" | "refresh" | "cancel";
export type AuthResult = { snapshot: AuthSnapshot; error?: string };
