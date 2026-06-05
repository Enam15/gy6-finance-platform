import type { Partner, PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { PartnerRepository } from "@/repositories/partner-repository";

/**
 * Read-side partner service. Thin wrapper for now - the write path (adding
 * partners, changing share slices) is handled in seed today; a future UI
 * phase can add the write methods here.
 */
export class PartnerService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listActive(): Promise<Partner[]> {
    return new PartnerRepository(this.db).listActive();
  }

  findById(id: string): Promise<Partner | null> {
    return new PartnerRepository(this.db).findById(id);
  }
}
