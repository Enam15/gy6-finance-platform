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
import { IncomeService } from "@/services/income-service";
import { TransactionCategoryService } from "@/services/transaction-category-service";
import { formatMoney, money } from "@/lib/money";
import { feeMethodLabel, bpsToPercent } from "@/lib/fees";
import type { EntryStatus } from "@/lib/entry-status";
import type { EntryState } from "@/lib/generated/prisma/client";
import { CreateIncomeDialog } from "./_components/create-income-dialog";
import { ConfirmIncomeButton } from "./_components/confirm-button";
import { FullyPaidButton } from "@/components/fully-paid-button";
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

export default async function IncomePage() {
  const incomeService = new IncomeService();
  const accountService = new AccountService();
  const categoryService = new TransactionCategoryService();

  const [entries, accounts, incomeCategories, businessAccounts] =
    await Promise.all([
      incomeService.listEntries(),
      accountService.listVisible(),
      categoryService.listByKind("INCOME"),
      accountService.listBusinessAccounts(),
    ]);

  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryNameById = new Map(
    incomeCategories.map((c) => [c.id, c.name]),
  );
  const businessAccountOptions = businessAccounts.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const canCreate = accounts.length > 0 && incomeCategories.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
          <p className="text-sm text-muted-foreground">
            Drafts do not move the ledger; confirming posts double-entry
            (debit the source account, credit Revenue). Payments are
            separate postings that reduce amount_due.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canCreate ? (
            <CreateIncomeDialog
              accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
              categories={incomeCategories.map((c) => ({
                id: c.id,
                name: c.name,
              }))}
            />
          ) : (
            <span className="max-w-xs text-right text-sm text-muted-foreground">
              Create at least one account and one income category to record
              income.
            </span>
          )}
          <ExportLinks basePath="/api/income/export" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All income entries ({entries.length})</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No income recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Debit (DR)</TableHead>
                  <TableHead>Credit (CR)</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
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
                      {accountNameById.get(entry.clientAccountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell>Revenue</TableCell>
                    <TableCell>
                      {categoryNameById.get(entry.categoryId) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(entry.totalAmount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.feeAmount && entry.feeAmount > 0n ? (
                        <div className="leading-tight">
                          <div>{formatMoney(money(entry.feeAmount))}</div>
                          <div className="text-xs text-muted-foreground">
                            {feeMethodLabel(entry.feeMethod ?? "")}
                            {entry.feeBps
                              ? ` ${bpsToPercent(entry.feeBps)}%`
                              : ""}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                          <ConfirmIncomeButton
                            entryId={entry.id}
                            description={entry.description}
                          />
                        )}
                        {entry.state === "CONFIRMED" &&
                          entry.amountDue > 0n && (
                            <FullyPaidButton
                              kind="income"
                              entryId={entry.id}
                              description={entry.description}
                              amountDueMinor={entry.amountDue.toString()}
                              businessAccounts={businessAccountOptions}
                            />
                          )}
                        {entry.state === "CONFIRMED" &&
                          entry.amountDue === 0n && (
                            <Badge variant="secondary">Fully paid</Badge>
                          )}
                        {entry.state === "CONFIRMED" &&
                          entry.amountPaid === 0n && (
                            <ReverseButton
                              apiPath={`/api/income/${entry.id}/reverse`}
                              what="Income"
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
