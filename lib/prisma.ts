import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";
import { PrismaClient } from "./generated/prisma/client";

/**
 * A Prisma client capable of model queries - either the base client or a
 * transaction-scoped client. Repositories accept this type so the same code
 * runs whether or not it is inside a database transaction.
 */
export type DbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Prisma client singleton.
 *
 * Prisma 7 connects through a driver adapter rather than a schema-level URL.
 * The connection string comes from the validated env module. A global
 * singleton prevents connection-pool exhaustion across Next.js hot reloads
 * in development.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
