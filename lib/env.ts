import { z } from "zod";

/**
 * Validated server-side environment variables.
 *
 * Import only from server code (services, route handlers, scripts) - never
 * from client components. Validation runs once at module load so a missing or
 * malformed variable fails fast instead of surfacing later as a runtime bug.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.issues);
  throw new Error("Invalid environment variables. Check your .env file.");
}

export const env = parsed.data;
