import { moneyFromMajor, formatMoneyForInput, money } from "@/lib/money";
import type { InvoiceDocumentData } from "@/components/invoice/invoice-document";
import type { InvoiceWithItems } from "@/lib/invoice/to-document";
import { invoiceDateLabel } from "@/lib/invoice/to-document";
import { INVOICE_DEFAULTS } from "@/lib/invoice/defaults";
import {
  DEFAULT_SIGNATURE_KEY,
  signatureUrlForKey,
} from "@/lib/invoice/signatories";

export type InvoiceStatusValue = "DRAFT" | "SENT" | "PAID";

export interface InvoiceItemForm {
  label: string;
  detail: string;
  quantity: string;
  amount: string; // major units, as typed (e.g. "50000" or "50000.00")
}

export interface InvoiceForm {
  number: string;
  status: InvoiceStatusValue;
  issuanceDate: string; // ISO yyyy-mm-dd
  dueInDays: string;
  currency: string;
  issuerEmail: string;
  issuerAddress: string;
  issuerPhone: string;
  billToName: string;
  billToAddress: string;
  billToEmail: string;
  billToPhone: string;
  billToTin: string;
  payBank: string;
  payAccountName: string;
  payAccountType: string;
  payAccountNumber: string;
  payBranch: string;
  payRouting: string;
  paySwift: string;
  payBankAddress: string;
  paymentType: string;
  paymentLinkUrl: string;
  paymentLinkShortUrl: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryPhone: string;
  signatoryEmail: string;
  signatureKey: string;
  recipientName: string;
  recipientBin: string;
  recipientPhone: string;
  recipientEmail: string;
  recipientAddress: string;
  recipientAttention: string;
  payeeName: string;
  payeeFirm: string;
  payeeBin: string;
  payeeAddress: string;
  payeeEmail: string;
  payeeWorkType: string;
  payeeCountry: string;
  contractSubject: string;
  contractNo: string;
  contractPeriod: string;
  notes: string;
  items: InvoiceItemForm[];
}

export function emptyItem(): InvoiceItemForm {
  return { label: "", detail: "", quantity: "1", amount: "" };
}

/** Fresh invoice form pre-filled with GY6's standing details. */
export function blankInvoiceForm(number: number, todayIso: string): InvoiceForm {
  return {
    number: String(number),
    status: "DRAFT",
    issuanceDate: todayIso,
    dueInDays: String(INVOICE_DEFAULTS.dueInDays),
    currency: INVOICE_DEFAULTS.currency,
    issuerEmail: INVOICE_DEFAULTS.issuerEmail,
    issuerAddress: INVOICE_DEFAULTS.issuerAddress,
    issuerPhone: INVOICE_DEFAULTS.issuerPhone,
    billToName: "",
    billToAddress: "",
    billToEmail: "",
    billToPhone: "",
    billToTin: "",
    payBank: INVOICE_DEFAULTS.payBank,
    payAccountName: INVOICE_DEFAULTS.payAccountName,
    payAccountType: INVOICE_DEFAULTS.payAccountType,
    payAccountNumber: INVOICE_DEFAULTS.payAccountNumber,
    payBranch: INVOICE_DEFAULTS.payBranch,
    payRouting: INVOICE_DEFAULTS.payRouting,
    paySwift: "",
    payBankAddress: "",
    paymentType: "BANK",
    paymentLinkUrl: "",
    paymentLinkShortUrl: "",
    signatoryName: INVOICE_DEFAULTS.signatoryName,
    signatoryTitle: INVOICE_DEFAULTS.signatoryTitle,
    signatoryPhone: INVOICE_DEFAULTS.signatoryPhone,
    signatoryEmail: INVOICE_DEFAULTS.signatoryEmail,
    signatureKey: DEFAULT_SIGNATURE_KEY,
    recipientName: "",
    recipientBin: "",
    recipientPhone: "",
    recipientEmail: "",
    recipientAddress: "",
    recipientAttention: "",
    payeeName: "",
    payeeFirm: "",
    payeeBin: "",
    payeeAddress: "",
    payeeEmail: "",
    payeeWorkType: "",
    payeeCountry: "",
    contractSubject: "",
    contractNo: "",
    contractPeriod: "",
    notes: "",
    items: [emptyItem()],
  };
}

