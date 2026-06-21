import { moneyFromMajor, formatMoneyForInput, money } from "@/lib/money";
import type { InvoiceDocumentData } from "@/components/invoice/invoice-document";
import type { InvoiceWithItems } from "@/lib/invoice/to-document";
import { invoiceDateLabel } from "@/lib/invoice/to-document";
import { INVOICE_DEFAULTS } from "@/lib/invoice/defaults";

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
  signatoryName: string;
  signatoryTitle: string;
  signatoryPhone: string;
  signatoryEmail: string;
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
    signatoryName: INVOICE_DEFAULTS.signatoryName,
    signatoryTitle: INVOICE_DEFAULTS.signatoryTitle,
    signatoryPhone: INVOICE_DEFAULTS.signatoryPhone,
    signatoryEmail: INVOICE_DEFAULTS.signatoryEmail,
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
    signatoryName: s(invoice.signatoryName),
    signatoryTitle: s(invoice.signatoryTitle),
    signatoryPhone: s(invoice.signatoryPhone),
    signatoryEmail: s(invoice.signatoryEmail),
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
    payBank: form.payBank,
    payAccountName: form.payAccountName,
    payAccountType: form.payAccountType,
    payAccountNumber: form.payAccountNumber,
    payBranch: form.payBranch,
    payRouting: form.payRouting,
    signatoryName: form.signatoryName,
    signatoryTitle: form.signatoryTitle,
    signatoryPhone: form.signatoryPhone,
    signatoryEmail: form.signatoryEmail,
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
    signatoryName: u(form.signatoryName),
    signatoryTitle: u(form.signatoryTitle),
    signatoryPhone: u(form.signatoryPhone),
    signatoryEmail: u(form.signatoryEmail),
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
