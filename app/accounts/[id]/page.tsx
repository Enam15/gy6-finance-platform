import Link from "next/link";
import { notFound } from "next/navigation";
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
import { formatMoney, money } from "@/lib/money";
import {
  customFieldValues,
  parseCustomFields,
  parseCustomValues,
} from "@/lib/account-fields";
import { cn } from "@/lib/utils";
import type { StatementEntryType } from "@/lib/generated/prisma/client";
import { ExportLinks } from "@/components/export-links";
import { AdjustBalanceButton } from "./_components/adjust-balance-button";
import { AccountAdjustToggle } from "./_components/account-adjust-toggle";
import { EditAccountDialog } from "./_components/edit-account-dialog";

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: PageProps) {
  const { id } = await params;

  const accountService = new AccountService();
  const statementService = new StatementEntryService();

  // Run the detail bundle, the per-account ledger, the full account list (for
  // counterparty name lookups - includes hidden system accounts) and the
  // categories the edit dialog can re-file into, in parallel.
  const [detailResult, entries, accounts, selectableCategories] =
    await Promise.all([
      accountService.getDetail(id),
      statementService.listByAccount(id, 100),
      accountService.listAccounts(),
      accountService.listSelectableCategories(),
    ]);

  if (!detailResult.ok) notFound();
  const { account, category, outstandingIncome, outstandingExpense } =
    detailResult.value;

  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const customFields = customFieldValues(
    category.customFields,
    account.customValues,
  );
  // Postings a reversal has cancelled - kept on the record, shown struck through.
  const reversedIds = new Set(
    await statementService.reversedIdsAmong(entries.map((e) => e.id)),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/accounts"
            className="text-sm text-muted-foreground hover:underline"
          >
            &larr; Back to accounts
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {account.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {category.name} account
            {account.description ? ` - ${account.description}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <EditAccountDialog
              accountId={id}
              name={account.name}
              description={account.description ?? ""}
              categoryId={account.categoryId}
              allowNegative={account.allowNegative}
              values={parseCustomValues(account.customValues)}
              categories={selectableCategories.map((c) => ({
                id: c.id,
                name: c.name,
                fields: parseCustomFields(c.customFields),
              }))}
            />
            {account.allowBalanceAdjust && (
              <AdjustBalanceButton
                accountId={id}
                accountName={account.name}
                currentBalanceMinor={account.balance.toString()}
              />
            )}
          </div>
          <AccountAdjustToggle
            accountId={id}
            isOn={account.allowBalanceAdjust}
          />
          <ExportLinks basePath={`/api/accounts/${id}/export`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Current balance</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(money(account.balance))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                account.normalBalance === "DEBIT" ? "default" : "secondary"
              }
            >
              {account.normalBalance}-normal
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Money owed to you</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(money(outstandingIncome))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Confirmed income from this account that hasn&apos;t been paid yet.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Money you owe</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(money(outstandingExpense))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Confirmed expense to this account that hasn&apos;t been paid yet.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Allow negative balance</CardDescription>
            <CardTitle className="text-2xl">
              {account.allowNegative ? "Yes" : "No"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Whether the posting engine permits this balance to drop below
            zero.
          </CardContent>
        </Card>
      </div>

      {customFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Custom fields for this {category.name} account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {customFields.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="text-sm">{f.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ledger entries ({entries.length})</CardTitle>
          <CardDescription>
            Most recent 100 postings touching this account (DR or CR side),
            newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No postings recorded yet for this account.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const isDebit = entry.debitAccountId === id;
                  const counterpartyId = isDebit
                    ? entry.creditAccountId
                    : entry.debitAccountId;
                  const wasReversed = reversedIds.has(entry.id);
                  const cancelled =
                    wasReversed || entry.entryType === "REVERSAL";
                  return (
                    <TableRow
                      key={entry.id}
                      className={cn(cancelled && "opacity-60")}
                    >
                      <TableCell className="tabular-nums">
                        {formatDate(entry.effectiveDate)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium",
                          cancelled && "line-through",
                        )}
                      >
                        {entry.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isDebit ? "default" : "secondary"}>
                          {isDebit ? "DR" : "CR"}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(cancelled && "line-through")}>
                        {nameById.get(counterpartyId) ?? "Unknown"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          cancelled && "line-through",
                        )}
                      >
                        {formatMoney(money(entry.amount))}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={entryTypeBadgeVariant(entry.entryType)}
                          >
                            {entry.entryType}
                          </Badge>
                          {wasReversed && (
                            <Badge variant="outline">Reversed</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
