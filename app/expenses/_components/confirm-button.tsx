"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ConfirmExpenseButtonProps {
  entryId: string;
  description: string;
}

interface ApiError {
  error?: string;
}

/**
 * One-shot confirmer for a DRAFT expense entry. Posts the entry through the
 * ledger and refreshes the page; toasts on success or failure.
 */
export function ConfirmExpenseButton({
  entryId,
  description,
}: ConfirmExpenseButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function onClick() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/expenses/${entryId}/confirm`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to confirm expense");
        return;
      }
      toast.success(`"${description}" confirmed and posted to the ledger`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Button size="sm" onClick={onClick} disabled={confirming}>
      {confirming ? "Confirming..." : "Confirm"}
    </Button>
  );
}
