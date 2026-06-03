import { AccountService } from "@/services/account-service";
import { StatementEntryService } from "@/services/statement-entry-service";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { toXlsx, XLSX_MIME, type XlsxColumn } from "@/lib/xlsx";
import { formatMoney, money } from "@/lib/money";

/**
 * Per-account statement export. Chronological order (oldest first); each
 * row shows the posting plus a running balance folded from 0n forward.
 * The sign of the delta is chosen by which side of the posting this
 * account is on AND its normal balance:
 *
 *   debit-normal  + DR side   ->  +amount
 *   debit-normal  + CR side   ->  -amount
 *   credit-normal + DR side   ->  -amount
 *   credit-normal + CR side   ->  +amount
 *
 * The final running balance equals account.balance (sanity-checked at the
 * end - mismatch logged but does not block the response).
 */

interface XlsxRow extends Record<string, unknown> {
  date: Date;
  description: string;
  counterparty: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}

interface CsvRow extends Record<string, unknown> {
  date: string;
  description: string;
  counterparty: string;
  debit: string;
  credit: string;
  balance: string;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "account";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const { id } = await context.params;

  const accountService = new AccountService();
  const accountResult = await accountService.getAccount(id);
  if (!accountResult.ok) {
    return new Response(JSON.stringify({ error: accountResult.error }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  const account = accountResult.value;
  const isDebitNormal = account.normalBalance === "DEBIT";

  const [entries, allAccounts] = await Promise.all([
    new StatementEntryService().listAllByAccount(id, "asc"),
    accountService.listAccounts(),
  ]);
  const nameById = new Map(allAccounts.map((a) => [a.id, a.name]));

  const stamp = new Date().toISOString().slice(0, 10);
  const fileBase = `gy6-statement-${slug(account.name)}-${stamp}`;
  const sheetName = account.name.slice(0, 30) || "Account";

  if (format === "xlsx") {
    let running = 0n;
    const rows: XlsxRow[] = entries.map((e) => {
      const onDebit = e.debitAccountId === account.id;
      const delta = isDebitNormal
        ? onDebit
          ? e.amount
          : -e.amount
        : onDebit
          ? -e.amount
          : e.amount;
      running += delta;
      const counterpartyId = onDebit ? e.creditAccountId : e.debitAccountId;
      return {
        date: e.effectiveDate,
        description: e.description,
        counterparty: nameById.get(counterpartyId) ?? "Unknown",
        debit: onDebit ? Number(e.amount) / 100 : null,
        credit: onDebit ? null : Number(e.amount) / 100,
        balance: Number(running) / 100,
      };
    });

    if (running !== account.balance) {
      console.warn(
        `[account-export] running balance ${running} != stored ${account.balance} for account ${account.id}`,
      );
    }

    const columns: XlsxColumn<XlsxRow>[] = [
      { key: "date", label: "Date", width: 12, numFmt: "yyyy-mm-dd" },
      { key: "description", label: "Description", width: 44 },
      { key: "counterparty", label: "Counterparty", width: 25 },
      { key: "debit", label: "Debit", width: 14, numFmt: "#,##0.00" },
      { key: "credit", label: "Credit", width: 14, numFmt: "#,##0.00" },
      { key: "balance", label: "Balance", width: 16, numFmt: "#,##0.00" },
    ];
    const buffer = await toXlsx(sheetName, columns, rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": XLSX_MIME,
        "content-disposition": `attachment; filename="${fileBase}.xlsx"`,
      },
    });
  }

  // CSV default
  let running = 0n;
  const rows: CsvRow[] = entries.map((e) => {
    const onDebit = e.debitAccountId === account.id;
    const delta = isDebitNormal
      ? onDebit
        ? e.amount
        : -e.amount
      : onDebit
        ? -e.amount
        : e.amount;
    running += delta;
    const counterpartyId = onDebit ? e.creditAccountId : e.debitAccountId;
    return {
      date: e.effectiveDate.toISOString().slice(0, 10),
      description: e.description,
      counterparty: nameById.get(counterpartyId) ?? "Unknown",
      debit: onDebit ? formatMoney(money(e.amount)) : "",
      credit: onDebit ? "" : formatMoney(money(e.amount)),
      balance: formatMoney(money(running)),
    };
  });

  if (running !== account.balance) {
    console.warn(
      `[account-export] running balance ${running} != stored ${account.balance} for account ${account.id}`,
    );
  }

  const columns: CsvColumn<CsvRow>[] = [
    { key: "date", label: "Date" },
    { key: "description", label: "Description" },
    { key: "counterparty", label: "Counterparty" },
    { key: "debit", label: "Debit" },
    { key: "credit", label: "Credit" },
    { key: "balance", label: "Balance" },
  ];
  const csv = toCsv(columns, rows);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileBase}.csv"`,
    },
  });
}
