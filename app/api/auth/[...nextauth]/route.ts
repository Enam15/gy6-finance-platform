import { handlers } from "@/auth";

/**
 * Auth.js v5 catch-all route handler. Owns /api/auth/signin,
 * /api/auth/signout, /api/auth/session, /api/auth/csrf, /api/auth/callback.
 */
export const { GET, POST } = handlers;
