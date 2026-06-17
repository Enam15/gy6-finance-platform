"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ListSelectFilterProps {
  /** Search-param key this control owns (e.g. "category", "type"). */
  paramKey: string;
  label: string;
  /** Current value ("" / "all" means no filter). */
  value: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}

/**
 * A URL-driven dropdown filter for server-rendered list pages. Setting it
 * merges the chosen value into the query string (or removes it for "all")
 * and pushes the new URL; the page re-renders filtered server-side.
 */
export function ListSelectFilter({
  paramKey,
  label,
  value,
  options,
  allLabel = "All",
}: ListSelectFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!next || next === "all") {
      params.delete(paramKey);
    } else {
      params.set(paramKey, next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select
        value={value || "all"}
        onValueChange={(v) => setParam(v ?? "all")}
      >
        <SelectTrigger className="h-8 w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
