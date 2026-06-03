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
import { ExpenseService } from "@/services/expense-service";
import { TransactionCategoryService } from "@/services/transaction-category-service";
import { formatMoney, money } from "@/lib/money";
import type { EntryStatus } from "@/lib/entry-status";
import type { EntryState } from "@/lib/generated/prisma/client";
import { CreateExpenseDialog } from "./_components/create-expense-dialog";
import { ConfirmExpenseButton } from "./_components/confirm-button";
import { PayExpenseButton } from "./_components/pay-expense-button";
import { ReverseButton } from "@/components/reverse-button";
import { ExportLinks } from "@/components/export-links";

export const dynamic = "force-dynamic";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function stateBadgeVariant(state: EntryState): BadgeVariant {
  switch (state) {
    case "DRAFT":
      return "outline";
    case "CONFIRMED":
      return "default";
    case "REVERSED":
      return "destructive";
  }
}

function statusBadgeVariant(status: EntryStatus): BadgeVariant {
  switch (status) {
    case "NO_ACTION_REQUIRED":
      return "secondary";
    case "PAYMENT_APPROACHING":
      return "outline";
    case "PAYMENT_NEEDED":
      return "destructive";
  }
}

export default async function ExpensesPage() {
  const expenseService = new ExpenseService();
  const accountService = new AccountService();
  const categoryService = new TransactionCategoryService();

  const [entries, accounts, expenseCategories, businessAccounts] =
    await Promise.all([
      expenseService.listEntries(),
      accountService.listVisible(),
      categoryService.listByKind("EXPENSE"),
      accountService.listBusinessAccounts(),
    ]);

  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryNameById = new Map(
    expenseCategories.map((c) => [c.id, c.name]),
  );
  const businessAccountOptions = businessAccounts.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const canCreate = accounts.length > 0 && expenseCategories.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Drafts do not move the ledger; confirming posts double-entry
            (debit Expense, credit the payee account). Payments are
            separate postings that reduce amount_due.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canCreate ? (
            <CreateExpenseDialog
              accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
              categories={expenseCategories.map((c) => ({
                id: c.id,
                name: c.name,
              }))}
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
          <CardTitle>All expense entries ({entries.length})</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No expenses recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Payee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Payment due</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.description}
                    </TableCell>
                    <TableCell>
                      {accountNameById.get(entry.payeeAccountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      {categoryNameById.get(entry.categoryId) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(entry.totalAmount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(entry.amountDue))}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(entry.entryDate)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(entry.paymentDueOn)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stateBadgeVariant(entry.state)}>
                        {entry.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(entry.status)}>
                        {entry.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {entry.state === "DRAFT" && (
                          <ConfirmExpenseButton
                            entryId={entry.id}
                            description={entry.description}
                          />
                        )}
                        {entry.state === "CONFIRMED" &&
                          entry.amountDue > 0n && (
                            <PayExpenseButton
                              entryId={entry.id}
                              description={entry.description}
                              amountDueMinor={entry.amountDue.toString()}
                              businessAccounts={businessAccountOptions}
                            />
                          )}
                        {entry.state === "CONFIRMED" &&
                          entry.amountPaid === 0n && (
                            <ReverseButton
                              apiPath={`/api/expenses/${entry.id}/reverse`}
                              what="Expense"
                              description={entry.description}
                            />
                          )}
                      </div>
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
