import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExportLinksProps {
  /** API path; "csv" and "xlsx" are appended as the format query. */
  basePath: string;
  className?: string;
}

/**
 * Side-by-side CSV + XLSX download links. Uses plain anchor tags styled
 * with the outline-sm button variant so the click triggers the browser's
 * download flow - the route handler returns
 * Content-Disposition: attachment with the filename it picked.
 *
 * Server component - no state, no event handlers.
 */
export function ExportLinks({ basePath, className }: ExportLinksProps) {
  const buttonClass = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <div className={cn("flex gap-2", className)}>
      <a href={`${basePath}?format=csv`} className={buttonClass}>
        Export CSV
      </a>
      <a href={`${basePath}?format=xlsx`} className={buttonClass}>
        Export XLSX
      </a>
    </div>
  );
}
