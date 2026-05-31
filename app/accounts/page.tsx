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
import { formatMoney, money } from "@/lib/money";
import { CreateAccountDialog } from "./_components/create-account-dialog";

// Every data page in this app reads live ledger state on every request; we
// never want a statically prerendered snapshot. Once auth lands, calling
// cookies()/headers() will mark the route dynamic automatically.
export const dynamic = "force-dynamic";

// Server component - calls the service directly, no HTTP round-trip.
// The page re-renders on `router.refresh()` after a successful create.
export default async function AccountsPage() {
  const service = new AccountService();
  const [accounts, categories] = await Promise.all([
    service.listVisible(),
    service.listSelectableCategories(),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Bank accounts, clients, founders, employees and subscriptions.
            Internal system accounts are hidden.
          </p>
        </div>
        <CreateAccountDialog
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All accounts ({accounts.length})</CardTitle>
          <CardDescription>Ordered by name.</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No accounts yet. Create one with the button above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Normal balance</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const categoryName =
                    categoryNameById.get(account.categoryId) ?? "Unknown";
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.name}
                      </TableCell>
                      <TableCell>{categoryName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            account.normalBalance === "DEBIT"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {account.normalBalance}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(money(account.balance))}
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
