import { z } from "zod";
import type {
  CategoryKind,
  PrismaClient,
  RenewalTemplate,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type Result } from "@/lib/result";
import { addDaysUtc, advanceByRecurrence, todayUtc } from "@/lib/dates";
import { AccountRepository } from "@/repositories/account-repository";
import { AuditLogRepository } from "@/repositories/audit-log-repository";
import { ExpenseEntryRepository } from "@/repositories/expense-entry-repository";
import { IncomeEntryRepository } from "@/repositories/income-entry-repository";
import { RenewalTemplateRepository } from "@/repositories/renewal-template-repository";
import { TransactionCategoryRepository } from "@/repositories/transaction-category-repository";

const createSchema = z.object({
  kind: z.enum(["INCOME", "EXPENSE"]),
  name: z.string().trim().min(1, "Name is required").max(120),
  accountId: z.string().min(1, "An account is required"),
  categoryId: z.string().min(1, "A category is required"),
  description: z.string().trim().min(1, "Description is required").max(500),
  totalAmount: z.coerce.bigint().refine((v) => v > 0n, "Total must be positive"),
  paymentTermsDays: z.coerce.number().int().min(0).max(3650).default(0),
  intervalCount: z.coerce.number().int().min(1).max(120),
  intervalUnit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]),
  firstRunOn: z.coerce.date(),
  endOn: z.coerce.date().optional(),
});

export type CreateRenewalTemplateInput = z.infer<typeof createSchema>;

interface ActorOptions {
  actorId?: string | null;
  actorLabel?: string | null;
}

/** Per-template result of a generation run. */
export interface GeneratedTemplateResult {
  templateId: string;
  templateName: string;
  kind: CategoryKind;
  entriesCreated: number;
}

/** What generateDue reports back. */
export interface GenerateSummary {
  totalCreated: number;
  templates: GeneratedTemplateResult[];
}

/**
 * Cap on how many occurrences a single Generate run materialises per
 * template. Bounds a runaway loop (e.g. a daily template years stale)
 * without losing data - nextRunOn is left at the next ungenerated
 * occurrence, so the following Generate continues where this stopped.
 */
const MAX_OCCURRENCES_PER_RUN = 60;

/**
 * Recurring-renewal business logic.
 *
 * A template is a recipe; "generating" it materialises DRAFT income/expense
 * entries - it never posts to the ledger (the user confirms the drafts
 * separately, exactly like a manually entered draft). Generation is
 * idempotent under concurrency: each template row is locked FOR UPDATE and
 * re-read inside its own transaction before any drafts are created.
 *
 * Catch-up: one generateDue call produces a separate, correctly-dated
 * DRAFT for every occurrence whose nextRunOn has arrived (bounded by
 * MAX_OCCURRENCES_PER_RUN), advancing nextRunOn each step. This keeps the
 * dashboard's entry-date bucketing accurate for back-periods.
 */
