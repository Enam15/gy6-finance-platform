import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AccountService } from "@/services/account-service";
import { ExpenseService } from "@/services/expense-service";
import { TransactionCategoryService } from "@/services/transaction-category-service";
import { CreateExpenseDialog } from "./_components/create-expense-dialog";
import { ExportLinks } from "@/components/export-links";
import { ListSelectFilter } from "@/app/_components/list-select-filter";
import { AttachmentService } from "@/services/attachment-service";
import { RenewalService } from "@/services/renewal-service";
import { getActor } from "@/lib/auth";
import { EntriesTable } from "@/components/entries-table";
import type { SerializedEntry } from "@/lib/entry-form";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const expenseService = new ExpenseService();
  const accountService = new AccountService();
  const categoryService = new TransactionCategoryService();

  // Recurring entries are set up from the create dialog and materialise as
  // drafts here: opening the tab catches up any that have come due (safe /
  // idempotent - each template is locked and its next run advanced).
  const actor = await getActor();
  await new RenewalService().generateDue({
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? null,
  });

  const [entries, accounts, expenseCategories, businessAccounts, attachmentCounts] =
    await Promise.all([
      expenseService.listEntries(),
      accountService.listVisible(),
      categoryService.listByKind("EXPENSE"),
      accountService.listBusinessAccounts(),
      new AttachmentService().countsByExpense(),
    ]);

  const sp = await searchParams;
  const categoryFilter = typeof sp.category === "string" ? sp.category : "";
  const visibleEntries = categoryFilter
    ? entries.filter((e) => e.categoryId === categoryFilter)
    : entries;

  const accountNameById = Object.fromEntries(
    accounts.map((a) => [a.id, a.name]),
  );
  const categoryNameById = Object.fromEntries(
    expenseCategories.map((c) => [c.id, c.name]),
  );
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));
  const categoryOptions = expenseCategories.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const businessAccountOptions = businessAccounts.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const rows: SerializedEntry[] = visibleEntries.map((entry) => ({
    id: entry.id,
    accountId: entry.payeeAccountId,
    categoryId: entry.categoryId,
    description: entry.description,
    totalAmount: entry.totalAmount.toString(),
    amountPaid: entry.amountPaid.toString(),
    amountDue: entry.amountDue.toString(),
    entryDate: formatDate(entry.entryDate),
    paymentDueOn: formatDate(entry.paymentDueOn),
    state: entry.state,
    status: entry.status,
    feeMethod: entry.feeMethod,
    feeLabel: entry.feeLabel,
    feeBps: entry.feeBps,
    feeAmount: entry.feeAmount?.toString() ?? null,
    notes: entry.notes,
    createdAt: entry.createdAt.toISOString(),
  }));

  const attachmentCountsObj = Object.fromEntries(attachmentCounts);
  const canCreate = accounts.length > 0 && expenseCategories.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Drafts do not move the ledger; confirming posts double-entry (money
            out to the payee, recognised as an Expense). Click a row to see
            notes and details.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canCreate ? (
            <CreateExpenseDialog
              accounts={accountOptions}
              categories={categoryOptions}
            />
          ) : (
            <span className="max-w-xs text-right text-sm text-muted-foreground">
              Create at least one account and one expense category to record
              expenses.
            </span>
          )}
          <ExportLinks basePath="/api/expenses/export" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>
                All expense entries ({visibleEntries.length})
              </CardTitle>
              <CardDescription>Newest first.</CardDescription>
            </div>
            {expenseCategories.length > 0 && (
              <ListSelectFilter
                paramKey="category"
                label="Category"
                value={categoryFilter}
                options={expenseCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                allLabel="All categories"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {visibleEntries.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              {categoryFilter
                ? "No expenses in this category."
                : "No expenses recorded yet."}
            </div>
          ) : (
            <EntriesTable
              kind="expense"
              rows={rows}
              accountNameById={accountNameById}
              categoryNameById={categoryNameById}
              accounts={accountOptions}
              categories={categoryOptions}
              businessAccounts={businessAccountOptions}
              attachmentCounts={attachmentCountsObj}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
