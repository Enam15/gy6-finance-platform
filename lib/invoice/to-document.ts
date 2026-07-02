import type { Invoice, InvoiceItem } from "@/lib/generated/prisma/client";
import type { InvoiceDocumentData } from "@/components/invoice/invoice-document";
import { signatureUrlForKey } from "@/lib/invoice/signatories";

export type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

/** "2026-06-15" (UTC date) -> "June 15, 2026". */
export function invoiceDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Map a stored invoice to the props the InvoiceDocument renders. */
export function toDocumentData(invoice: InvoiceWithItems): InvoiceDocumentData {
  return {
    number: invoice.number,
    issuanceDate: invoiceDateLabel(invoice.issuanceDate),
    dueInDays: invoice.dueInDays,
    currency: invoice.currency,
    issuerEmail: invoice.issuerEmail,
    issuerAddress: invoice.issuerAddress,
    issuerPhone: invoice.issuerPhone,
    billToName: invoice.billToName,
    billToAddress: invoice.billToAddress,
    billToEmail: invoice.billToEmail,
    billToPhone: invoice.billToPhone,
    billToTin: invoice.billToTin,
    payBank: invoice.payBank,
    payAccountName: invoice.payAccountName,
    payAccountType: invoice.payAccountType,
    payAccountNumber: invoice.payAccountNumber,
    payBranch: invoice.payBranch,
    payRouting: invoice.payRouting,
    signatoryName: invoice.signatoryName,
    signatoryTitle: invoice.signatoryTitle,
    signatoryPhone: invoice.signatoryPhone,
    signatoryEmail: invoice.signatoryEmail,
    notes: invoice.notes,
    signatureUrl: signatureUrlForKey(invoice.signatureKey),
    items: invoice.items.map((it) => ({
      label: it.label,
      detail: it.detail,
      quantity: it.quantity,
      amount: it.amount.toString(),
    })),
  };
}
