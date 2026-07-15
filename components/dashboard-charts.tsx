"use client";

import { useMemo, useState, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, money } from "@/lib/money";

interface ChartPoint {
  /** Month start, ISO date string (UTC). */
  monthIso: string;
  /** Income for that month, minor units, as a string (BigInt-safe over RSC). */
  incomeMinor: string;
  /** Expense for that month, minor units, as a string. */
  expenseMinor: string;
}

interface DashboardChartsProps {
  points: ChartPoint[];
  /** Snapshot totals (minor units, strings) for the position doughnut. */
  cashMinor: string;
  receivablesMinor: string;
  payablesMinor: string;
  /** Human label for the selected range, shown in the caption. */
  rangeLabel: string;
}

type ChartKey = "bars" | "lines" | "net" | "position";

const chartConfig = {
  income: { label: "Income", color: "#22c55e" },
  expense: { label: "Expense", color: "#ef4444" },
  net: { label: "Net", color: "#3b82f6" },
} satisfies ChartConfig;

const POSITION_COLORS: Record<string, string> = {
  cash: "#0ea5e9",
  receivables: "#22c55e",
  payables: "#ef4444",
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** Format a major-unit number back to a grouped money string. */
function fmt(major: number): string {
  return formatMoney(money(BigInt(Math.round(major * 100))));
}

/** Compact axis label (no decimals, grouped). */
function axisTick(v: number): string {
  return v === 0 ? "0" : v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * Dashboard charts with a selector. Switches between a grouped income/expense
 * bar chart, an income/expense trend (lines), a monthly net-profit bar chart
 * (green when positive, red when negative), and a doughnut of the current
 * position (cash vs receivables vs payables). All money values arrive as
 * minor-unit strings and are parsed client-side.
 */
export function DashboardCharts({
  points,
  cashMinor,
  receivablesMinor,
  payablesMinor,
  rangeLabel,
}: DashboardChartsProps) {
  const [chart, setChart] = useState<ChartKey>("bars");

  const monthly = useMemo(
    () =>
      points.map((p) => {
        const income = Number(BigInt(p.incomeMinor)) / 100;
        const expense = Number(BigInt(p.expenseMinor)) / 100;
        return {
          month: MONTH_LABEL.format(new Date(p.monthIso)),
          income,
          expense,
          net: income - expense,
        };
      }),
    [points],
  );

  const position = useMemo(
    () => [
      { key: "cash", name: "Cash on hand", value: Number(BigInt(cashMinor)) / 100 },
      {
        key: "receivables",
        name: "Owed to you",
        value: Number(BigInt(receivablesMinor)) / 100,
      },
      {
        key: "payables",
        name: "You owe",
        value: Number(BigInt(payablesMinor)) / 100,
      },
    ],
    [cashMinor, receivablesMinor, payablesMinor],
  );

  const hasMonthly = monthly.some((m) => m.income !== 0 || m.expense !== 0);
  const hasPosition = position.some((p) => p.value !== 0);

  const moneyTooltip = (
    <ChartTooltip
      cursor={{ fill: "var(--color-muted)" }}
      content={
        <ChartTooltipContent
          indicator="dot"
          formatter={(value, name) => [
            fmt(Number(value)),
            String(name).charAt(0).toUpperCase() + String(name).slice(1),
          ]}
        />
      }
    />
  );

  let body: ReactElement;
  if (chart === "position") {
    body = !hasPosition ? (
      <EmptyState />
    ) : (
      <ChartContainer config={chartConfig} className="h-72 w-full">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="name"
                formatter={(value, name) => [fmt(Number(value)), String(name)]}
              />
            }
          />
          <Pie
            data={position}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
          >
            {position.map((p) => (
              <Cell key={p.key} fill={POSITION_COLORS[p.key]} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ChartContainer>
    );
  } else if (!hasMonthly) {
    body = <EmptyState />;
  } else if (chart === "lines") {
    body = (
      <ChartContainer config={chartConfig} className="h-72 w-full">
        <LineChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) => axisTick(v)}
          />
          {moneyTooltip}
          <Legend />
          <Line
            dataKey="income"
            stroke="var(--color-income)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            dataKey="expense"
            stroke="var(--color-expense)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    );
  } else if (chart === "net") {
    body = (
      <ChartContainer config={chartConfig} className="h-72 w-full">
        <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) => axisTick(v)}
          />
          <ChartTooltip
            cursor={{ fill: "var(--color-muted)" }}
            content={
              <ChartTooltipContent
                indicator="dot"
                formatter={(value) => [fmt(Number(value)), "Net"]}
              />
            }
          />
          <Bar dataKey="net" radius={[2, 2, 0, 0]}>
            {monthly.map((m, i) => (
              <Cell key={i} fill={m.net >= 0 ? "#22c55e" : "#ef4444"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    );
  } else {
    body = (
      <ChartContainer config={chartConfig} className="h-72 w-full">
        <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) => axisTick(v)}
          />
          {moneyTooltip}
          <Legend />
          <Bar dataKey="income" fill="var(--color-income)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="expense" fill="var(--color-expense)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {chart === "position"
            ? "Your current financial position."
            : `${rangeLabel}, by entry date (UTC).`}
        </p>
        <Select
          items={{
            bars: "Income vs Expense (bars)",
            lines: "Income vs Expense (trend)",
            net: "Net profit (monthly)",
            position: "Cash / owed to you / you owe",
          }}
          value={chart}
          onValueChange={(v) => setChart((v ?? "bars") as ChartKey)}
        >
          <SelectTrigger className="w-[250px]" aria-label="Chart type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bars">Income vs Expense (bars)</SelectItem>
            <SelectItem value="lines">Income vs Expense (trend)</SelectItem>
            <SelectItem value="net">Net profit (monthly)</SelectItem>
            <SelectItem value="position">Cash / owed to you / you owe</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {body}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      No data yet.
    </div>
  );
}
