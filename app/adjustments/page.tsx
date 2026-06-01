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
import { AccountService } from "@/services/account-service";
import { BalanceAdjustmentService } from "@/services/balance-adjustment-service";
import { formatMoney, money } from "@/lib/money";
import { CreateAdjustmentDialog } from "./_components/create-adjustment-dialog";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function AdjustmentsPage() {
  const adjustmentService = new BalanceAdjustmentService();
  const accountService = new AccountService();

  const [adjustments, visibleAccounts] = await Promise.all([
    adjustmentService.listAll(),
    accountService.listVisible(),
  ]);

  // Account lookup for displaying names in the history; the dialog needs
  // the full visible-account list with balances so it can show the user
  // what they're adjusting from.
  const accountNameById = new Map(
    visibleAccounts.map((a) => [a.id, a.name]),
  );
  const accountOptions = visibleAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    balanceMinor: a.balance.toString(),
  }));

  const canCreate = visibleAccounts.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Balance adjustments
          </h1>
          <p className="text-sm text-muted-foreground">
            Manual corrections to an account&apos;s balance. The difference
            is posted through the ledger against the internal Adjustments
            account, so the books stay balanced.
          </p>
        </div>
        {canCreate ? (
          <CreateAdjustmentDialog accounts={accountOptions} />
        ) : (
          <span className="max-w-xs text-right text-sm text-muted-foreground">
            Create at least one account to record an adjustment.
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All adjustments ({adjustments.length})</CardTitle>
          <CardDescription>Newest first by effective date.</CardDescription>
        </CardHeader>
        <CardContent>
          {adjustments.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No adjustments recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(adjustment.effectiveDate)}
                    </TableCell>
                    <TableCell>
                      {accountNameById.get(adjustment.accountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(adjustment.previousBalance))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(adjustment.newBalance))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {adjustment.difference > 0n ? "+" : ""}
                      {formatMoney(money(adjustment.difference))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {adjustment.reason}
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
