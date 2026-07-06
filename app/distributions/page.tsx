import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountService } from "@/services/account-service";
import { DistributionService } from "@/services/distribution-service";
import { PartnerService } from "@/services/partner-service";
import { formatMoney, money } from "@/lib/money";
import { quarterStart } from "@/lib/dates";
import { RunDistributionDialog } from "./_components/run-distribution-dialog";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function quarterLabel(d: Date): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${d.getUTCFullYear()}`;
}

function previousQuarterStart(at: Date): Date {
  const q = quarterStart(at);
  return new Date(Date.UTC(q.getUTCFullYear(), q.getUTCMonth() - 3, 1));
}

function buildQuarterOptions(
  n: number,
  at: Date,
): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = [];
  let q = quarterStart(at);
  for (let i = 0; i < n; i++) {
    result.push({
      value: q.toISOString().slice(0, 10),
      label: quarterLabel(q),
    });
    q = new Date(Date.UTC(q.getUTCFullYear(), q.getUTCMonth() - 3, 1));
  }
  return result;
}

export default async function DistributionsPage() {
  const at = new Date();

  const [distributions, businessAccounts, partners] = await Promise.all([
    new DistributionService().listAll(),
    new AccountService().listBusinessAccounts(),
    new PartnerService().listActive(),
  ]);

  const partnerNameById = new Map(partners.map((p) => [p.id, p.name]));
  const accountNameById = new Map(
    businessAccounts.map((a) => [a.id, a.name]),
  );

  const quarterOptions = buildQuarterOptions(8, at);
  const defaultQuarter = previousQuarterStart(at).toISOString().slice(0, 10);

  const canRun = businessAccounts.length > 0 && partners.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Distributions
          </h1>
          <p className="text-sm text-muted-foreground">
            Quarterly split of net profit across partners. Each run posts the
            founder drawings to the ledger automatically from your Business
            account.
          </p>
        </div>
        {canRun ? (
          <RunDistributionDialog
            quarterOptions={quarterOptions}
            defaultQuarterStart={defaultQuarter}
          />
        ) : (
          <span className="max-w-xs text-right text-sm text-muted-foreground">
            Set up at least one Business account and one Partner to run
            distributions.
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All distributions ({distributions.length})</CardTitle>
          <CardDescription>Newest first by effective date.</CardDescription>
        </CardHeader>
        <CardContent>
          {distributions.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No distributions recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective</TableHead>
                  <TableHead>Quarter</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Shares</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(d.effectiveDate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {quarterLabel(d.quarterStart)}
                    </TableCell>
                    <TableCell>
                      {accountNameById.get(d.sourceAccountId) ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(money(d.netAmount))}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {d.shares.map((s) => (
                          <div
                            key={s.id}
                            className="flex justify-between gap-3 tabular-nums"
                          >
                            <span>
                              {partnerNameById.get(s.partnerId) ?? "Unknown"}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({s.ratio}/{s.ratioDenominator})
                              </span>
                            </span>
                            <span>{formatMoney(money(s.amount))}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
