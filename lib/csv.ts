/**
 * CSV serialisation helpers for the export routes. Generates RFC 4180-style
 * output: comma separators, CRLF line endings (Excel's expected format),
 * and double-quote escaping for fields containing commas, quotes, or
 * newlines. ASCII-only - no BOM.
 */

/**
 * Escape a single field for CSV. Quotes the field if it contains a comma,
 * quote, CR, or LF; doubles any internal quote characters. null/undefined
 * become empty strings. Date is rendered as ISO 8601. Number / BigInt /
 * boolean stringify via String(). Anything else falls back to String().
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else {
    s = String(value);
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** A single column in a CSV export. */
export interface CsvColumn<T> {
  /** Property name on the row object. */
  key: keyof T & string;
  /** Header label printed in the first row. */
  label: string;
}

/**
 * Build a CSV string from a header spec + an array of row objects. Column
 * order follows the `columns` array; each row is read by key. Trailing
 * CRLF is included so the file ends on a newline.
 */
export function toCsv<T extends Record<string, unknown>>(
  columns: CsvColumn<T>[],
  rows: T[],
): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCsvField(c.label)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(row[c.key])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
