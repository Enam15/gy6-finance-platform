import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Route-protection proxy (Next 16's successor to the `middleware` file
 * convention). Auth.js exposes the `authorized` callback (defined in
 * auth.config) as the gate; this file wires it to Next's proxy contract.
 *
 * The Edge-safe slice of the config is used so Prisma + bcrypt are NOT
 * pulled into the Edge bundle - those run only in the Node route handler.
 */
export default NextAuth(authConfig).auth;

export const config = {
  // Run on every path EXCEPT Auth.js's own endpoints, the public health
  // check, Next's static assets, and the favicon.
  matcher: [
    // Also skip public static assets (svg/png/fonts) so auth doesn't run on
    // every image/font request.
    "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