export class RenewalService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listTemplates(): Promise<RenewalTemplate[]> {
    return new RenewalTemplateRepository(this.db).listAll();
  }

  async createTemplate(
    input: unknown,
    options: ActorOptions = {},
  ): Promise<Result<RenewalTemplate>> {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return err(parsed.error.issues.map((i) => i.message).join("; "));
    }
    const data = parsed.data;

    if (data.endOn && data.endOn.getTime() < data.firstRunOn.getTime()) {
      return err("End date must be on or after the first run date");
    }

    const account = await new AccountRepository(this.db).findById(
      data.accountId,
    );
    if (!account) return err(`Account ${data.accountId} was not found`);

    const category = await new TransactionCategoryRepository(this.db).findById(
      data.categoryId,
    );
    if (!category) return err(`Category ${data.categoryId} was not found`);
    if (category.kind !== data.kind) {
      return err(
        `Category "${category.name}" is ${category.kind}; it cannot back a ${data.kind} renewal`,
      );
    }

    const template = await this.db.$transaction(async (tx) => {
      const created = await new RenewalTemplateRepository(tx).create({
        kind: data.kind,
        name: data.name,
        accountId: data.accountId,
        categoryId: data.categoryId,
        description: data.description,
        totalAmount: data.totalAmount,
        paymentTermsDays: data.paymentTermsDays,
        intervalCount: data.intervalCount,
        intervalUnit: data.intervalUnit,
        nextRunOn: data.firstRunOn,
        endOn: data.endOn ?? null,
        createdBy: options.actorId ?? null,
      });
      await new AuditLogRepository(tx).record({
        action: "CREATE",
        entityType: "RenewalTemplate",
        entityId: created.id,
        summary: `Renewal template "${created.name}" created (${created.kind}, every ${created.intervalCount} ${created.intervalUnit})`,
        after: {
          id: created.id,
          kind: created.kind,
          totalAmount: created.totalAmount.toString(),
          nextRunOn: created.nextRunOn.toISOString().slice(0, 10),
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return created;
    });

    return ok(template);
  }

  /**
   * Pause or reactivate a template. Pausing leaves nextRunOn untouched, so
   * reactivating later resumes (and catches up) from where it left off.
   */
  async setActive(
    id: string,
    isActive: boolean,
    options: ActorOptions = {},
  ): Promise<Result<RenewalTemplate>> {
    const existing = await new RenewalTemplateRepository(this.db).findById(id);
    if (!existing) return err(`Renewal template ${id} was not found`);
    if (existing.isActive === isActive) return ok(existing);

    const updated = await this.db.$transaction(async (tx) => {
      const u = await new RenewalTemplateRepository(tx).setActive(id, isActive);
      await new AuditLogRepository(tx).record({
        action: "UPDATE",
        entityType: "RenewalTemplate",
        entityId: id,
        summary: `Renewal template "${u.name}" ${isActive ? "reactivated" : "paused"}`,
        before: { isActive: existing.isActive },
        after: { isActive: u.isActive },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });
      return u;
    });

    return ok(updated);
  }

  /**
   * Generate DRAFT entries for every template due on or before `asOf`.
   * Each template is processed in its own transaction (a failure on one
   * doesn't undo another). Returns a summary of what was created.
   */
  async generateDue(
    options: ActorOptions = {},
    asOf: Date = todayUtc(),
  ): Promise<Result<GenerateSummary>> {
    const dueTemplates = await new RenewalTemplateRepository(this.db).listDue(
      asOf,
    );

    const results: GeneratedTemplateResult[] = [];
    let totalCreated = 0;

    for (const template of dueTemplates) {
      const created = await this.generateForTemplate(template.id, asOf, options);
      if (created > 0) {
        results.push({
          templateId: template.id,
          templateName: template.name,
          kind: template.kind,
          entriesCreated: created,
        });
        totalCreated += created;
      }
    }

    return ok({ totalCreated, templates: results });
  }

  /**
   * Materialise the due occurrences of a single template inside one
   * transaction. The row is locked FOR UPDATE and re-read so a concurrent
   * Generate cannot double-produce. Returns the number of drafts created.
   */
  private async generateForTemplate(
    templateId: string,
    asOf: Date,
    options: ActorOptions,
  ): Promise<number> {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM renewal_templates WHERE id = ${templateId} FOR UPDATE`;
      const template = await tx.renewalTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template || !template.isActive) return 0;

      let runOn = template.nextRunOn;
      let count = 0;
      let firstDate: Date | null = null;
      let lastDate: Date | null = null;

      while (
        runOn.getTime() <= asOf.getTime() &&
        (template.endOn === null || runOn.getTime() <= template.endOn.getTime()) &&
        count < MAX_OCCURRENCES_PER_RUN
      ) {
        const entryDate = runOn;
        const paymentDueOn = addDaysUtc(entryDate, template.paymentTermsDays);

        if (template.kind === "INCOME") {
          await new IncomeEntryRepository(tx).create({
            clientAccountId: template.accountId,
            categoryId: template.categoryId,
            description: template.description,
            totalAmount: template.totalAmount,
            entryDate,
            paymentDueOn,
            renewalTemplateId: template.id,
            createdBy: options.actorId ?? null,
          });
        } else {
          await new ExpenseEntryRepository(tx).create({
            payeeAccountId: template.accountId,
            categoryId: template.categoryId,
            description: template.description,
            totalAmount: template.totalAmount,
            entryDate,
            paymentDueOn,
            renewalTemplateId: template.id,
            createdBy: options.actorId ?? null,
          });
        }

        if (firstDate === null) firstDate = entryDate;
        lastDate = entryDate;
        count += 1;
        runOn = advanceByRecurrence(
          runOn,
          template.intervalCount,
          template.intervalUnit,
        );
      }

      if (count === 0) return 0;

      await new RenewalTemplateRepository(tx).markGenerated(
        template.id,
        runOn,
        new Date(),
      );
      await new AuditLogRepository(tx).record({
        action: "RENEW",
        entityType: "RenewalTemplate",
        entityId: template.id,
        summary: `Generated ${count} draft ${template.kind.toLowerCase()} entr${count === 1 ? "y" : "ies"} from "${template.name}"`,
        after: {
          entriesCreated: count,
          fromDate: firstDate?.toISOString().slice(0, 10) ?? null,
          toDate: lastDate?.toISOString().slice(0, 10) ?? null,
          nextRunOn: runOn.toISOString().slice(0, 10),
        },
        actorId: options.actorId ?? null,
        actorLabel: options.actorLabel ?? null,
      });

      return count;
    });
  }
}
