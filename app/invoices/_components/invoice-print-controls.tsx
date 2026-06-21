"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Top bar on the print page; hidden when printing. */
export function InvoicePrintControls({ editHref }: { editHref: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b bg-background px-6 py-3 print:hidden">
      <Link
        href="/invoices"
        className="text-sm text-muted-foreground hover:underline"
      >
        &larr; Invoices
      </Link>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" render={<Link href={editHref} />}>
          Edit
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          Print / Download PDF
        </Button>
      </div>
    </div>
  );
}
