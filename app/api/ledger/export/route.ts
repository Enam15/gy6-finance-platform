import { AccountService } from "@/services/account-service";
import { StatementEntryService } from "@/services/statement-entry-service";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { toXlsx, XLSX_MIME, type XlsxColumn } from "@/lib/xlsx";
import { formatMoney, money } from "@/lib/money";

/**
 * Export the full ledger as CSV or XLSX. Chronological order (oldest first)
 * so the export reads like a real journal. No limit - every posting is
 * included. Money columns: major-unit numbers in XLSX (with numFmt),
 * pre-formatted strings in CSV (Excel will still total them via SUM since
 * the values are numeric strings, but the comma separators may need an
 * import wizard - this is the price of having a human-readable CSV).
 */

interface XlsxLedgerRow extends Record<string, unknown> {
  date: Date;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  type: string;
  source: string;
}

interface CsvLedgerRow extends Record<string, unknown> {
  date: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: string;
  type: string;
  source: string;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

  const [entries, accounts] = await Promise.all([
    new StatementEntryService().listAll("asc"),
    new AccountService().listAccounts(),
  ]);
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const rows: XlsxLedgerRow[] = entries.map((e) => ({
      date: e.effectiveDate,
      description: e.description,
      debitAccount: nameById.get(e.debitAccountId) ?? "Unknown",
      creditAccount: nameById.get(e.creditAccountId) ?? "Unknown",
      amount: Number(e.amount) / 100,
      type: e.entryType,
      source: e.sourceType,
    }));
    const columns: XlsxColumn<XlsxLedgerRow>[] = [
      { key: "date", label: "Date", width: 12, numFmt: "yyyy-mm-dd" },
      { key: "description", label: "Description", width: 48 },
      { key: "debitAccount", label: "Debit account", width: 25 },
      { key: "creditAccount", label: "Credit account", width: 25 },
      { key: "amount", label: "Amount", width: 16, numFmt: "#,##0.00" },
      { key: "type", label: "Type", width: 14 },
      { key: "source", label: "Source", width: 22 },
    ];
    const buffer = await toXlsx("Ledger", columns, rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": XLSX_MIME,
        "content-disposition": `attachment; filename="gy6-ledger-${stamp}.xlsx"`,
      },
    });
  }

  const rows: CsvLedgerRow[] = entries.map((e) => ({
    date: e.effectiveDate.toISOString().slice(0, 10),
    description: e.description,
    debitAccount: nameById.get(e.debitAccountId) ?? "Unknown",
    creditAccount: nameById.get(e.creditAccountId) ?? "Unknown",
    amount: formatMoney(money(e.amount)),
    type: e.entryType,
    source: e.sourceType,
  }));
  const columns: CsvColumn<CsvLedgerRow>[] = [
    { key: "date", label: "Date" },
    { key: "description", label: "Description" },
    { key: "debitAccount", label: "Debit account" },
    { key: "creditAccount", label: "Credit account" },
    { key: "amount", label: "Amount" },
    { key: "type", label: "Type" },
    { key: "source", label: "Source" },
  ];
  const csv = toCsv(columns, rows);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gy6-ledger-${stamp}.csv"`,
    },
  });
}
