import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Server-side helpers built on Auth.js's `auth()` function.
 *
 * Use `requireSession()` in route handlers and server components where a
 * logged-in user is required - returns the session on success, redirects
 * to /login otherwise.
 *
 * Use `getSession()` when you want to read the session without forcing
 * a redirect (e.g. for "show username if logged in, otherwise show
 * sign-in link" UI patterns).
 */

export interface SessionActor {
  id: string;
  label: string;
}

/** Throw-style: redirects to /login if not signed in. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

/** Returns the session or null without redirecting. */
export async function getSession() {
  return auth();
}

/**
 * Pull the actor id and label out of the session for passing into
 * services' audit log calls. Returns nulls if no session - the audit
 * columns are nullable, so this just means an unattributed row.
 */
export async function getActor(): Promise<SessionActor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    label: session.user.name ?? session.user.email ?? session.user.id,
  };
}
