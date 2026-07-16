"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface ListToggleFilterProps {
  /** Search-param key this toggle owns. Present (="1") means on. */
  paramKey: string;
  label: string;
  checked: boolean;
}

/**
 * A URL-driven on/off filter for server-rendered list pages. Checking it adds
 * `?<paramKey>=1`; unchecking removes the param, so "off" is the clean
 * default URL.
 */
export function ListToggleFilter({
  paramKey,
  label,
  checked,
}: ListToggleFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setChecked(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(paramKey, "1");
    else params.delete(paramKey);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}
