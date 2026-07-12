import { z } from "zod";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import {
  InvoiceRepository,
  type InvoiceWithItems,
  type InvoiceWriteData,
} from "@/repositories/invoice-repository";

const optionalText = (max: number) => z.string().trim().max(max).nullish();

const itemSchema = z.object({
  label: z.string().trim().min(1, "Each line needs an item").max(300),
  detail: optionalText(500),
  quantity: z.coerce.number().int().min(1).max(1_000_000).default(1),
  amount: z.coerce.bigint().refine((v) => v >= 0n, "Amount cannot be negative"),
});

const invoiceSchema = z.object({
  number: z.coerce.number().int().min(0).max(10_000_000).optional(),
  status: z.enum(["DRAFT", "SENT", "PAID"]).default("DRAFT"),
  issuanceDate: z.coerce.date(),
  dueInDays: z.coerce.number().int().min(0).max(365).default(7),
  currency: z.string().trim().min(1).max(8).default("BDT"),
  issuerEmail: optionalText(200),
  issuerAddress: optionalText(400),
  issuerPhone: optionalText(60),
  billToName: z.string().trim().min(1, "Bill-to name is required").max(200),
  billToAddress: optionalText(500),
  billToEmail: optionalText(200),
  billToPhone: optionalText(60),
  billToTin: optionalText(60),
  payBank: optionalText(120),
  payAccountName: optionalText(120),
  payAccountType: optionalText(120),
  payAccountNumber: optionalText(60),
  payBranch: optionalText(120),
  payRouting: optionalText(60),
  paySwift: optionalText(60),
  payBankAddress: optionalText(200),
  paymentType: z.enum(["BANK", "LINK"]).default("BANK"),
  paymentLinkUrl: optionalText(500),
  paymentLinkShortUrl: optionalText(300),
  signatoryName: optionalText(120),
  signatoryTitle: optionalText(120),
  signatoryPhone: optionalText(60),
  signatoryEmail: optionalText(200),
  signatureKey: z.string().trim().min(1).max(40).default("itmam"),
  recipientName: optionalText(200),
  recipientBin: optionalText(60),
  recipientPhone: optionalText(60),
  recipientEmail: optionalText(200),
  recipientAddress: optionalText(400),
  recipientAttention: optionalText(200),
  payeeName: optionalText(200),
  payeeFirm: optionalText(200),
  payeeBin: optionalText(60),
  payeeAddress: optionalText(400),
  payeeEmail: optionalText(200),
  payeeWorkType: optionalText(300),
  payeeCountry: optionalText(120),
  contractSubject: optionalText(400),
  contractNo: optionalText(120),
  contractPeriod: optionalText(120),
  notes: optionalText(500),
  clientAccountId: optionalText(60),
  incomeEntryId: optionalText(60),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});

type ParsedInvoice = z.infer<typeof invoiceSchema>;

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

function toWriteData(parsed: ParsedInvoice, number: number): InvoiceWriteData {
  return {
    number,
    status: parsed.status,
    issuanceDate: parsed.issuanceDate,
    dueInDays: parsed.dueInDays,
    currency: parsed.currency,
    issuerEmail: parsed.issuerEmail ?? null,
    issuerAddress: parsed.issuerAddress ?? null,
    issuerPhone: parsed.issuerPhone ?? null,
    billToName: parsed.billToName,
    billToAddress: parsed.billToAddress ?? null,
    billToEmail: parsed.billToEmail ?? null,
    billToPhone: parsed.billToPhone ?? null,
    billToTin: parsed.billToTin ?? null,
    payBank: parsed.payBank ?? null,
    payAccountName: parsed.payAccountName ?? null,
    payAccountType: parsed.payAccountType ?? null,
    payAccountNumber: parsed.payAccountNumber ?? null,
    payBranch: parsed.payBranch ?? null,
    payRouting: parsed.payRouting ?? null,
    paySwift: parsed.paySwift ?? null,
    payBankAddress: parsed.payBankAddress ?? null,
    paymentType: parsed.paymentType,
    paymentLinkUrl: parsed.paymentLinkUrl ?? null,
    paymentLinkShortUrl: parsed.paymentLinkShortUrl ?? null,
    signatoryName: parsed.signatoryName ?? null,
    signatoryTitle: parsed.signatoryTitle ?? null,
    signatoryPhone: parsed.signatoryPhone ?? null,
    signatoryEmail: parsed.signatoryEmail ?? null,
    signatureKey: parsed.signatureKey,
    recipientName: parsed.recipientName ?? null,
    recipientBin: parsed.recipientBin ?? null,
    recipientPhone: parsed.recipientPhone ?? null,
    recipientEmail: parsed.recipientEmail ?? null,
    recipientAddress: parsed.recipientAddress ?? null,
    recipientAttention: parsed.recipientAttention ?? null,
    payeeName: parsed.payeeName ?? null,
    payeeFirm: parsed.payeeFirm ?? null,
    payeeBin: parsed.payeeBin ?? null,
    payeeAddress: parsed.payeeAddress ?? null,
    payeeEmail: parsed.payeeEmail ?? null,
    payeeWorkType: parsed.payeeWorkType ?? null,
    payeeCountry: parsed.payeeCountry ?? null,
    contractSubject: parsed.contractSubject ?? null,
    contractNo: parsed.contractNo ?? null,
    contractPeriod: parsed.contractPeriod ?? null,
    notes: parsed.notes ?? null,
    clientAccountId: parsed.clientAccountId ?? null,
    incomeEntryId: parsed.incomeEntryId ?? null,
    items: parsed.items.map((it) => ({
      label: it.label,
      detail: it.detail ?? null,
      quantity: it.quantity,
      amount: it.amount,
    })),
  };
}

