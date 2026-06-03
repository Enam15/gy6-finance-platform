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
import { MonthlyIncomeExpenseChart } from "@/components/monthly-income-expense-chart";

export const dynamic = "force-dynamic";

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

function quarterLabel(at: Date): string {
  const q = Math.floor(at.getUTCMonth() / 3) + 1;
  return `Q${q} ${at.getUTCFullYear()}`;
}

export default async function DashboardPage() {
  const session = await auth();
  const userFirstName = (session?.user?.name ?? "there").split(" ")[0];

  const at = new Date();
  const kpis = await new DashboardService().getKpis(at);

  const chartPoints = kpis.monthly.map((m) => ({
    monthIso: m.monthStart.toISOString(),
    incomeMinor: m.income.toString(),
    expenseMinor: m.expense.toString(),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {userFirstName}. Real-time view of cash, receivables,
          payables, and the year so far.
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
            description="Sigma balance across Business accounts"
          />
          <MoneyCard
            label="Outstanding receivables"
            amount={kpis.outstandingReceivables}
            description="Sigma amount_due across confirmed income"
          />
          <MoneyCard
            label="Outstanding payables"
            amount={kpis.outstandingPayables}
            description="Sigma amount_due across confirmed expense"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {quarterLabel(at)}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyCard label="Income" amount={kpis.thisQuarter.income} />
          <MoneyCard label="Expense" amount={kpis.thisQuarter.expense} />
          <MoneyCard label="Net" amount={kpis.thisQuarter.net} toneOnSign />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {at.getUTCFullYear()} year-to-date
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyCard label="Income" amount={kpis.yearToDate.income} />
          <MoneyCard label="Expense" amount={kpis.yearToDate.expense} />
          <MoneyCard label="Net" amount={kpis.yearToDate.net} toneOnSign />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Last 12 months</CardTitle>
          <CardDescription>
            Confirmed income vs expense, bucketed by entry date (UTC).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyIncomeExpenseChart points={chartPoints} />
        </CardContent>
      </Card>
    </div>
  );
}
