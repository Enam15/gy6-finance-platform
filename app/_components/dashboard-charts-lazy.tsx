"use client";

import dynamic from "next/dynamic";

interface ChartPoint {
  monthIso: string;
  incomeMinor: string;
  expenseMinor: string;
}

interface DashboardChartsLazyProps {
  points: ChartPoint[];
  cashMinor: string;
  receivablesMinor: string;
  payablesMinor: string;
  rangeLabel: string;
}

// recharts is a large bundle and the charts are below the fold, so load them
// on the client after the rest of the dashboard paints rather than shipping
// recharts in the route's initial JS.
const DashboardCharts = dynamic(
  () => import("@/components/dashboard-charts").then((m) => m.DashboardCharts),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] w-full animate-pulse rounded-lg bg-muted/50" />
    ),
  },
);

export function DashboardChartsLazy(props: DashboardChartsLazyProps) {
  return <DashboardCharts {...props} />;
}
