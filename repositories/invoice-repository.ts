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
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  signatoryPhone?: string | null;
  signatoryEmail?: string | null;
  signatureKey: string;
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
    signatoryName: d.signatoryName ?? null,
    signatoryTitle: d.signatoryTitle ?? null,
    signatoryPhone: d.signatoryPhone ?? null,
    signatoryEmail: d.signatoryEmail ?? null,
    signatureKey: d.signatureKey,
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
