"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AccountAdjustToggleProps {
  accountId: string;
  isOn: boolean;
}

/**
 * Switch controlling whether the "Adjust balance" action is offered for this
 * account. Optimistic: flips immediately, reverts on failure.
 */
export function AccountAdjustToggle({
  accountId,
  isOn,
}: AccountAdjustToggleProps) {
  const router = useRouter();
  const [on, setOn] = useState(isOn);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setOn(next);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowBalanceAdjust: next }),
      });
      if (!res.ok) {
        setOn(!next);
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Failed to update account");
        return;
      }
      toast.success(`Balance adjustment ${next ? "enabled" : "disabled"}`);
      router.refresh();
    } catch (error) {
      setOn(!next);
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        Allow balance adjustment
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Balance adjustment is ${on ? "on" : "off"}`}
        onClick={toggle}
        disabled={busy}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          on ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-background shadow transition-transform",
            on ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
