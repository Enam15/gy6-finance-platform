/**
 * A Result is either a success carrying a value or a failure carrying an
 * error. Services return `Result` so callers must handle both outcomes
 * explicitly, rather than relying on thrown exceptions for expected failures.
 */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Build a success result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Build a failure result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
