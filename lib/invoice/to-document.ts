import type { Invoice, InvoiceItem } from "@/lib/generated/prisma/client";
import type { InvoiceDocumentData } from "@/components/invoice/invoice-document";
import { signatureUrlForKey } from "@/lib/invoice/signatories";
import type { InvoiceAppendixData } from "@/components/invoice/invoice-appendix";

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
    paySwift: invoice.paySwift,
    payBankAddress: invoice.payBankAddress,
    paymentType: invoice.paymentType,
    paymentLinkUrl: invoice.paymentLinkUrl,
    paymentLinkShortUrl: invoice.paymentLinkShortUrl,
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

/** Build the formal-details appendix data from a stored invoice. */
export function toAppendixData(invoice: InvoiceWithItems): InvoiceAppendixData {
  return {
    recipientName: invoice.recipientName,
    recipientBin: invoice.recipientBin,
    recipientPhone: invoice.recipientPhone,
    recipientEmail: invoice.recipientEmail,
    recipientAddress: invoice.recipientAddress,
    recipientAttention: invoice.recipientAttention,
    payeeName: invoice.payeeName,
    payeeFirm: invoice.payeeFirm,
    payeeBin: invoice.payeeBin,
    payeeAddress: invoice.payeeAddress,
    payeeEmail: invoice.payeeEmail,
    payeeWorkType: invoice.payeeWorkType,
    payeeCountry: invoice.payeeCountry,
    payAccountName: invoice.payAccountName,
    payAccountNumber: invoice.payAccountNumber,
    payBank: invoice.payBank,
    payRouting: invoice.payRouting,
    paySwift: invoice.paySwift,
    payBranch: invoice.payBranch,
    payBankAddress: invoice.payBankAddress,
    contractSubject: invoice.contractSubject,
    contractNo: invoice.contractNo,
    contractPeriod: invoice.contractPeriod,
    invoiceDate: invoiceDateLabel(invoice.issuanceDate),
    invoiceNumber: invoice.number.toString().padStart(2, "0"),
  };
}
