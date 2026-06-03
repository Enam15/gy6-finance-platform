import { AccountService } from "@/services/account-service";
import { IncomeService } from "@/services/income-service";
import { TransactionCategoryService } from "@/services/transaction-category-service";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { toXlsx, XLSX_MIME, type XlsxColumn } from "@/lib/xlsx";
import { formatMoney, money } from "@/lib/money";

/**
 * Income list export (CSV or XLSX). Every income entry with its account
 * name, category name, total / paid / due in money columns, dates, state
 * and computed status. No filtering - exports the full set. Newest first
 * (matches the page view).
 */

interface XlsxRow extends Record<string, unknown> {
  description: string;
  account: string;
  category: string;
  total: number;
  paid: number;
  due: number;
  entryDate: Date;
  paymentDueOn: Date;
  state: string;
  status: string;
}

interface CsvRow extends Record<string, unknown> {
  description: string;
  account: string;
  category: string;
  total: string;
  paid: string;
  due: string;
  entryDate: string;
  paymentDueOn: string;
  state: string;
  status: string;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

  const [entries, accounts, categories] = await Promise.all([
    new IncomeService().listEntries(),
    new AccountService().listAccounts(),
    new TransactionCategoryService().listAll(),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const rows: XlsxRow[] = entries.map((e) => ({
      description: e.description,
      account: accountName.get(e.clientAccountId) ?? "Unknown",
      category: categoryName.get(e.categoryId) ?? "Unknown",
      total: Number(e.totalAmount) / 100,
      paid: Number(e.amountPaid) / 100,
      due: Number(e.amountDue) / 100,
      entryDate: e.entryDate,
      paymentDueOn: e.paymentDueOn,
      state: e.state,
      status: e.status,
    }));
    const columns: XlsxColumn<XlsxRow>[] = [
      { key: "description", label: "Description", width: 40 },
      { key: "account", label: "Client account", width: 25 },
      { key: "category", label: "Category", width: 20 },
      { key: "total", label: "Total", width: 14, numFmt: "#,##0.00" },
      { key: "paid", label: "Paid", width: 14, numFmt: "#,##0.00" },
      { key: "due", label: "Due", width: 14, numFmt: "#,##0.00" },
      { key: "entryDate", label: "Entry date", width: 12, numFmt: "yyyy-mm-dd" },
      { key: "paymentDueOn", label: "Payment due", width: 12, numFmt: "yyyy-mm-dd" },
      { key: "state", label: "State", width: 12 },
      { key: "status", label: "Status", width: 22 },
    ];
    const buffer = await toXlsx("Income", columns, rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": XLSX_MIME,
        "content-disposition": `attachment; filename="gy6-income-${stamp}.xlsx"`,
      },
    });
  }

  const rows: CsvRow[] = entries.map((e) => ({
    description: e.description,
    account: accountName.get(e.clientAccountId) ?? "Unknown",
    category: categoryName.get(e.categoryId) ?? "Unknown",
    total: formatMoney(money(e.totalAmount)),
    paid: formatMoney(money(e.amountPaid)),
    due: formatMoney(money(e.amountDue)),
    entryDate: e.entryDate.toISOString().slice(0, 10),
    paymentDueOn: e.paymentDueOn.toISOString().slice(0, 10),
    state: e.state,
    status: e.status,
  }));
  const columns: CsvColumn<CsvRow>[] = [
    { key: "description", label: "Description" },
    { key: "account", label: "Client account" },
    { key: "category", label: "Category" },
    { key: "total", label: "Total" },
    { key: "paid", label: "Paid" },
    { key: "due", label: "Due" },
    { key: "entryDate", label: "Entry date" },
    { key: "paymentDueOn", label: "Payment due" },
    { key: "state", label: "State" },
    { key: "status", label: "Status" },
  ];
  const csv = toCsv(columns, rows);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gy6-income-${stamp}.csv"`,
    },
  });
}
