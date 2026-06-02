import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the Auth.js config. Has no providers, no Prisma, no
 * bcrypt - so middleware (which runs in the Edge runtime) can import it
 * without pulling those into its bundle.
 *
 * The full config lives in `auth.ts` (Node runtime, used by the API route
 * handler at `/api/auth/[...nextauth]`). That file extends this one with
 * the Credentials provider whose authorize callback queries the DB.
 *
 * The `authorized` callback below is what middleware uses to gate routes:
 * return `true` to allow, `false` to redirect to the configured signIn
 * page (`/login`).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      // /login itself is always reachable; everything else needs a session.
      // Already-signed-in users land on /login? The page itself redirects
      // them away (handled in T33).
      if (pathname === "/login") return true;
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      // `user` is only present on initial sign-in; on subsequent requests
      // we hydrate from the token.
      if (user) {
        token.id = user.id ?? "";
        if (user.email) token.email = user.email;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
  providers: [], // Real providers live in auth.ts
} satisfies NextAuthConfig;
