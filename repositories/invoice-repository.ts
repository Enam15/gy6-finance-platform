import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface InvoiceItemInput {
  label: string;
  detail?: string | null;
  quantity: number;
  amount: bigint;
}

export interface InvoiceWriteData {
  number: number;
  status: InvoiceStatus;
  issuanceDate: Date;
  dueInDays: number;
  currency: string;
  issuerEmail?: string | null;
  issuerAddress?: string | null;
  issuerPhone?: string | null;
  billToName: string;
  billToAddress?: string | null;
  billToEmail?: string | null;
  billToPhone?: string | null;
  billToTin?: string | null;
  payBank?: string | null;
  payAccountName?: string | null;
  payAccountType?: string | null;
  payAccountNumber?: string | null;
  payBranch?: string | null;
  payRouting?: string | null;
  paySwift?: string | null;
  payBankAddress?: string | null;
  paymentType: string;
  paymentLinkUrl?: string | null;
  paymentLinkShortUrl?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  signatoryPhone?: string | null;
  signatoryEmail?: string | null;
  signatureKey: string;
  recipientName?: string | null;
  recipientBin?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientAddress?: string | null;
  recipientAttention?: string | null;
  payeeName?: string | null;
  payeeFirm?: string | null;
  payeeBin?: string | null;
  payeeAddress?: string | null;
  payeeEmail?: string | null;
  payeeWorkType?: string | null;
  payeeCountry?: string | null;
  contractSubject?: string | null;
  contractNo?: string | null;
  contractPeriod?: string | null;
  notes?: string | null;
  clientAccountId?: string | null;
  incomeEntryId?: string | null;
  items: InvoiceItemInput[];
}

export type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

function scalarData(d: InvoiceWriteData) {
  return {
    number: d.number,
    status: d.status,
    issuanceDate: d.issuanceDate,
    dueInDays: d.dueInDays,
    currency: d.currency,
    issuerEmail: d.issuerEmail ?? null,
    issuerAddress: d.issuerAddress ?? null,
    issuerPhone: d.issuerPhone ?? null,
    billToName: d.billToName,
    billToAddress: d.billToAddress ?? null,
    billToEmail: d.billToEmail ?? null,
    billToPhone: d.billToPhone ?? null,
    billToTin: d.billToTin ?? null,
    payBank: d.payBank ?? null,
    payAccountName: d.payAccountName ?? null,
    payAccountType: d.payAccountType ?? null,
    payAccountNumber: d.payAccountNumber ?? null,
    payBranch: d.payBranch ?? null,
    payRouting: d.payRouting ?? null,
    paySwift: d.paySwift ?? null,
    payBankAddress: d.payBankAddress ?? null,
    paymentType: d.paymentType,
    paymentLinkUrl: d.paymentLinkUrl ?? null,
    paymentLinkShortUrl: d.paymentLinkShortUrl ?? null,
    signatoryName: d.signatoryName ?? null,
    signatoryTitle: d.signatoryTitle ?? null,
    signatoryPhone: d.signatoryPhone ?? null,
    signatoryEmail: d.signatoryEmail ?? null,
    signatureKey: d.signatureKey,
    recipientName: d.recipientName ?? null,
    recipientBin: d.recipientBin ?? null,
    recipientPhone: d.recipientPhone ?? null,
    recipientEmail: d.recipientEmail ?? null,
    recipientAddress: d.recipientAddress ?? null,
    recipientAttention: d.recipientAttention ?? null,
    payeeName: d.payeeName ?? null,
    payeeFirm: d.payeeFirm ?? null,
    payeeBin: d.payeeBin ?? null,
    payeeAddress: d.payeeAddress ?? null,
    payeeEmail: d.payeeEmail ?? null,
    payeeWorkType: d.payeeWorkType ?? null,
    payeeCountry: d.payeeCountry ?? null,
    contractSubject: d.contractSubject ?? null,
    contractNo: d.contractNo ?? null,
    contractPeriod: d.contractPeriod ?? null,
    notes: d.notes ?? null,
    clientAccountId: d.clientAccountId ?? null,
    incomeEntryId: d.incomeEntryId ?? null,
  };
}

function itemCreates(items: InvoiceItemInput[]) {
  return items.map((it, i) => ({
    label: it.label,
    detail: it.detail ?? null,
    quantity: it.quantity,
    amount: it.amount,
    sortOrder: i,
  }));
}

/** Data access for invoices and their line items. */
export class InvoiceRepository {
  constructor(private readonly db: DbClient) {}

  listAll(): Promise<InvoiceWithItems[]> {
    return this.db.invoice.findMany({
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ number: "desc" }, { createdAt: "desc" }],
    });
  }

  findById(id: string): Promise<InvoiceWithItems | null> {
    return this.db.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async maxNumber(): Promise<number> {
    const result = await this.db.invoice.aggregate({ _max: { number: true } });
    return result._max.number ?? 0;
  }

  create(
    data: InvoiceWriteData,
    createdBy: string | null,
  ): Promise<InvoiceWithItems> {
    return this.db.invoice.create({
      data: {
        ...scalarData(data),
        createdBy,
        items: { create: itemCreates(data.items) },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }

  /** Replace the invoice's scalar fields and its full set of line items. */
  async update(id: string, data: InvoiceWriteData): Promise<InvoiceWithItems> {
    await this.db.invoiceItem.deleteMany({ where: { invoiceId: id } });
    return this.db.invoice.update({
      where: { id },
      data: {
        ...scalarData(data),
        items: { create: itemCreates(data.items) },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }

  delete(id: string): Promise<Invoice> {
    return this.db.invoice.delete({ where: { id } });
  }
}
