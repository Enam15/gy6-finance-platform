import type {
  AuditAction,
  AuditLog,
  Prisma,
} from "@/lib/generated/prisma/client";
import type { DbClient } from "@/lib/prisma";

/** Fields accepted when recording an audit log entry. */
export interface RecordAuditInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  actorId?: string | null;
  actorLabel?: string | null;
}

/**
 * Append-only audit trail. Entries are written, never updated or deleted -
 * corrections to the historical record are always new entries.
 */
export class AuditLogRepository {
  constructor(private readonly db: DbClient) {}

  record(input: RecordAuditInput): Promise<AuditLog> {
    return this.db.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
      },
    });
  }

  listForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.db.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  }
}
