"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoney, money } from "@/lib/money";

interface ChartPoint {
  /** Month start, ISO date string (UTC, e.g. "2026-06-01T00:00:00.000Z"). */
  monthIso: string;
  /** Income for that month, minor units, as a string (BigInt-safe over RSC). */
  incomeMinor: string;
  /** Expense for that month, minor units, as a string. */
  expenseMinor: string;
}

interface MonthlyIncomeExpenseChartProps {
  points: ChartPoint[];
}

const chartConfig = {
  income: { label: "Income", color: "#22c55e" },
  expense: { label: "Expense", color: "#ef4444" },
} satisfies ChartConfig;

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/**
 * 12-month bar chart of CONFIRMED income vs expense, side-by-side per
 * month. Values arrive as minor-units strings (BigInt-safe over the RSC
 * boundary) and are parsed in the client; the chart itself uses major-unit
 * Numbers for the bar heights (safe for amounts under ~9 trillion) and
 * shows formatted money strings in the tooltip.
 */
export function MonthlyIncomeExpenseChart({
  points,
}: MonthlyIncomeExpenseChartProps) {
  const data = useMemo(
    () =>
      points.map((p) => {
        const incomeMinor = BigInt(p.incomeMinor);
        const expenseMinor = BigInt(p.expenseMinor);
        return {
          month: MONTH_LABEL.format(new Date(p.monthIso)),
          income: Number(incomeMinor) / 100,
          expense: Number(expenseMinor) / 100,
        };
      }),
    [points],
  );

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No data yet.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(v: number) =>
            v === 0
              ? "0"
              : v.toLocaleString("en-US", { maximumFractionDigits: 0 })
          }
        />
        <ChartTooltip
          cursor={{ fill: "var(--color-muted)" }}
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(value, name) => {
                const major = Number(value);
                const minor = BigInt(Math.round(major * 100));
                return [
                  formatMoney(money(minor)),
                  String(name).charAt(0).toUpperCase() + String(name).slice(1),
                ];
              }}
            />
          }
        />
        <Bar dataKey="income" fill="var(--color-income)" radius={[2, 2, 0, 0]} />
        <Bar
          dataKey="expense"
          fill="var(--color-expense)"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
