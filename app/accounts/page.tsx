import Link from "next/link";
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
import { parseCustomFields } from "@/lib/account-fields";
import { CreateAccountDialog } from "./_components/create-account-dialog";
import { CreateAccountCategoryDialog } from "./_components/create-account-category-dialog";

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

  // Bank accounts get their own section: they are the ones every money
  // movement needs, and "Business" isn't an obvious name for them.
  const businessCategory = categories.find((c) => c.key === "BUSINESS");
  const bankAccounts = businessCategory
    ? accounts.filter((a) => a.categoryId === businessCategory.id)
    : [];

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
        <div className="flex gap-2">
          <CreateAccountCategoryDialog />
          {businessCategory && (
            <CreateAccountDialog
              categories={[
                {
                  id: businessCategory.id,
                  name: businessCategory.name,
                  fields: parseCustomFields(businessCategory.customFields),
                },
              ]}
              fixedCategoryId={businessCategory.id}
              triggerLabel="Add bank account"
              triggerVariant="outline"
            />
          )}
          <CreateAccountDialog
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              fields: parseCustomFields(c.customFields),
            }))}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank accounts ({bankAccounts.length})</CardTitle>
          <CardDescription>
            Your own accounts - the money you actually hold. These are what
            transfers move between, and what a payment lands in or comes out
            of. Everything else below is someone you send money to or receive
            it from.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              No bank accounts yet. Add one to start recording payments and
              transfers.
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {bankAccounts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/accounts/${a.id}`}
                    className="flex items-baseline gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{a.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMoney(money(a.balance))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
                        <Link
                          href={`/accounts/${account.id}`}
                          className="hover:underline"
                        >
                          {account.name}
                        </Link>
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
