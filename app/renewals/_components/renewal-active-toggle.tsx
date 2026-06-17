"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RenewalActiveToggleProps {
  id: string;
  isActive: boolean;
  name: string;
}

/**
 * Active/Paused slider for a renewal template. Pausing stops further drafts
 * from being generated. Optimistic: flips immediately, reverts on failure.
 */
export function RenewalActiveToggle({
  id,
  isActive,
  name,
}: RenewalActiveToggleProps) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !active;
    setBusy(true);
    setActive(next);
    try {
      const res = await fetch(`/api/renewals/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        setActive(!next);
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Failed to update renewal");
        return;
      }
      toast.success(`"${name}" ${next ? "reactivated" : "paused"}`);
      router.refresh();
    } catch (error) {
      setActive(!next);
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`${name} is ${active ? "active" : "paused"}`}
        onClick={toggle}
        disabled={busy}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          active ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-background shadow transition-transform",
            active ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      <span className="text-xs text-muted-foreground">
        {active ? "Active" : "Paused"}
      </span>
    </div>
  );
}
