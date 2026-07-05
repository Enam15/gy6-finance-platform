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
import { Button } from "@/components/ui/button";
import { InvoiceService } from "@/services/invoice-service";
import { invoiceDateLabel } from "@/lib/invoice/to-document";
import { currencySymbol } from "@/lib/invoice/currencies";
import type { InvoiceStatus } from "@/lib/generated/prisma/client";
import { DeleteInvoiceButton } from "./_components/delete-invoice-button";

export const dynamic = "force-dynamic";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function statusVariant(status: InvoiceStatus): BadgeVariant {
  switch (status) {
    case "PAID":
      return "secondary";
    case "SENT":
      return "default";
    case "DRAFT":
      return "outline";
  }
}

function formatTotal(items: { amount: bigint }[], currency: string): string {
  const total = items.reduce((sum, it) => sum + it.amount, 0n);
  const sym = currencySymbol(currency);
  const major = total / 100n;
  const cents = total % 100n;
  const m = major.toLocaleString("en-US");
  const s = cents === 0n ? m : `${m}.${cents.toString().padStart(2, "0")}`;
  return `${sym} ${s}`;
}

export default async function InvoicesPage() {
  const invoices = await new InvoiceService().listInvoices();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Client-facing invoices on GY6&apos;s design. The number defaults to
            the next in sequence but is editable; print or save any invoice as a
            PDF.
          </p>
        </div>
        <Button render={<Link href="/invoices/new" />}>New invoice</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All invoices ({invoices.length})</CardTitle>
          <CardDescription>Highest number first.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No invoices yet. Create the first one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No.</TableHead>
                  <TableHead>Bill to</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium tabular-nums">
                      #{inv.number.toString().padStart(2, "0")}
                    </TableCell>
                    <TableCell>{inv.billToName}</TableCell>
                    <TableCell className="tabular-nums">
                      {invoiceDateLabel(inv.issuanceDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {inv.items.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTotal(inv.items, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(inv.status)}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/invoices/${inv.id}`} />}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          render={
                            <Link
                              href={`/invoices/${inv.id}/print`}
                              target="_blank"
                            />
                          }
                        >
                          Print
                        </Button>
                        <DeleteInvoiceButton id={inv.id} number={inv.number} />
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
