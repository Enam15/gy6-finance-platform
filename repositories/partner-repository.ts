import type {
  Partner,
  PartnerShareSlice,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

/** A partner paired with the share slice active at a given date. */
export interface ActivePartnerShare {
  partner: Partner;
  slice: PartnerShareSlice;
}

/** Data access for Partner + PartnerShareSlice. No business logic. */
export class PartnerRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<Partner | null> {
    return this.db.partner.findUnique({ where: { id } });
  }

  findByName(name: string): Promise<Partner | null> {
    return this.db.partner.findUnique({ where: { name } });
  }

  /** Active partners, ordered by name. */
  listActive(): Promise<Partner[]> {
    return this.db.partner.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  /**
   * For each active partner, the most recent PartnerShareSlice with
   * effectiveFrom <= `at`. Partners with no applicable slice (i.e. none
   * has been set up before `at`) are omitted from the result.
   *
   * Linear in the number of active partners. Fine for the agency scale
   * (handful of partners); revisit if that grows.
   */
  async findActiveSlicesAt(at: Date): Promise<ActivePartnerShare[]> {
    const partners = await this.listActive();
    const result: ActivePartnerShare[] = [];
    for (const partner of partners) {
      const slice = await this.db.partnerShareSlice.findFirst({
        where: {
          partnerId: partner.id,
          effectiveFrom: { lte: at },
        },
        orderBy: { effectiveFrom: "desc" },
      });
      if (slice) {
        result.push({ partner, slice });
      }
    }
    return result;
  }
}
