import type {
  CategoryKind,
  RecurrenceUnit,
  RenewalTemplate,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

export interface CreateRenewalTemplateData {
  kind: CategoryKind;
  name: string;
  accountId: string;
  categoryId: string;
  description: string;
  totalAmount: bigint;
  paymentTermsDays: number;
  intervalCount: number;
  intervalUnit: RecurrenceUnit;
  nextRunOn: Date;
  endOn?: Date | null;
  createdBy?: string | null;
}

/** Data access for renewal templates. Contains no business logic. */
export class RenewalTemplateRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<RenewalTemplate | null> {
    return this.db.renewalTemplate.findUnique({ where: { id } });
  }

  /** All templates: active first, then soonest-due first. */
  listAll(): Promise<RenewalTemplate[]> {
    return this.db.renewalTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { nextRunOn: "asc" }],
    });
  }

  /** Active templates whose nextRunOn has arrived on or before `asOf`. */
  listDue(asOf: Date): Promise<RenewalTemplate[]> {
    return this.db.renewalTemplate.findMany({
      where: { isActive: true, nextRunOn: { lte: asOf } },
      orderBy: { nextRunOn: "asc" },
    });
  }

  create(data: CreateRenewalTemplateData): Promise<RenewalTemplate> {
    return this.db.renewalTemplate.create({
      data: {
        kind: data.kind,
        name: data.name,
        accountId: data.accountId,
        categoryId: data.categoryId,
        description: data.description,
        totalAmount: data.totalAmount,
        paymentTermsDays: data.paymentTermsDays,
        intervalCount: data.intervalCount,
        intervalUnit: data.intervalUnit,
        nextRunOn: data.nextRunOn,
        endOn: data.endOn ?? null,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  /** Advance nextRunOn and stamp lastGeneratedAt after a generation run. */
  markGenerated(
    id: string,
    nextRunOn: Date,
    lastGeneratedAt: Date,
  ): Promise<RenewalTemplate> {
    return this.db.renewalTemplate.update({
      where: { id },
      data: { nextRunOn, lastGeneratedAt },
    });
  }
}
