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
import type { StatementEntryType } from "@/lib/generated/prisma/client";

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

  // Run the detail bundle, the per-account ledger, and the full account list
  // (for counterparty name lookups - includes hidden system accounts) in
  // parallel.
  const [detailResult, entries, accounts] = await Promise.all([
    accountService.getDetail(id),
    statementService.listByAccount(id, 100),
    accountService.listAccounts(),
  ]);

  if (!detailResult.ok) notFound();
  const { account, category, outstandingIncome, outstandingExpense } =
    detailResult.value;

  const nameById = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
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
            <CardDescription>Outstanding income</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(money(outstandingIncome))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sum of amount_due across confirmed income entries against this
            account.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Outstanding expense</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatMoney(money(outstandingExpense))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sum of amount_due across confirmed expense entries against this
            account.
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
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="tabular-nums">
                        {formatDate(entry.effectiveDate)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isDebit ? "default" : "secondary"}>
                          {isDebit ? "DR" : "CR"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {nameById.get(counterpartyId) ?? "Unknown"}
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
