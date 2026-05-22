import { z } from "zod";
import { ValidationError } from "./errors";

/**
 * Parse `data` against a Zod schema, returning the typed value or throwing a
 * ValidationError with a readable message. Use at every service boundary -
 * input arriving from the client or an API route is never trusted.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  data: unknown,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const message = result.error.issues
    .map((issue) => {
      const path = issue.path.map((segment) => String(segment)).join(".");
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");

  throw new ValidationError(message);
}
