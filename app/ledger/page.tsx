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
import { ExportLinks } from "@/components/export-links";

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

export default async function LedgerPage() {
  // Account lookup needs ALL accounts (including the hidden system
  // accounts - Revenue, Expense, Adjustments, Opening Balances - which
  // appear in postings but are filtered out of the /accounts list).
  const [entries, accounts] = await Promise.all([
    new StatementEntryService().listRecent(100),
    new AccountService().listAccounts(),
  ]);

  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

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
          <CardTitle>Recent entries ({entries.length})</CardTitle>
          <CardDescription>
            Showing the 100 most recent postings, newest first by effective
            date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No ledger entries yet. Confirm an income or expense, run a
              transfer, or post a balance adjustment to populate the ledger.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Debit (DR)</TableHead>
                  <TableHead>Credit (CR)</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(entry.effectiveDate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.description}
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
