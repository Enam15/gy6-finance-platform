import { z } from "zod";
import type {
  Distribution,
  PrismaClient,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { allocateMoney, type Money } from "@/lib/money";
import { quarterEndExclusive, quarterStart } from "@/lib/dates";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import {
  DistributionRepository,
  type DistributionWithShares,
} from "@/repositories/distribution-repository";
import { PartnerRepository } from "@/repositories/partner-repository";
import { ExpenseService } from "@/services/expense-service";
import { IncomeService } from "@/services/income-service";
import { PostingFailure, PostingService } from "@/services/posting-service";

const runSchema = z.object({
  quarterStart: z.coerce.date(),
  // Optional: when omitted the service auto-picks the primary Business
  // account. The UI no longer asks the user to choose one.
  sourceAccountId: z.string().min(1).optional(),
  description: z.string().trim().max(500).optional(),
  effectiveDate: z.coerce.date().optional(),
});

const previewSchema = z.object({
  quarterStart: z.coerce.date(),
});

export type RunDistributionInput = z.infer<typeof runSchema>;
export type PreviewDistributionInput = z.infer<typeof previewSchema>;

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

/** One row in the preview / actual distribution. */
export interface DistributionShareView {
  partnerId: string;
  partnerName: string;
  ratio: number;
  ratioDenominator: number;
  amount: bigint;
}

/** What the dialog renders before the user clicks "Run". */
export interface DistributionPreview {
  quarterStart: Date;
  quarterEndExclusive: Date;
  income: bigint;
  expense: bigint;
  netAmount: bigint;
  /** Empty when netAmount <= 0; the UI shows "nothing to distribute". */
  shares: DistributionShareView[];
}

/**
 * Profit-distribution business logic.
 *
 * Net is computed accrual-style for [quarterStart, quarterEndExclusive)
 * via the existing period aggregates: sigma CONFIRMED income totalAmount
 * minus sigma CONFIRMED expense totalAmount. Net <= 0 is refused at run
 * time (no loss absorption).
 *
 * Allocation uses lib/money/allocateMoney (largest-remainder) over the
 * partners active at quarter end, with their snapshotted ratios.
 *
 * runQuarter writes everything in one DB transaction: per-partner
 * postings via PostingService (DR Founder_i / CR Business), the
 * Distribution row, the DistributionShare rows, and an audit log entry.
 * Either it all lands or none of it does.
 */
export class DistributionService {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** All distributions with their shares included. Newest first. */
  listAll(): Promise<DistributionWithShares[]> {
    return new DistributionRepository(this.db).listAll();
  }

  /**
   * Compute the preview for a quarter (no writes). `quarterStart` is
   * normalised to the actual start of the calendar quarter containing
   * the input date.
   */
  async computeQuarter(
    input: unknown,
  ): Promise<Result<DistributionPreview>> {
    const parsed = previewSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }

    const qStart = quarterStart(parsed.data.quarterStart);
    const qEnd = quarterEndExclusive(parsed.data.quarterStart);

    // Resolve active partners at quarter end (so a partner added on the
    // last day of the quarter is included).
    const [income, expense, partnerShares] = await Promise.all([
      new IncomeService(this.db).sumTotalInPeriod(qStart, qEnd),
      new ExpenseService(this.db).sumTotalInPeriod(qStart, qEnd),
      new PartnerRepository(this.db).findActiveSlicesAt(qEnd),
    ]);

    const netAmount = income - expense;

    if (partnerShares.length === 0 || netAmount <= 0n) {
      // No partners or nothing to allocate: empty shares; UI shows the
      // net (possibly negative) and disables Run.
      return ok({
        quarterStart: qStart,
        quarterEndExclusive: qEnd,
        income,
        expense,
        netAmount,
        shares: [],
      });
    }

    const ratios = partnerShares.map((p) => BigInt(p.slice.ratio));
    const ratioDenominator = partnerShares.reduce(
      (sum, p) => sum + p.slice.ratio,
      0,
    );
    const allocated = allocateMoney(netAmount as Money, ratios);

    const shares: DistributionShareView[] = partnerShares.map((p, i) => ({
      partnerId: p.partner.id,
      partnerName: p.partner.name,
      ratio: p.slice.ratio,
      ratioDenominator,
      amount: allocated[i] ?? 0n,
    }));

    return ok({
      quarterStart: qStart,
      quarterEndExclusive: qEnd,
      income,
      expense,
      netAmount,
      shares,
    });
  }

  /**
   * Run the distribution for a quarter. Re-computes the preview
   * server-side - the client's preview is informational only.
   */
  async runQuarter(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<Distribution>> {
    const parsed = runSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;
    const effectiveDate = data.effectiveDate ?? new Date();

    // Resolve the source Business account. When the caller doesn't specify
    // one (the default now), auto-pick the primary = oldest active Business
    // account, so the user never has to choose.
    let sourceAccountId = data.sourceAccountId ?? null;
    if (!sourceAccountId) {
      const primary = await this.db.account.findFirst({
        where: { category: { key: "BUSINESS" }, isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (!primary) {
        return err("No Business account exists to distribute from");
      }
      sourceAccountId = primary.id;
    }

    // Source account must exist and sit under BUSINESS.
    const source = await this.db.account.findUnique({
      where: { id: sourceAccountId },
      include: { category: true },
    });
    if (!source) {
      return err(`Source account ${sourceAccountId} was not found`);
    }
    if (source.category.key !== "BUSINESS") {
      return err(
        `Source account "${source.name}" is in category ${source.category.key}; distribution requires a Business account`,
      );
    }

    const previewResult = await this.computeQuarter({
      quarterStart: data.quarterStart,
    });
    if (!previewResult.ok) return err(previewResult.error);
    const preview = previewResult.value;

    if (preview.netAmount <= 0n) {
      return err(
        `Nothing to distribute for the quarter (net = ${preview.netAmount})`,
      );
    }
    if (preview.shares.length === 0) {
      return err("No partners are eligible for this quarter");
    }

    // Resolve each partner's Founder account id once.
    const partnerRecords = await this.db.partner.findMany({
      where: { id: { in: preview.shares.map((s) => s.partnerId) } },
    });
    const founderByPartnerId = new Map(
      partnerRecords.map((p) => [p.id, p.founderAccountId]),
    );

    const q = preview.quarterStart;
    const qLabel = `Q${Math.floor(q.getUTCMonth() / 3) + 1} ${q.getUTCFullYear()}`;
    const description =
      data.description ?? `Profit distribution: ${qLabel}`;

    try {
      const created = await this.db.$transaction(async (tx) => {
        const distribution = await new DistributionRepository(tx).create({
          quarterStart: preview.quarterStart,
          netAmount: preview.netAmount,
          sourceAccountId,
          description: data.description ?? null,
          effectiveDate,
          createdBy: options.actorId ?? null,
        });

        const postings = preview.shares.map((share) => {
          const founderId = founderByPartnerId.get(share.partnerId);
          if (!founderId) {
            throw new Error(
              `Internal: missing Founder account for partner ${share.partnerId}`,
            );
          }
          return {
            debitAccountId: founderId,
            creditAccountId: sourceAccountId,
            amount: share.amount,
          };
        });

        await new PostingService().post(tx, {
          entryType: "DISTRIBUTION",
          sourceType: "DISTRIBUTION",
          sourceId: distribution.id,
          effectiveDate,
          description,
          postings,
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });

        // Persist DistributionShare rows AFTER the postings - if a posting
        // is refused (e.g. source overdraw), the whole transaction rolls
        // back including the Distribution row.
        for (const share of preview.shares) {
          await new DistributionRepository(tx).createShare({
            distributionId: distribution.id,
            partnerId: share.partnerId,
            ratio: share.ratio,
            ratioDenominator: share.ratioDenominator,
            amount: share.amount,
          });
        }

        await new AuditLogRepository(tx).record({
          action: "TRANSFER",
          entityType: "Distribution",
          entityId: distribution.id,
          summary: `Distribution ${qLabel}: ${preview.netAmount.toString()} across ${preview.shares.length} partner(s)`,
          after: {
            id: distribution.id,
            quarterStart: preview.quarterStart.toISOString().slice(0, 10),
            netAmount: preview.netAmount.toString(),
            sourceAccountId,
            shares: preview.shares.map((s) => ({
              partnerId: s.partnerId,
              partnerName: s.partnerName,
              ratio: s.ratio,
              ratioDenominator: s.ratioDenominator,
              amount: s.amount.toString(),
            })),
          },
          actorId: options.actorId ?? null,
          actorLabel: options.actorLabel ?? null,
        });

        return distribution;
      });
      return ok(created);
    } catch (error) {
      if (error instanceof PostingFailure) return err(error.message);
      throw error;
    }
  }
}
