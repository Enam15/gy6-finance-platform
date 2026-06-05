"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface GeneratedTemplateResult {
  templateId: string;
  templateName: string;
  kind: string;
  entriesCreated: number;
}

interface GenerateSummary {
  totalCreated: number;
  templates: GeneratedTemplateResult[];
}

interface GenerateResponse {
  summary?: GenerateSummary;
  error?: string;
}

/**
 * Triggers POST /api/renewals/generate, which materialises DRAFT entries
 * for every template due today. Toasts the count and refreshes so the
 * templates' advanced next-due dates show.
 */
export function GenerateRenewalsButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function onClick() {
    setRunning(true);
    try {
      const res = await fetch("/api/renewals/generate", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as GenerateResponse;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate renewals");
        return;
      }
      const created = data.summary?.totalCreated ?? 0;
      if (created === 0) {
        toast.success("Nothing due to generate");
      } else {
        toast.success(
          `Generated ${created} draft entr${created === 1 ? "y" : "ies"}`,
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={running}>
      {running ? "Generating..." : "Generate due renewals"}
    </Button>
  );
}
