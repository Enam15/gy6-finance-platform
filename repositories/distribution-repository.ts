import type {
  Distribution,
  DistributionShare,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

/** Distribution row with its per-partner shares populated. */
export type DistributionWithShares = Distribution & {
  shares: DistributionShare[];
};

export interface CreateDistributionData {
  quarterStart: Date;
  netAmount: bigint;
  sourceAccountId: string;
  description?: string | null;
  effectiveDate: Date;
  createdBy?: string | null;
}

export interface CreateDistributionShareData {
  distributionId: string;
  partnerId: string;
  ratio: number;
  ratioDenominator: number;
  amount: bigint;
}

/** Data access for Distribution + DistributionShare. No business logic. */
export class DistributionRepository {
  constructor(private readonly db: DbClient) {}

  findById(id: string): Promise<Distribution | null> {
    return this.db.distribution.findUnique({ where: { id } });
  }

  findByIdWithShares(id: string): Promise<DistributionWithShares | null> {
    return this.db.distribution.findUnique({
      where: { id },
      include: { shares: true },
    });
  }

  /** All distributions with their shares, newest first by effective date. */
  listAll(): Promise<DistributionWithShares[]> {
    return this.db.distribution.findMany({
      include: { shares: true },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    });
  }

  create(data: CreateDistributionData): Promise<Distribution> {
    return this.db.distribution.create({
      data: {
        quarterStart: data.quarterStart,
        netAmount: data.netAmount,
        sourceAccountId: data.sourceAccountId,
        description: data.description ?? null,
        effectiveDate: data.effectiveDate,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  createShare(data: CreateDistributionShareData): Promise<DistributionShare> {
    return this.db.distributionShare.create({
      data: {
        distributionId: data.distributionId,
        partnerId: data.partnerId,
        ratio: data.ratio,
        ratioDenominator: data.ratioDenominator,
        amount: data.amount,
      },
    });
  }
}
