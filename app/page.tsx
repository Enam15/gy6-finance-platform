import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Pick a section from the sidebar to get started.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>
              Bank accounts, clients, founders, employees, subscriptions.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create, browse and inspect balances.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income</CardTitle>
            <CardDescription>
              Record what GY6 is owed; confirm to recognise on the ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Draft, confirm, then payments come in.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>
              Salary, subscriptions, anything GY6 owes.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Mirror of the income flow.
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Live ledger backed by Phase 1 - every action posts through the
        double-entry engine.
      </p>
    </div>
  );
}
