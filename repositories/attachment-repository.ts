import type { Attachment, Prisma } from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface CreateAttachmentData {
  incomeEntryId?: string | null;
  expenseEntryId?: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  data: Uint8Array<ArrayBuffer>;
  uploadedBy?: string | null;
}

// Everything except the heavy `data` blob - used for lists and metadata.
const META_SELECT = {
  id: true,
  incomeEntryId: true,
  expenseEntryId: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  uploadedAt: true,
  uploadedBy: true,
} satisfies Prisma.AttachmentSelect;

export type AttachmentMeta = Prisma.AttachmentGetPayload<{
  select: typeof META_SELECT;
}>;

/** Data access for entry attachments. File bytes live in the `data` column;
 *  reads that don't need the bytes use the metadata projection. */
export class AttachmentRepository {
  constructor(private readonly db: DbClient) {}

  create(data: CreateAttachmentData): Promise<AttachmentMeta> {
    return this.db.attachment.create({
      data: {
        incomeEntryId: data.incomeEntryId ?? null,
        expenseEntryId: data.expenseEntryId ?? null,
        fileName: data.fileName,
        contentType: data.contentType,
        sizeBytes: data.sizeBytes,
        data: data.data,
        uploadedBy: data.uploadedBy ?? null,
      },
      select: META_SELECT,
    });
  }

  listForIncome(incomeEntryId: string): Promise<AttachmentMeta[]> {
    return this.db.attachment.findMany({
      where: { incomeEntryId },
      orderBy: { uploadedAt: "desc" },
      select: META_SELECT,
    });
  }

  listForExpense(expenseEntryId: string): Promise<AttachmentMeta[]> {
    return this.db.attachment.findMany({
      where: { expenseEntryId },
      orderBy: { uploadedAt: "desc" },
      select: META_SELECT,
    });
  }

  findMeta(id: string): Promise<AttachmentMeta | null> {
    return this.db.attachment.findUnique({ where: { id }, select: META_SELECT });
  }

  /** Full row including bytes - only for the download route. */
  findWithData(id: string): Promise<Attachment | null> {
    return this.db.attachment.findUnique({ where: { id } });
  }

  delete(id: string): Promise<AttachmentMeta> {
    return this.db.attachment.delete({ where: { id }, select: META_SELECT });
  }

  async countsByIncome(): Promise<Map<string, number>> {
    const rows = await this.db.attachment.groupBy({
      by: ["incomeEntryId"],
      where: { incomeEntryId: { not: null } },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.incomeEntryId) map.set(r.incomeEntryId, r._count._all);
    }
    return map;
  }

  async countsByExpense(): Promise<Map<string, number>> {
    const rows = await this.db.attachment.groupBy({
      by: ["expenseEntryId"],
      where: { expenseEntryId: { not: null } },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.expenseEntryId) map.set(r.expenseEntryId, r._count._all);
    }
    return map;
  }
}
