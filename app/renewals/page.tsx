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
import { RenewalService } from "@/services/renewal-service";
import { TransactionCategoryService } from "@/services/transaction-category-service";
import { formatMoney, money } from "@/lib/money";
import type { CategoryKind } from "@/lib/generated/prisma/client";
import { CreateRenewalDialog } from "./_components/create-renewal-dialog";
import { GenerateRenewalsButton } from "./_components/generate-renewals-button";
import { RenewalActiveToggle } from "./_components/renewal-active-toggle";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function intervalLabel(count: number, unit: string): string {
  const u = unit.toLowerCase();
  return `Every ${count} ${u}${count === 1 ? "" : "s"}`;
}

function kindVariant(kind: CategoryKind): "default" | "secondary" {
  return kind === "INCOME" ? "default" : "secondary";
}

export default async function RenewalsPage() {
  const [templates, accounts, incomeCategories, expenseCategories] =
    await Promise.all([
      new RenewalService().listTemplates(),
      new AccountService().listVisible(),
      new TransactionCategoryService().listByKind("INCOME"),
      new TransactionCategoryService().listByKind("EXPENSE"),
    ]);

  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryNameById = new Map(
    [...incomeCategories, ...expenseCategories].map((c) => [c.id, c.name]),
  );

  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));
  const incomeOptions = incomeCategories.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const expenseOptions = expenseCategories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const canCreate =
    accounts.length > 0 &&
    (incomeCategories.length > 0 || expenseCategories.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Renewals</h1>
          <p className="text-sm text-muted-foreground">
            Recurring income and expense templates. Generating creates DRAFT
            entries dated for each due period - you review and confirm them
            like any draft; nothing posts automatically.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <GenerateRenewalsButton />
          {canCreate && (
            <CreateRenewalDialog
              accounts={accountOptions}
              incomeCategories={incomeOptions}
              expenseCategories={expenseOptions}
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All templates ({templates.length})</CardTitle>
          <CardDescription>
            Active first, then soonest-due. &quot;Generate due renewals&quot;
            materialises every template whose next run has arrived.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No renewal templates yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Recurrence</TableHead>
                  <TableHead>Next due</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant={kindVariant(t.kind)}>{t.kind}</Badge>
                    </TableCell>
                    <TableCell>
                      {accountNameById.get(t.accountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      {categoryNameById.get(t.categoryId) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(t.totalAmount))}
                    </TableCell>
                    <TableCell>
                      {intervalLabel(t.intervalCount, t.intervalUnit)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(t.nextRunOn)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {t.endOn ? formatDate(t.endOn) : "—"}
                    </TableCell>
                    <TableCell>
                      <RenewalActiveToggle
                        id={t.id}
                        isActive={t.isActive}
                        name={t.name}
                      />
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
