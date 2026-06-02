import type { DefaultSession } from "next-auth";

/**
 * Module augmentation: tells TypeScript about the `id` field we add to
 * the User, Session, and JWT shapes via our jwt/session callbacks.
 */
declare module "next-auth" {
  interface User {
    id?: string;
  }

  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