/**
 * Invoice business logic. Invoices are client-facing documents, not ledger
 * postings, so they can be edited and deleted freely. The displayed number
 * defaults to the next in sequence but is editable.
 */
export class InvoiceService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listInvoices(): Promise<InvoiceWithItems[]> {
    return new InvoiceRepository(this.db).listAll();
  }

  async getInvoice(id: string): Promise<Result<InvoiceWithItems>> {
    const invoice = await new InvoiceRepository(this.db).findById(id);
    return invoice ? ok(invoice) : err(`Invoice ${id} was not found`);
  }

  async nextNumber(): Promise<number> {
    return (await new InvoiceRepository(this.db).maxNumber()) + 1;
  }

  async create(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<InvoiceWithItems>> {
    const parsed = invoiceSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const number =
      parsed.data.number ??
      (await new InvoiceRepository(this.db).maxNumber()) + 1;
    const data = toWriteData(parsed.data, number);

    try {
      const invoice = await this.db.$transaction(async (tx) => {
        const created = await new InvoiceRepository(tx).create(
          data,
          options.actorId ?? null,
        );
        await new AuditLogRepository(tx).record({
          action: "CREATE",
          entityType: "Invoice",
          entityId: created.id,
          summary: `Invoice #${created.number} created for ${created.billToName}`,
          after: { id: created.id, number: created.number },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        return created;
      });
      return ok(invoice);
    } catch (error) {
      // Surface the real DB error instead of an opaque 500.
      return err(error instanceof Error ? error.message : "Failed to save invoice");
    }
  }

  async update(
    id: string,
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<InvoiceWithItems>> {
    const existing = await new InvoiceRepository(this.db).findById(id);
    if (!existing) return err(`Invoice ${id} was not found`);

    const parsed = invoiceSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const number = parsed.data.number ?? existing.number;
    const data = toWriteData(parsed.data, number);

    try {
      const invoice = await this.db.$transaction(async (tx) => {
        const updated = await new InvoiceRepository(tx).update(id, data);
        await new AuditLogRepository(tx).record({
          action: "UPDATE",
          entityType: "Invoice",
          entityId: id,
          summary: `Invoice #${updated.number} updated`,
          after: { id, number: updated.number },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });
        return updated;
      });
      return ok(invoice);
    } catch (error) {
      return err(error instanceof Error ? error.message : "Failed to save invoice");
    }
  }

  async remove(
    id: string,
    options: ActorOptions = {},
  ): Promise<Result<{ id: string }>> {
    const existing = await new InvoiceRepository(this.db).findById(id);
    if (!existing) return err(`Invoice ${id} was not found`);

    await this.db.$transaction(async (tx) => {
      await new InvoiceRepository(tx).delete(id);
      await new AuditLogRepository(tx).record({
        action: "DELETE",
        entityType: "Invoice",
        entityId: id,
        summary: `Invoice #${existing.number} deleted`,
        before: { id, number: existing.number },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
    });
    return ok({ id });
  }
}
