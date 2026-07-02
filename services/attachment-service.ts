import type { Attachment, PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import {
  AttachmentRepository,
  type AttachmentMeta,
} from "@/repositories/attachment-repository";

/** Kept under the Vercel serverless request-body ceiling (~4.5 MB). */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

interface CreateAttachmentInput {
  incomeEntryId?: string | null;
  expenseEntryId?: string | null;
  fileName: string;
  contentType: string;
  data: Uint8Array<ArrayBuffer>;
}

/**
 * Attachment business logic. Files are stored in the DB (bytea) and only ever
 * served through the authenticated download route - these are sensitive
 * documents (payslips, contracts, invoices) and must never be public.
 */
export class AttachmentService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listForIncome(incomeEntryId: string): Promise<AttachmentMeta[]> {
    return new AttachmentRepository(this.db).listForIncome(incomeEntryId);
  }

  listForExpense(expenseEntryId: string): Promise<AttachmentMeta[]> {
    return new AttachmentRepository(this.db).listForExpense(expenseEntryId);
  }

  countsByIncome(): Promise<Map<string, number>> {
    return new AttachmentRepository(this.db).countsByIncome();
  }

  countsByExpense(): Promise<Map<string, number>> {
    return new AttachmentRepository(this.db).countsByExpense();
  }

  findForDownload(id: string): Promise<Attachment | null> {
    return new AttachmentRepository(this.db).findWithData(id);
  }

  async create(
    input: CreateAttachmentInput,
    options: ActorOptions = {},
  ): Promise<Result<AttachmentMeta>> {
    const fileName = input.fileName.trim();
    if (!fileName) return err("A file name is required");
    if (input.data.byteLength === 0) return err("The file is empty");
    if (input.data.byteLength > MAX_ATTACHMENT_BYTES) {
      const mb = Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024));
      return err(`File is too large (max ${mb} MB)`);
    }
    if (!input.incomeEntryId && !input.expenseEntryId) {
      return err("An attachment must belong to an income or expense entry");
    }

    const created = await this.db.$transaction(async (tx) => {
      const att = await new AttachmentRepository(tx).create({
        incomeEntryId: input.incomeEntryId ?? null,
        expenseEntryId: input.expenseEntryId ?? null,
        fileName: fileName.slice(0, 255),
        contentType: input.contentType || "application/octet-stream",
        sizeBytes: input.data.byteLength,
        data: input.data,
        uploadedBy: options.actorId ?? null,
      });
      await new AuditLogRepository(tx).record({
        action: "CREATE",
        entityType: "Attachment",
        entityId: att.id,
        summary: `Attached "${att.fileName}" to ${input.incomeEntryId ? "an income" : "an expense"} entry`,
        after: {
          id: att.id,
          fileName: att.fileName,
          sizeBytes: att.sizeBytes,
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return att;
    });
    return ok(created);
  }

  async remove(
    id: string,
    options: ActorOptions = {},
  ): Promise<Result<AttachmentMeta>> {
    const existing = await new AttachmentRepository(this.db).findMeta(id);
    if (!existing) return err(`Attachment ${id} was not found`);

    const removed = await this.db.$transaction(async (tx) => {
      const att = await new AttachmentRepository(tx).delete(id);
      await new AuditLogRepository(tx).record({
        action: "DELETE",
        entityType: "Attachment",
        entityId: id,
        summary: `Removed attachment "${att.fileName}"`,
        before: { id, fileName: att.fileName },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return att;
    });
    return ok(removed);
  }
}
