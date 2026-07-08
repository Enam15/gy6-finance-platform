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
import { formatMoney, money } from "@/lib/money";
import { RenewalActiveToggle } from "@/components/renewal-active-toggle";

/** One recurring template flattened for display. */
export interface RecurringEntryData {
  id: string;
  name: string;
  accountName: string;
  categoryName: string;
  totalAmountMinor: string;
  intervalCount: number;
  intervalUnit: string;
  nextRunIso: string;
  isActive: boolean;
}

function intervalLabel(count: number, unit: string): string {
  const u = unit.toLowerCase();
  return `Every ${count} ${u}${count > 1 ? "s" : ""}`;
}

/**
 * "Recurring income / expenses" panel shown on the Income and Expense tabs.
 * Each row is a renewal template with an Active/Paused slider; the entries it
 * generates land in the main list above when they come due.
 */
export function RecurringEntries({
  kind,
  entries,
}: {
  kind: "income" | "expense";
  entries: RecurringEntryData[];
}) {
  const noun = kind === "income" ? "income" : "expenses";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Recurring {noun} ({entries.length})
        </CardTitle>
        <CardDescription>
          Set up with the &ldquo;Repeat&rdquo; option when creating an entry.
          New drafts are generated automatically when this tab loads; pause one
          to stop it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            No recurring {noun} yet. Choose &ldquo;Repeat&rdquo; when creating an
            entry to add one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Repeats</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.accountName}</TableCell>
                  <TableCell>{e.categoryName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(money(BigInt(e.totalAmountMinor)))}
                  </TableCell>
                  <TableCell>
                    {intervalLabel(e.intervalCount, e.intervalUnit)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {e.nextRunIso.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <RenewalActiveToggle
                      id={e.id}
                      isActive={e.isActive}
                      name={e.name}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
