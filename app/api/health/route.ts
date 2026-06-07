import { prisma } from "@/lib/prisma";

/**
 * Public health check for uptime monitors. Pings the database with a trivial
 * query; returns 200 { status: "ok" } when reachable, 503 otherwise. It is
 * excluded from auth in the proxy matcher and leaks no data.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
