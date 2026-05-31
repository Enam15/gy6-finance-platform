import type {
  StatementEntry,
  StatementEntryType,
  StatementSourceType,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

/**
 * Fields accepted when creating a statement entry. Every field is mandatory
 * because the ledger is append-only: a posting must be fully specified at
 * write time and is never amended afterward.
 */
export interface CreateStatementEntryData {
  transactionGroupId: string;
  entryType: StatementEntryType;
  debitAccountId: string;
  creditAccountId: string;
  amount: bigint;
  description: string;
  effectiveDate: Date;
  sourceType: StatementSourceType;
  sourceId: string;
  reversesEntryId?: string | null;
  createdBy?: string | null;
}

/**
 * Data access for the immutable ledger. Statement entries are append-only:
 * this repository exposes create and read operations only - no update or
 * delete. A database trigger blocks UPDATE / DELETE even if called from
 * raw SQL.
 */
export class StatementEntryRepository {
  constructor(private readonly db: DbClient) {}

  create(data: CreateStatementEntryData): Promise<StatementEntry> {
    return this.db.statementEntry.create({
      data: {
        transactionGroupId: data.transactionGroupId,
        entryType: data.entryType,
        debitAccountId: data.debitAccountId,
        creditAccountId: data.creditAccountId,
        amount: data.amount,
        description: data.description,
        effectiveDate: data.effectiveDate,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        reversesEntryId: data.reversesEntryId ?? null,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  findById(id: string): Promise<StatementEntry | null> {
    return this.db.statementEntry.findUnique({ where: { id } });
  }

  listByGroup(transactionGroupId: string): Promise<StatementEntry[]> {
    return this.db.statementEntry.findMany({
      where: { transactionGroupId },
      orderBy: { createdAt: "asc" },
    });
  }

  listBySource(
    sourceType: StatementSourceType,
    sourceId: string,
  ): Promise<StatementEntry[]> {
    return this.db.statementEntry.findMany({
      where: { sourceType, sourceId },
      orderBy: { createdAt: "asc" },
    });
  }
}
