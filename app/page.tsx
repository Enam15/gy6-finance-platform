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
import { monthRangesBack } from "@/lib/dates";
import { DashboardChartsLazy } from "./_components/dashboard-charts-lazy";
import {
  ChartRangeCalendar,
  ChartRangePicker,
  QuarterPicker,
  YearPicker,
} from "./_components/dashboard-period-pickers";

export const dynamic = "force-dynamic";

const CHART_RANGES = ["6m", "12m", "24m", "quarter", "year"] as const;
type ChartRange = (typeof CHART_RANGES)[number];

/**
 * The list of month-start dates (oldest first) a chart range covers. Rolling
 * windows count back from now; "quarter"/"year" follow the top pickers so
 * choosing a period up top reflects onto the charts.
 */
function monthsForRange(
  range: ChartRange,
  now: Date,
  quarter: number,
  quarterYear: number,
  year: number,
): Date[] {
  if (range === "quarter") {
    const startMonth = (quarter - 1) * 3;
    return [0, 1, 2].map((i) => new Date(Date.UTC(quarterYear, startMonth + i, 1)));
  }
  if (range === "year") {
    const lastMonth = year === now.getUTCFullYear() ? now.getUTCMonth() : 11;
    const months: Date[] = [];
    for (let m = 0; m <= lastMonth; m++) months.push(new Date(Date.UTC(year, m, 1)));
    return months;
  }
  const back = range === "6m" ? 6 : range === "24m" ? 24 : 12;
  return monthRangesBack(back, now);
}

function rangeLabel(
  range: ChartRange,
  quarter: number,
  quarterYear: number,
  year: number,
): string {
  switch (range) {
    case "6m":
      return "Last 6 months";
    case "24m":
      return "Last 24 months";
    case "quarter":
      return `Q${quarter} ${quarterYear}`;
    case "year":
      return `${year}`;
    default:
      return "Last 12 months";
  }
}

/** Parse a "yyyy-mm-dd" search param to a UTC date, or null. */
function parseIsoDate(v: string | string[] | undefined): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Month-start dates from `from`'s month to `to`'s month, inclusive (capped). */
function monthsBetween(from: Date, to: Date): Date[] {
  const months: Date[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  const endY = to.getUTCFullYear();
  const endM = to.getUTCMonth();
  while ((y < endY || (y === endY && m <= endM)) && months.length < 120) {
    months.push(new Date(Date.UTC(y, m, 1)));
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

function dateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

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

  const rangeParam = typeof sp["range"] === "string" ? sp["range"] : "";
  const range: ChartRange = CHART_RANGES.includes(rangeParam as ChartRange)
    ? (rangeParam as ChartRange)
    : "12m";

  // A custom calendar range (both dates set, from <= to) overrides the preset.
  const fromStr = typeof sp["from"] === "string" ? sp["from"] : "";
  const toStr = typeof sp["to"] === "string" ? sp["to"] : "";
  const fromDate = parseIsoDate(sp["from"]);
  const toDate = parseIsoDate(sp["to"]);
  const customRange =
    fromDate !== null &&
    toDate !== null &&
    fromDate.getTime() <= toDate.getTime();
  const chartMonths =
    customRange && fromDate && toDate
      ? monthsBetween(fromDate, toDate)
      : monthsForRange(range, now, q, qYear, yYear);

  // Year options: current year and the previous four, plus any selected year.
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  for (const yr of [qYear, yYear]) {
    if (!years.includes(yr)) years.push(yr);
  }
  years.sort((a, b) => b - a);

  const service = new DashboardService();
  const [kpis, quarter, year, series] = await Promise.all([
    service.getKpis(now),
    service.quarterTotals(qYear, q),
    service.yearTotals(yYear),
    service.monthlySeries(chartMonths),
  ]);

  const chartPoints = series.map((m) => ({
    monthIso: m.monthStart.toISOString(),
    incomeMinor: m.income.toString(),
    expenseMinor: m.expense.toString(),
  }));

  const chartRangeLabel =
    customRange && fromDate && toDate
      ? `${dateLabel(fromDate)} – ${dateLabel(toDate)}`
      : rangeLabel(range, q, qYear, yYear);
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Charts</CardTitle>
              <CardDescription>
                Visualise income, expense, net profit, and your current
                position.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ChartRangeCalendar from={fromStr} to={toStr} />
              <ChartRangePicker
                range={customRange ? "custom" : range}
                quarter={q}
                quarterYear={qYear}
                year={yYear}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DashboardChartsLazy
            points={chartPoints}
            cashMinor={kpis.cashOnHand.toString()}
            receivablesMinor={kpis.outstandingReceivables.toString()}
            payablesMinor={kpis.outstandingPayables.toString()}
            rangeLabel={chartRangeLabel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
