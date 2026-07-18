"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryOption } from "@/app/accounts/_components/create-account-dialog";

interface EditAccountDialogProps {
  accountId: string;
  name: string;
  description: string;
  categoryId: string;
  allowNegative: boolean;
  /** Current custom field values, keyed by field id. */
  values: Record<string, string>;
  categories: CategoryOption[];
}

interface ApiError {
  error?: string;
}

/**
 * Edit an account's details. The balance is absent by design: it is
 * materialised from postings and moves only by posting an adjustment, so
 * there is nothing here that can quietly rewrite it.
 */
export function EditAccountDialog({
  accountId,
  name: initialName,
  description: initialDescription,
  categoryId: initialCategoryId,
  allowNegative: initialAllowNegative,
  values: initialValues,
  categories,
}: EditAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [allowNegative, setAllowNegative] = useState(initialAllowNegative);
  const [fieldValues, setFieldValues] =
    useState<Record<string, string>>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );
  const categoryItems = Object.fromEntries(
    categories.map((c) => [c.id, c.name]),
  );

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Re-seed each time it opens so an abandoned edit doesn't leak into the
    // next one.
    if (next) {
      setName(initialName);
      setDescription(initialDescription);
      setCategoryId(initialCategoryId);
      setAllowNegative(initialAllowNegative);
      setFieldValues(initialValues);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !categoryId) return;

    // Only send values for the selected category's fields.
    const customValues: Record<string, string> = {};
    for (const field of selectedCategory?.fields ?? []) {
      const v = (fieldValues[field.id] ?? "").trim();
      if (v) customValues[field.id] = v;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          categoryId,
          description: description.trim() ? description.trim() : null,
          allowNegative,
          customValues,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiError;
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save changes");
        return;
      }
      toast.success("Account updated");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Edit account
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>
              The balance isn&apos;t editable here - it&apos;s built up from
              postings, so it changes by recording an adjustment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-account-name">Name</Label>
              <Input
                id="edit-account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-account-description">
                Description (optional)
              </Label>
              <Input
                id="edit-account-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this account is for"
                disabled={submitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-account-category">Category</Label>
              <Select
                items={categoryItems}
                value={categoryId}
                onValueChange={(value) => setCategoryId(value ?? "")}
                disabled={submitting}
              >
                <SelectTrigger id="edit-account-category">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCategory?.fields.map((field) => (
              <div key={field.id} className="grid gap-2">
                <Label htmlFor={`edit-account-field-${field.id}`}>
                  {field.label}
                </Label>
                <Input
                  id={`edit-account-field-${field.id}`}
                  value={fieldValues[field.id] ?? ""}
                  onChange={(e) =>
                    setFieldValues((prev) => ({
                      ...prev,
                      [field.id]: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                  disabled={submitting}
                />
              </div>
            ))}

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={allowNegative}
                onChange={(e) => setAllowNegative(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-[var(--primary)]"
                disabled={submitting}
              />
              Allow this balance to go negative
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !categoryId}
            >
              {submitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
