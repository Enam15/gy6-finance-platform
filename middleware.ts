import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Route-protection middleware. Auth.js exposes the `authorized` callback
 * (defined in auth.config) as the gate; this file just wires it up to
 * Next's middleware contract.
 *
 * We use the Edge-safe slice of the config so Prisma + bcrypt are NOT
 * pulled into the Edge bundle - those only run in the route handler.
 */
export default NextAuth(authConfig).auth;

export const config = {
  // Run on every path EXCEPT Auth.js's own endpoints, Next's static assets,
  // and the favicon. The favicon exclusion stops the icon request from
  // triggering an auth check on every page load.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
