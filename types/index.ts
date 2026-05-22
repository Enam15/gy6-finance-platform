/**
 * Shared domain types and primitives, re-exported behind the `@/types` path.
 */
export type { Money } from "@/lib/money";
export type { Result } from "@/lib/result";
export {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InvariantViolationError,
} from "@/lib/errors";
