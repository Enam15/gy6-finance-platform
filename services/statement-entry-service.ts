import type {
  PrismaClient,
  StatementEntry,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { StatementEntryRepository } from "@/repositories/statement-entry-repository";

/**
 * Default cap on ledger queries. Large enough to fill the global /ledger
 * feed and a typical per-account drilldown without pagination in Phase 2B.
 */
const DEFAULT_LIMIT = 100;

/**
 * Read-side service over the immutable ledger. Writes never go through
 * here - every posting passes through PostingService inside a transaction.
 */
export class StatementEntryService {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Most-recent ledger entries, newest first by effective date. */
  listRecent(limit: number = DEFAULT_LIMIT): Promise<StatementEntry[]> {
    return new StatementEntryRepository(this.db).listRecent(limit);
  }

  /**
   * All ledger entries touching `accountId` on either the debit or credit
   * side, newest first. Used by /accounts/[id].
   */
  listByAccount(
    accountId: string,
    limit: number = DEFAULT_LIMIT,
  ): Promise<StatementEntry[]> {
    return new StatementEntryRepository(this.db).listByAccount(
      accountId,
      limit,
    );
  }

  /**
   * Every ledger entry. Used by /api/ledger/export. Order is by
   * effectiveDate then createdAt; default is desc to match the page view.
   */
  listAll(order: "asc" | "desc" = "desc"): Promise<StatementEntry[]> {
    return new StatementEntryRepository(this.db).listAll(order);
  }

  /**
   * Every ledger entry touching `accountId` on either side. Default order
   * is ascending so the per-account statement reads chronologically.
   */
  listAllByAccount(
    accountId: string,
    order: "asc" | "desc" = "asc",
  ): Promise<StatementEntry[]> {
    return new StatementEntryRepository(this.db).listAllByAccount(
      accountId,
      order,
    );
  }
}
