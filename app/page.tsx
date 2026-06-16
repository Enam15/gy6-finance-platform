import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/auth";
import { DashboardService } from "@/services/dashboard-service";
import { formatMoney, money } from "@/lib/money";
import { DashboardCharts } from "@/components/dashboard-charts";
import {
  QuarterPicker,
  YearPicker,
} from "./_components/dashboard-period-pickers";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface MoneyCardProps {
  label: string;
  amount: bigint;
  description?: string;
  /** Green if positive, red if negative, neutral if zero. Use for net values. */
  toneOnSign?: boolean;
}

function MoneyCard({
  label,
  amount,
  description,
  toneOnSign = false,
}: MoneyCardProps) {
  let toneClass = "";
  if (toneOnSign) {
    if (amount > 0n) toneClass = "text-green-700 dark:text-green-400";
    else if (amount < 0n) toneClass = "text-red-700 dark:text-red-400";
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${toneClass}`}>
          {formatMoney(money(amount))}
        </CardTitle>
      </CardHeader>
      {description && (
        <CardContent className="text-xs text-muted-foreground">
          {description}
        </CardContent>
      )}
    </Card>
  );
}

/** Parse a single-valued numeric search param, or undefined. */
function numParam(v: string | string[] | undefined): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await auth();
  const userFirstName = (session?.user?.name ?? "there").split(" ")[0];

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentQuarter = Math.floor(now.getUTCMonth() / 3) + 1;

  const sp = await searchParams;
  const q = Math.min(4, Math.max(1, numParam(sp["q"]) ?? currentQuarter));
  const qYear = numParam(sp["qy"]) ?? currentYear;
  const yYear = numParam(sp["y"]) ?? currentYear;

  // Year options: current year and the previous four, plus any selected year.
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  for (const yr of [qYear, yYear]) {
    if (!years.includes(yr)) years.push(yr);
  }
  years.sort((a, b) => b - a);

  const service = new DashboardService();
  const [kpis, quarter, year] = await Promise.all([
    service.getKpis(now),
    service.quarterTotals(qYear, q),
    service.yearTotals(yYear),
  ]);

  const chartPoints = kpis.monthly.map((m) => ({
    monthIso: m.monthStart.toISOString(),
    incomeMinor: m.income.toString(),
    expenseMinor: m.expense.toString(),
  }));

  const yearSuffix = yYear === currentYear ? " year-to-date" : "";

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {userFirstName}. A live view of cash, receivables,
          payables, and the periods you choose.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Right now
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyCard
            label="Cash on hand"
            amount={kpis.cashOnHand}
            description="Total balance across Business accounts"
          />
          <MoneyCard
            label="Outstanding receivables"
            amount={kpis.outstandingReceivables}
            description="Total still owed to you (confirmed income)"
          />
          <MoneyCard
            label="Outstanding payables"
            amount={kpis.outstandingPayables}
            description="Total you still owe (confirmed expense)"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Q{q} {qYear}
          </h2>
          <QuarterPicker quarter={q} year={qYear} years={years} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyCard label="Income" amount={quarter.income} />
          <MoneyCard label="Expense" amount={quarter.expense} />
          <MoneyCard label="Net" amount={quarter.net} toneOnSign />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {yYear}
            {yearSuffix}
          </h2>
          <YearPicker year={yYear} years={years} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyCard label="Income" amount={year.income} />
          <MoneyCard label="Expense" amount={year.expense} />
          <MoneyCard label="Net" amount={year.net} toneOnSign />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Charts</CardTitle>
          <CardDescription>
            Visualise income, expense, net profit, and your current position.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardCharts
            points={chartPoints}
            cashMinor={kpis.cashOnHand.toString()}
            receivablesMinor={kpis.outstandingReceivables.toString()}
            payablesMinor={kpis.outstandingPayables.toString()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
