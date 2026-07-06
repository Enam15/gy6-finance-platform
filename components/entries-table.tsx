"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMoney, money } from "@/lib/money";
import { feeMethodLabel, bpsToPercent } from "@/lib/fees";
import type { SerializedEntry } from "@/lib/entry-form";
import type { EntryOption } from "@/components/entry-form-fields";
import { EditEntryDialog } from "@/components/edit-entry-dialog";
import { FullyPaidButton } from "@/components/fully-paid-button";
import { ReverseButton } from "@/components/reverse-button";
import { AttachmentsDialog } from "@/components/attachments-dialog";
import { ConfirmIncomeButton } from "@/app/income/_components/confirm-button";
import { ConfirmExpenseButton } from "@/app/expenses/_components/confirm-button";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface EntriesTableProps {
  kind: "income" | "expense";
  rows: SerializedEntry[];
  accountNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  accounts: EntryOption[];
  categories: EntryOption[];
  businessAccounts: EntryOption[];
  attachmentCounts: Record<string, number>;
}

function stateBadgeVariant(state: string): BadgeVariant {
  switch (state) {
    case "DRAFT":
      return "outline";
    case "CONFIRMED":
      return "default";
    default:
      return "destructive";
  }
}

function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "PAYMENT_NEEDED":
      return "destructive";
    case "PAYMENT_APPROACHING":
      return "outline";
    default:
      return "secondary";
  }
}

/**
 * Expandable income/expense list. Each row shows the money-flow (From -> To),
 * headline amounts and state; clicking a row reveals notes, the fee breakdown,
 * attachments and (for drafts) the Edit action. The From/To reads as the
 * money's real direction: income flows from the counterparty into Revenue,
 * expense flows out to the payee - the natural opposite.
 */
export function EntriesTable({
  kind,
  rows,
  accountNameById,
  categoryNameById,
  accounts,
  categories,
  businessAccounts,
  attachmentCounts,
}: EntriesTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // The reusable action buttons key their endpoints off the URL segment,
  // which is plural for expenses.
  const apiKind: "income" | "expenses" =
    kind === "income" ? "income" : "expenses";
  const counterpartyLabel = kind === "income" ? "the client" : "GY6";
  const businessLabel = kind === "income" ? "Revenue" : "Expense";

  function fromLabel(entry: SerializedEntry): string {
    // Where the money is taken from.
    return kind === "income"
      ? (accountNameById[entry.accountId] ?? "Unknown")
      : businessLabel;
  }
  function toLabel(entry: SerializedEntry): string {
    // Who the money goes to.
    return kind === "income"
      ? businessLabel
      : (accountNameById[entry.accountId] ?? "Unknown");
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Description</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
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
        {rows.map((entry) => {
          const isOpen = expandedId === entry.id;
          const feeAmount = entry.feeAmount ? BigInt(entry.feeAmount) : 0n;
          const hasFee = !!entry.feeMethod && feeAmount > 0n;
          const amountDue = BigInt(entry.amountDue);
          const amountPaid = BigInt(entry.amountPaid);
          const attachmentCount = attachmentCounts[entry.id] ?? 0;
          return (
            <Fragment key={entry.id}>
              <TableRow
                className="cursor-pointer"
                onClick={() => setExpandedId(isOpen ? null : entry.id)}
              >
                <TableCell className="text-muted-foreground">
                  {isOpen ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {entry.description}
                </TableCell>
                <TableCell>{fromLabel(entry)}</TableCell>
                <TableCell>{toLabel(entry)}</TableCell>
                <TableCell>
                  {categoryNameById[entry.categoryId] ?? "Unknown"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(money(BigInt(entry.totalAmount)))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {hasFee ? (
                    formatMoney(money(feeAmount))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(money(amountDue))}
                </TableCell>
                <TableCell className="tabular-nums">{entry.entryDate}</TableCell>
                <TableCell className="tabular-nums">
                  {entry.paymentDueOn}
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
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    {entry.state === "DRAFT" &&
                      (kind === "income" ? (
                        <ConfirmIncomeButton
                          entryId={entry.id}
                          description={entry.description}
                        />
                      ) : (
                        <ConfirmExpenseButton
                          entryId={entry.id}
                          description={entry.description}
                        />
                      ))}
                    {entry.state === "CONFIRMED" && amountDue > 0n && (
                      <FullyPaidButton
                        kind={apiKind}
                        entryId={entry.id}
                        description={entry.description}
                        amountDueMinor={entry.amountDue}
                        businessAccounts={businessAccounts}
                      />
                    )}
                    {entry.state === "CONFIRMED" && amountDue === 0n && (
                      <Badge variant="secondary">Fully paid</Badge>
                    )}
                    {entry.state === "CONFIRMED" && amountPaid === 0n && (
                      <ReverseButton
                        apiPath={`/api/${kind === "income" ? "income" : "expenses"}/${entry.id}/reverse`}
                        what={kind === "income" ? "Income" : "Expense"}
                        description={entry.description}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>

              {isOpen && (
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={13} className="py-4">
                    <div
                      className="grid gap-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail label="Money from">
                          {fromLabel(entry)}
                        </Detail>
                        <Detail label="Money to">{toLabel(entry)}</Detail>
                        <Detail label="Amount paid">
                          {formatMoney(money(amountPaid))}
                        </Detail>
                        <Detail label="Amount due">
                          {formatMoney(money(amountDue))}
                        </Detail>
                        <Detail label="Fee">
                          {hasFee ? (
                            <>
                              {formatMoney(money(feeAmount))}{" "}
                              <span className="text-muted-foreground">
                                ({feeMethodLabel(entry.feeMethod ?? "")}
                                {entry.feeBps
                                  ? `, ${bpsToPercent(entry.feeBps)}%`
                                  : ", fixed"}
                                {entry.feeLabel ? ` · ${entry.feeLabel}` : ""})
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              No fee
                            </span>
                          )}
                        </Detail>
                        <Detail label="Entry date">{entry.entryDate}</Detail>
                        <Detail label="Payment due">
                          {entry.paymentDueOn}
                        </Detail>
                        <Detail label="Created">
                          {entry.createdAt.slice(0, 10)}
                        </Detail>
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Notes
                        </p>
                        {entry.notes ? (
                          <p className="whitespace-pre-wrap text-sm">
                            {entry.notes}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No notes on this entry.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <AttachmentsDialog
                          kind={apiKind}
                          entryId={entry.id}
                          label={entry.description}
                          count={attachmentCount}
                        />
                        {entry.state === "DRAFT" && (
                          <EditEntryDialog
                            kind={kind}
                            entry={entry}
                            accounts={accounts}
                            categories={categories}
                          />
                        )}
                        {entry.state !== "DRAFT" && (
                          <span className="text-xs text-muted-foreground">
                            Confirmed entries are locked — reverse to correct.
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        This {kind} moves money from {fromLabel(entry)} to{" "}
                        {toLabel(entry)} ({counterpartyLabel} is the
                        counterparty).
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="text-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="tabular-nums">{children}</p>
    </div>
  );
}
