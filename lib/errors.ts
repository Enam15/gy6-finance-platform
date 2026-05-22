/**
 * Domain error hierarchy. Application code throws these for expected,
 * meaningful failure conditions; each carries a stable `code` for handling
 * and structured logging.
 */
export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

/** Input failed validation. Client input is never trusted. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super("VALIDATION", message);
    this.name = "ValidationError";
  }
}

/** A requested record does not exist. */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

/** The operation conflicts with current state (e.g. a duplicate confirmation). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message);
    this.name = "ConflictError";
  }
}

/** The operation would violate an accounting invariant and was refused. */
export class InvariantViolationError extends AppError {
  constructor(message: string) {
    super("INVARIANT_VIOLATION", message);
    this.name = "InvariantViolationError";
  }
}
