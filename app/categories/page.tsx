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
import { Badge } from "@/components/ui/badge";
import { TransactionCategoryService } from "@/services/transaction-category-service";
import { CreateCategoryDialog } from "./_components/create-category-dialog";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await new TransactionCategoryService().listAll();

  // Group income first, then expense; alphabetical within each kind.
  const sorted = [...categories].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "INCOME" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const incomeCount = sorted.filter((c) => c.kind === "INCOME").length;
  const expenseCount = sorted.length - incomeCount;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Transaction categories
          </h1>
          <p className="text-sm text-muted-foreground">
            Labels attached to income and expense entries. Used for reporting
            and filtering.
          </p>
        </div>
        <CreateCategoryDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            All categories ({sorted.length})
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {incomeCount} income, {expenseCount} expense
            </span>
          </CardTitle>
          <CardDescription>Income first, then expense; alphabetical.</CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No categories yet. Create one with the button above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          category.kind === "INCOME" ? "default" : "secondary"
                        }
                      >
                        {category.kind}
                      </Badge>
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
