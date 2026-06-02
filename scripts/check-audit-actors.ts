import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Diagnostic: print the most recent audit_log rows with their actor info,
 * and show the share of rows that have actor_id populated. Useful after the
 * T35 retrofit to confirm the wiring works end to end.
 *
 *   npm exec tsx scripts/check-audit-actors.ts
 */
async function main(): Promise<void> {
  const recent = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  console.log(`Latest ${recent.length} audit_log entries:`);
  console.log(
    "  when                       action     entity                actor",
  );
  console.log(
    "  -------------------------  ---------  --------------------  --------------------",
  );
  for (const row of recent) {
    const when = row.createdAt.toISOString().replace("T", " ").slice(0, 19);
    const actor = row.actorLabel ?? row.actorId ?? "(none)";
    console.log(
      `  ${when}  ${row.action.padEnd(9)}  ${row.entityType.padEnd(20)}  ${actor}`,
    );
  }

  const total = await prisma.auditLog.count();
  const withActor = await prisma.auditLog.count({
    where: { actorId: { not: null } },
  });
  const pct = total === 0 ? 0 : Math.round((100 * withActor) / total);
  console.log("");
  console.log(`Total rows:        ${total}`);
  console.log(`With actor_id:     ${withActor} (${pct}%)`);
  console.log(
    "Pre-T35 rows are expected to have actor_id=null; only post-T35 writes are attributed.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
