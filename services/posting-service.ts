import { randomUUID } from "node:crypto";
import type {
  AuditAction,
  PrismaClient,
  StatementEntry,
  StatementEntryType,
  StatementSourceType,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { StatementEntryRepository } from "@/repositories/statement-entry-repository";

/** A single balanced debit/credit posting. The same amount lands on both
 *  sides; only its effect on each account's balance differs, based on
 *  the account's normal balance. */
export interface PostingLine {
  debitAccountId: string;
  creditAccountId: string;
  /** Positive minor units. */
  amount: bigint;
  /** Optional per-posting description; falls back to the group description. */
  description?: string;
}

/**
 * A request to post one or more balanced statement entries as a single
 * transaction group. Most callers post a single line; compound postings
 * (e.g. a transfer with a bank fee) supply multiple lines that share a
 * transactionGroupId.
 */
export interface PostingRequest {
  /** Auto-generated if omitted. */
  transactionGroupId?: string;
  entryType: StatementEntryType;
  sourceType: StatementSourceType;
  sourceId: string;
  effectiveDate: Date;
  description: string;
  postings: PostingLine[];
  /** Set when posting a reversal. The link is recorded on the first posting. */
  reversesEntryId?: string | null;
  actorId?: string | null;
  actorLabel?: string | null;
}

export interface PostingResult {
  transactionGroupId: string;
  entries: StatementEntry[];
}

/**
 * The posting engine: the single chokepoint for writes to the ledger. Every
 * confirmed income, expense, payment, transfer, adjustment, and reversal
 * goes through here.
 *
 * In one database transaction it (1) locks the affected accounts in
 * deterministic id order to avoid deadlocks under concurrent posting,
 * (2) validates that no balance would silently go negative, (3) writes the
 * statement_entries, (4) updates the materialised account balances, and
 * (5) writes an audit log entry.
 */
export class PostingService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async post(request: PostingRequest): Promise<Result<PostingResult>> {
    const validation = validateRequest(request);
    if (!validation.ok) return err(validation.error);

    const transactionGroupId = request.transactionGroupId ?? randomUUID();
    const sortedAccountIds = [...collectAccountIds(request.postings)].sort();

    try {
      const entries = await this.db.$transaction(async (tx) => {
        // 1. Lock the affected accounts in id order to avoid deadlocks.
        for (const id of sortedAccountIds) {
          await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${id} FOR UPDATE`;
        }

        // 2. Load the locked rows.
        const accounts = await tx.account.findMany({
          where: { id: { in: sortedAccountIds } },
        });
        if (accounts.length !== sortedAccountIds.length) {
          const found = new Set(accounts.map((a) => a.id));
          const missing = sortedAccountIds.filter((id) => !found.has(id));
          throw new PostingFailure(`Account(s) not found: ${missing.join(", ")}`);
        }
        for (const account of accounts) {
          if (!account.isActive) {
            throw new PostingFailure(
              `Account "${account.name}" (${account.id}) is inactive`,
            );
          }
        }
        const accountMap = new Map(accounts.map((a) => [a.id, a]));

        // 3. Compute the net balance delta per affected account.
        const deltas = new Map<string, bigint>();
        for (const posting of request.postings) {
          const debit = accountMap.get(posting.debitAccountId);
          const credit = accountMap.get(posting.creditAccountId);
          if (!debit || !credit) {
            // Unreachable: account ids were sourced from these very postings.
            throw new PostingFailure("Internal: account not loaded");
          }
          const debitDelta =
            debit.normalBalance === "DEBIT" ? posting.amount : -posting.amount;
          const creditDelta =
            credit.normalBalance === "CREDIT"
              ? posting.amount
              : -posting.amount;
          deltas.set(
            posting.debitAccountId,
            (deltas.get(posting.debitAccountId) ?? 0n) + debitDelta,
          );
          deltas.set(
            posting.creditAccountId,
            (deltas.get(posting.creditAccountId) ?? 0n) + creditDelta,
          );
        }

        // 4. Reject if any account would drop below zero without permission.
        for (const [accountId, delta] of deltas) {
          const account = accountMap.get(accountId);
          if (!account) continue;
          const newBalance = account.balance + delta;
          if (newBalance < 0n && !account.allowNegative) {
            throw new PostingFailure(
              `Account "${account.name}" would go to ${newBalance} (current ${account.balance}, delta ${delta}); set allowNegative to permit`,
            );
          }
        }

        // 5. Write the statement entries.
        const entryRepo = new StatementEntryRepository(tx);
        const created: StatementEntry[] = [];
        for (const [index, posting] of request.postings.entries()) {
          const entry = await entryRepo.create({
            transactionGroupId,
            entryType: request.entryType,
            debitAccountId: posting.debitAccountId,
            creditAccountId: posting.creditAccountId,
            amount: posting.amount,
            description: posting.description ?? request.description,
            effectiveDate: request.effectiveDate,
            sourceType: request.sourceType,
            sourceId: request.sourceId,
            // The reversal link is recorded on the first posting only.
            reversesEntryId:
              index === 0 ? request.reversesEntryId ?? null : null,
            createdBy: request.actorId ?? null,
          });
          created.push(entry);
        }

        // 6. Apply the balance changes.
        for (const [accountId, delta] of deltas) {
          await tx.account.update({
            where: { id: accountId },
            data: { balance: { increment: delta } },
          });
        }

        // 7. Audit log entry summarising the posting batch.
        const totalAmount = request.postings.reduce(
          (sum, p) => sum + p.amount,
          0n,
        );
        await new AuditLogRepository(tx).record({
          action: request.reversesEntryId
            ? "REVERSE"
            : entryTypeToAuditAction(request.entryType),
          entityType: "StatementEntry",
          entityId: transactionGroupId,
          summary: `Posted ${created.length} statement entr${created.length === 1 ? "y" : "ies"} (${request.entryType.toLowerCase()})`,
          after: {
            transactionGroupId,
            entryType: request.entryType,
            sourceType: request.sourceType,
            sourceId: request.sourceId,
            postingsCount: created.length,
            totalAmount: totalAmount.toString(),
          },
          actorId: request.actorId ?? null,
          actorLabel: request.actorLabel ?? null,
        });

        return created;
      });

      return ok({ transactionGroupId, entries });
    } catch (error) {
      if (error instanceof PostingFailure) {
        return err(error.message);
      }
      throw error;
    }
  }
}

/** Internal error used to short-circuit the transaction with a domain
 *  failure that we convert into a Result.err at the boundary. */
class PostingFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostingFailure";
  }
}

function validateRequest(request: PostingRequest): Result<undefined> {
  if (request.postings.length === 0) {
    return err("At least one posting line is required");
  }
  for (const [i, posting] of request.postings.entries()) {
    if (posting.amount <= 0n) {
      return err(
        `Posting #${i + 1}: amount must be positive (got ${posting.amount})`,
      );
    }
    if (posting.debitAccountId === posting.creditAccountId) {
      return err(`Posting #${i + 1}: debit and credit accounts must differ`);
    }
  }
  return ok(undefined);
}

function collectAccountIds(postings: readonly PostingLine[]): Set<string> {
  const ids = new Set<string>();
  for (const posting of postings) {
    ids.add(posting.debitAccountId);
    ids.add(posting.creditAccountId);
  }
  return ids;
}

function entryTypeToAuditAction(entryType: StatementEntryType): AuditAction {
  switch (entryType) {
    case "INCOME":
    case "EXPENSE":
    case "PAYMENT":
    case "OPENING_BALANCE":
      return "CONFIRM";
    case "TRANSFER":
      return "TRANSFER";
    case "ADJUSTMENT":
      return "ADJUST";
    case "REVERSAL":
      return "REVERSE";
  }
}