/** Map a stored invoice into the editable form (runs server-side). */
export function invoiceToForm(invoice: InvoiceWithItems): InvoiceForm {
  const s = (v: string | null): string => v ?? "";
  return {
    number: String(invoice.number),
    status: invoice.status,
    issuanceDate: invoice.issuanceDate.toISOString().slice(0, 10),
    dueInDays: String(invoice.dueInDays),
    currency: invoice.currency,
    issuerEmail: s(invoice.issuerEmail),
    issuerAddress: s(invoice.issuerAddress),
    issuerPhone: s(invoice.issuerPhone),
    billToName: invoice.billToName,
    billToAddress: s(invoice.billToAddress),
    billToEmail: s(invoice.billToEmail),
    billToPhone: s(invoice.billToPhone),
    billToTin: s(invoice.billToTin),
    payBank: s(invoice.payBank),
    payAccountName: s(invoice.payAccountName),
    payAccountType: s(invoice.payAccountType),
    payAccountNumber: s(invoice.payAccountNumber),
    payBranch: s(invoice.payBranch),
    payRouting: s(invoice.payRouting),
    paySwift: s(invoice.paySwift),
    payBankAddress: s(invoice.payBankAddress),
    paymentType: invoice.paymentType,
    paymentLinkUrl: s(invoice.paymentLinkUrl),
    paymentLinkShortUrl: s(invoice.paymentLinkShortUrl),
    signatoryName: s(invoice.signatoryName),
    signatoryTitle: s(invoice.signatoryTitle),
    signatoryPhone: s(invoice.signatoryPhone),
    signatoryEmail: s(invoice.signatoryEmail),
    signatureKey: invoice.signatureKey,
    recipientName: s(invoice.recipientName),
    recipientBin: s(invoice.recipientBin),
    recipientPhone: s(invoice.recipientPhone),
    recipientEmail: s(invoice.recipientEmail),
    recipientAddress: s(invoice.recipientAddress),
    recipientAttention: s(invoice.recipientAttention),
    payeeName: s(invoice.payeeName),
    payeeFirm: s(invoice.payeeFirm),
    payeeBin: s(invoice.payeeBin),
    payeeAddress: s(invoice.payeeAddress),
    payeeEmail: s(invoice.payeeEmail),
    payeeWorkType: s(invoice.payeeWorkType),
    payeeCountry: s(invoice.payeeCountry),
    contractSubject: s(invoice.contractSubject),
    contractNo: s(invoice.contractNo),
    contractPeriod: s(invoice.contractPeriod),
    notes: s(invoice.notes),
    items: invoice.items.map((it) => ({
      label: it.label,
      detail: it.detail ?? "",
      quantity: String(it.quantity),
      amount: formatMoneyForInput(money(it.amount)),
    })),
  };
}

function minorFromInput(major: string): bigint {
  const trimmed = major.trim();
  if (!trimmed) return 0n;
  try {
    return moneyFromMajor(trimmed);
  } catch {
    return 0n;
  }
}

function isoToLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  return invoiceDateLabel(new Date(Date.UTC(y, m - 1, d)));
}

