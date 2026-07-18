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
import { TransferService } from "@/services/transfer-service";
import { formatMoney, money } from "@/lib/money";
import { feeMethodLabel, bpsToPercent } from "@/lib/fees";
import type { EntryState } from "@/lib/generated/prisma/client";
import { CreateTransferDialog } from "./_components/create-transfer-dialog";
import { CreateAccountDialog } from "@/app/accounts/_components/create-account-dialog";
import { parseCustomFields } from "@/lib/account-fields";
import { ReverseButton } from "@/components/reverse-button";

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

export default async function TransfersPage() {
  const transferService = new TransferService();
  const accountService = new AccountService();

  const [transfers, businessAccounts, categories] = await Promise.all([
    transferService.listAll(),
    accountService.listBusinessAccounts(),
    accountService.listSelectableCategories(),
  ]);

  // Transfers move cash between your own bank accounts, so the "add" button
  // here is pinned to the Business category rather than asking the user to
  // work out which category a bank belongs to.
  const businessCategory = categories.find((c) => c.key === "BUSINESS");

  const accountNameById = new Map(
    businessAccounts.map((a) => [a.id, a.name]),
  );
  const businessAccountOptions = businessAccounts.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const canCreate = businessAccounts.length >= 2;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transfers</h1>
          <p className="text-sm text-muted-foreground">
            Move cash between Business accounts. Each transfer posts (DR
            destination, CR source) atomically; the negative-balance guard
            refuses transfers that would overdraw the source.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              triggerVariant={canCreate ? "outline" : "default"}
            />
          )}
          {canCreate && (
            <CreateTransferDialog businessAccounts={businessAccountOptions} />
          )}
        </div>
      </div>

      {!canCreate && (
        <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          A transfer moves cash between two of your own bank accounts, so you
          need at least two before you can record one.{" "}
          {businessAccounts.length === 1
            ? `Right now there is one: "${businessAccounts[0]?.name}".`
            : "Right now there are none."}{" "}
          Add another with the button above - bank accounts live under the
          Business category, and the same accounts are what payments land in
          and come out of.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All transfers ({transfers.length})</CardTitle>
          <CardDescription>Newest first by effective date.</CardDescription>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No transfers recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(transfer.effectiveDate)}
                    </TableCell>
                    <TableCell>
                      {accountNameById.get(transfer.fromAccountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      {accountNameById.get(transfer.toAccountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(transfer.amount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {transfer.feeAmount && transfer.feeAmount > 0n ? (
                        <div className="leading-tight">
                          <div>{formatMoney(money(transfer.feeAmount))}</div>
                          <div className="text-xs text-muted-foreground">
                            {feeMethodLabel(transfer.feeMethod ?? "")}
                            {transfer.feeBps
                              ? ` ${bpsToPercent(transfer.feeBps)}%`
                              : ""}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transfer.description ?? ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stateBadgeVariant(transfer.state)}>
                        {transfer.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {transfer.state === "CONFIRMED" && (
                          <ReverseButton
                            apiPath={`/api/transfers/${transfer.id}/reverse`}
                            what="Transfer"
                            description={
                              transfer.description ??
                              `${accountNameById.get(transfer.fromAccountId) ?? "Unknown"} -> ${accountNameById.get(transfer.toAccountId) ?? "Unknown"}`
                            }
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
