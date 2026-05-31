/**
 * JSON helpers for API routes. Accounting amounts use BigInt (`Money`), which
 * `JSON.stringify` cannot serialise out of the box; we convert any BigInt to
 * its decimal-string form so the wire representation is lossless and the
 * client can decide whether to parse it with `BigInt` or display as text.
 */

/** A `JSON.stringify` replacer that turns BigInt values into strings. */
export function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/**
 * Build a JSON `Response` for a Next.js Route Handler with BigInt support.
 * Sets `content-type: application/json; charset=utf-8` by default.
 */
export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data, jsonReplacer), {
    status: init?.status,
    statusText: init?.statusText,
    headers,
  });
}
