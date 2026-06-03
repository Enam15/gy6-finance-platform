import ExcelJS from "exceljs";

/** A single column in an XLSX export. */
export interface XlsxColumn<T> {
  /** Property name on the row object. */
  key: keyof T & string;
  /** Header label (printed bold in row 1). */
  label: string;
  /** Column width in characters. Defaults to max(label.length + 2, 12). */
  width?: number;
  /**
   * Excel number format string, e.g. "#,##0.00" for money or "yyyy-mm-dd"
   * for dates. Applied to every cell in this column except the header.
   */
  numFmt?: string;
}

/**
 * Build a single-sheet XLSX workbook from a column spec + row objects.
 * Returns the binary buffer ready for an HTTP response.
 *
 * Conventions:
 *   - Money columns: rows should carry **major-unit Numbers** (e.g. 1234.56,
 *     not the minor-unit BigInt 123456n) and the column should set
 *     `numFmt: "#,##0.00"`. Excel handles the locale formatting.
 *   - Date columns: rows carry JS Date; column sets `numFmt: "yyyy-mm-dd"`
 *     (or any Excel-recognised format string).
 *   - Everything else (strings, plain numbers, booleans) renders as-is.
 *
 * Row 1 is bold. No frozen panes, autofilter, or styling beyond that -
 * keep the output portable.
 */
export async function toXlsx<T extends Record<string, unknown>>(
  sheetName: string,
  columns: XlsxColumn<T>[],
  rows: T[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GY6 Finance";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width ?? Math.max(c.label.length + 2, 12),
    style: c.numFmt ? { numFmt: c.numFmt } : {},
  }));

  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.getRow(1).font = { bold: true };

  // writeBuffer returns ExcelJS.Buffer which is `Buffer | ArrayBuffer` in
  // its declared types; in Node it is always a Buffer. Defensive convert.
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(raw)
    ? raw
    : Buffer.from(raw as ArrayBuffer);
}

/**
 * Standard XLSX MIME type for HTTP responses.
 */
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
