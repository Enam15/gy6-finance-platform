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
    url: process.env["DATABASE_URL"],
  },
});