/** Live-preview data from the current form (amounts parsed leniently). */
export function formToDocument(form: InvoiceForm): InvoiceDocumentData {
  return {
    number: Number.parseInt(form.number, 10) || 0,
    issuanceDate: isoToLabel(form.issuanceDate),
    dueInDays: Number.parseInt(form.dueInDays, 10) || 0,
    currency: form.currency || "BDT",
    issuerEmail: form.issuerEmail,
    issuerAddress: form.issuerAddress,
    issuerPhone: form.issuerPhone,
    billToName: form.billToName,
    billToAddress: form.billToAddress,
    billToEmail: form.billToEmail,
    billToPhone: form.billToPhone,
    billToTin: form.billToTin,
    recipientName: form.recipientName,
    recipientBin: form.recipientBin,
    recipientPhone: form.recipientPhone,
    recipientEmail: form.recipientEmail,
    recipientAddress: form.recipientAddress,
    recipientAttention: form.recipientAttention,
    payeeName: form.payeeName,
    payeeFirm: form.payeeFirm,
    payeeBin: form.payeeBin,
    payeeAddress: form.payeeAddress,
    payeeEmail: form.payeeEmail,
    payeeWorkType: form.payeeWorkType,
    payeeCountry: form.payeeCountry,
    contractSubject: form.contractSubject,
    contractNo: form.contractNo,
    contractPeriod: form.contractPeriod,
    payBank: form.payBank,
    payAccountName: form.payAccountName,
    payAccountType: form.payAccountType,
    payAccountNumber: form.payAccountNumber,
    payBranch: form.payBranch,
    payRouting: form.payRouting,
    paySwift: form.paySwift,
    payBankAddress: form.payBankAddress,
    paymentType: form.paymentType,
    paymentLinkUrl: form.paymentLinkUrl,
    paymentLinkShortUrl: form.paymentLinkShortUrl,
    signatoryName: form.signatoryName,
    signatoryTitle: form.signatoryTitle,
    signatoryPhone: form.signatoryPhone,
    signatoryEmail: form.signatoryEmail,
    signatureUrl: signatureUrlForKey(form.signatureKey),
    notes: form.notes,
    items: form.items.map((it) => ({
      label: it.label,
      detail: it.detail,
      quantity: Number.parseInt(it.quantity, 10) || 1,
      amount: minorFromInput(it.amount).toString(),
    })),
  };
}

/** Build the API payload from the form (amounts as minor-unit strings). */
export function formToPayload(form: InvoiceForm): Record<string, unknown> {
  const u = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    number: Number.parseInt(form.number, 10) || 0,
    status: form.status,
    issuanceDate: form.issuanceDate,
    dueInDays: Number.parseInt(form.dueInDays, 10) || 0,
    currency: form.currency.trim() || "BDT",
    issuerEmail: u(form.issuerEmail),
    issuerAddress: u(form.issuerAddress),
    issuerPhone: u(form.issuerPhone),
    billToName: form.billToName.trim(),
    billToAddress: u(form.billToAddress),
    billToEmail: u(form.billToEmail),
    billToPhone: u(form.billToPhone),
    billToTin: u(form.billToTin),
    payBank: u(form.payBank),
    payAccountName: u(form.payAccountName),
    payAccountType: u(form.payAccountType),
    payAccountNumber: u(form.payAccountNumber),
    payBranch: u(form.payBranch),
    payRouting: u(form.payRouting),
    paySwift: u(form.paySwift),
    payBankAddress: u(form.payBankAddress),
    paymentType: form.paymentType,
    paymentLinkUrl: u(form.paymentLinkUrl),
    paymentLinkShortUrl: u(form.paymentLinkShortUrl),
    signatoryName: u(form.signatoryName),
    signatoryTitle: u(form.signatoryTitle),
    signatoryPhone: u(form.signatoryPhone),
    signatoryEmail: u(form.signatoryEmail),
    signatureKey: form.signatureKey,
    recipientName: u(form.recipientName),
    recipientBin: u(form.recipientBin),
    recipientPhone: u(form.recipientPhone),
    recipientEmail: u(form.recipientEmail),
    recipientAddress: u(form.recipientAddress),
    recipientAttention: u(form.recipientAttention),
    payeeName: u(form.payeeName),
    payeeFirm: u(form.payeeFirm),
    payeeBin: u(form.payeeBin),
    payeeAddress: u(form.payeeAddress),
    payeeEmail: u(form.payeeEmail),
    payeeWorkType: u(form.payeeWorkType),
    payeeCountry: u(form.payeeCountry),
    contractSubject: u(form.contractSubject),
    contractNo: u(form.contractNo),
    contractPeriod: u(form.contractPeriod),
    notes: u(form.notes),
    items: form.items
      .filter((it) => it.label.trim())
      .map((it) => ({
        label: it.label.trim(),
        detail: it.detail.trim() || undefined,
        quantity: Number.parseInt(it.quantity, 10) || 1,
        amount: minorFromInput(it.amount).toString(),
      })),
  };
}

/** Grand total of the form's items, in minor units. */
export function formTotalMinor(form: InvoiceForm): bigint {
  return form.items.reduce((sum, it) => sum + minorFromInput(it.amount), 0n);
}
