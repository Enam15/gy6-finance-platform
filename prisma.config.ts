import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the migration / CLI connection string from here (the schema
// datasource no longer carries `url`). dotenv loads .env because the Prisma
// CLI does not load .env files automatically. The runtime client connects
// through a driver adapter instead - see lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations must use the DIRECT (unpooled) connection - poolers break
    // the advisory locks DDL relies on. Falls back to DATABASE_URL locally,
    // where the two are the same.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
