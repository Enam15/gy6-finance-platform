import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AccountService } from "@/services/account-service";
import { StatementEntryService } from "@/services/statement-entry-service";
import { IncomeService } from "@/services/income-service";
import { ExpenseService } from "@/services/expense-service";
import { TransactionCategoryService } from "@/services/transaction-category-service";
import { formatMoney, money } from "@/lib/money";
import type { StatementEntryType } from "@/lib/generated/prisma/client";
import { ExportLinks } from "@/components/export-links";
import { ListSelectFilter } from "@/app/_components/list-select-filter";

export const dynamic = "force-dynamic";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function entryTypeBadgeVariant(type: StatementEntryType): BadgeVariant {
  switch (type) {
    case "INCOME":
    case "EXPENSE":
      return "default";
    case "PAYMENT":
    case "DISTRIBUTION":
      return "secondary";
    case "TRANSFER":
    case "ADJUSTMENT":
    case "OPENING_BALANCE":
      return "outline";
    case "REVERSAL":
      return "destructive";
  }
}

function entryTypeLabel(type: string): string {
  const lower = type.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Account lookup needs ALL accounts (including the hidden system
  // accounts - Revenue, Expense, Adjustments, Opening Balances - which
  // appear in postings but are filtered out of the /accounts list).
  const [entries, accounts, incomeEntries, expenseEntries, categories] =
    await Promise.all([
      new StatementEntryService().listRecent(100),
      new AccountService().listAccounts(),
      new IncomeService().listEntries(),
      new ExpenseService().listEntries(),
      new TransactionCategoryService().listAll(),
    ]);

  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  // Map each income/expense entry id -> its category name, so a ledger
  // posting sourced from one can show which category it belongs to.
  const categoryBySourceId = new Map<string, string>();
  for (const e of incomeEntries) {
    const name = categoryNameById.get(e.categoryId);
    if (name) categoryBySourceId.set(e.id, name);
  }
  for (const e of expenseEntries) {
    const name = categoryNameById.get(e.categoryId);
    if (name) categoryBySourceId.set(e.id, name);
  }

  const sp = await searchParams;
  const typeFilter = typeof sp.type === "string" ? sp.type : "";
  const categoryFilter = typeof sp.category === "string" ? sp.category : "";
  const visibleEntries = entries.filter((e) => {
    if (typeFilter && e.entryType !== typeFilter) return false;
    if (
      categoryFilter &&
      (categoryBySourceId.get(e.sourceId) ?? "") !== categoryFilter
    ) {
      return false;
    }
    return true;
  });

  const typeOptions = Array.from(new Set(entries.map((e) => e.entryType))).map(
    (t) => ({ value: t, label: entryTypeLabel(t) }),
  );
  const categoryOptions = Array.from(new Set([...categoryBySourceId.values()]))
    .sort()
    .map((n) => ({ value: n, label: n }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
          <p className="text-sm text-muted-foreground">
            Immutable double-entry ledger. Every posting recorded here is
            permanent - corrections happen by reversing or adjusting, never
            by editing.
          </p>
        </div>
        <ExportLinks basePath="/api/ledger/export" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>Recent entries ({visibleEntries.length})</CardTitle>
              <CardDescription>
                Showing the 100 most recent postings, newest first by effective
                date.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ListSelectFilter
                paramKey="type"
                label="Type"
                value={typeFilter}
                options={typeOptions}
                allLabel="All types"
              />
              {categoryOptions.length > 0 && (
                <ListSelectFilter
                  paramKey="category"
                  label="Category"
                  value={categoryFilter}
                  options={categoryOptions}
                  allLabel="All categories"
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No ledger entries yet. Confirm an income or expense, run a
              transfer, or post a balance adjustment to populate the ledger.
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No entries match these filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Debit (DR)</TableHead>
                  <TableHead>Credit (CR)</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(entry.effectiveDate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {categoryBySourceId.get(entry.sourceId) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {accountNameById.get(entry.debitAccountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      {accountNameById.get(entry.creditAccountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(entry.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entryTypeBadgeVariant(entry.entryType)}>
                        {entry.entryType}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
