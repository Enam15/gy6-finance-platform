"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InvoiceDocument,
  INVOICE_WIDTH,
  invoiceCanvasHeight,
} from "@/components/invoice/invoice-document";
import {
  emptyItem,
  formToDocument,
  formToPayload,
  type InvoiceForm,
  type InvoiceStatusValue,
} from "@/lib/invoice/form";
import {
  SIGNATORY_PRESETS,
  DEFAULT_SIGNATURE_KEY,
} from "@/lib/invoice/signatories";
import { CURRENCIES } from "@/lib/invoice/currencies";

const PREVIEW_SCALE = 0.66;

interface InvoiceEditorProps {
  mode: "create" | "edit";
  invoiceId?: string;
  initial: InvoiceForm;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type,
  numeric,
  integer,
  tel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  /** Restrict input to digits (and a decimal point unless `integer`). */
  numeric?: boolean;
  integer?: boolean;
  /** Phone mode: digits plus `+ - ( ) space`, no letters. */
  tel?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {numeric || tel ? (
        <NumberInput
          id={id}
          value={value}
          onValueChange={onChange}
          decimal={!integer}
          tel={tel}
          placeholder={placeholder}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
        />
      )}
    </div>
  );
}

export function InvoiceEditor({
  mode,
  invoiceId,
  initial,
}: InvoiceEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<InvoiceForm>(initial);
  const [saving, setSaving] = useState(false);

  const doc = useMemo(() => formToDocument(form), [form]);
  const docHeight = invoiceCanvasHeight(doc);

  // value -> label maps so each Select's trigger shows the label (not the raw
  // code) for the invoice's current values, including on edit.
  const currencyItems = Object.fromEntries(
    CURRENCIES.map((c) => [c.code, c.label]),
  );
  const signatoryItems = Object.fromEntries(
    SIGNATORY_PRESETS.map((p) => [p.key, p.label]),
  );

  function set<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setItem(index: number, key: keyof InvoiceForm["items"][number], value: string) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, [key]: value } : it)),
    }));
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  }
  function removeItem(index: number) {
    setForm((f) => ({
      ...f,
      items:
        f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items,
    }));
  }

  // Picking a signatory swaps the signature image and pre-fills the block
  // (all still editable afterwards).
  function applySignatory(key: string) {
    const preset = SIGNATORY_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setForm((f) => ({
      ...f,
      signatureKey: preset.key,
      signatoryName: preset.name,
      signatoryTitle: preset.title,
      signatoryPhone: preset.phone,
      signatoryEmail: preset.email,
    }));
  }

  async function onSave() {
    if (!form.billToName.trim()) {
      toast.error("Bill-to name is required");
      return;
    }
    if (!form.items.some((it) => it.label.trim())) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    try {
      const url =
        mode === "create" ? "/api/invoices" : `/api/invoices/${invoiceId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save invoice");
        return;
      }
      toast.success(mode === "create" ? "Invoice created" : "Invoice saved");
      router.push("/invoices");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/invoices"
            className="text-sm text-muted-foreground hover:underline"
          >
            &larr; Back to invoices
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {mode === "create" ? "New invoice" : `Edit invoice #${form.number}`}
          </h1>
        </div>
        <div className="flex gap-2">
          {mode === "edit" && invoiceId && (
            <Button
              variant="outline"
              render={
                <Link href={`/invoices/${invoiceId}/print`} target="_blank" />
              }
            >
              Print / PDF
            </Button>
          )}
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save invoice"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        {/* Form */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field
                id="inv-number"
                label="Number"
                value={form.number}
                onChange={(v) => set("number", v)}
                placeholder="1"
                numeric
                integer
              />
              <div className="grid gap-1.5">
                <Label htmlFor="inv-status" className="text-xs">
                  Status
                </Label>
                <Select
                  items={{ DRAFT: "Draft", SENT: "Sent", PAID: "Paid" }}
                  value={form.status}
                  onValueChange={(v) =>
                    set("status", (v as InvoiceStatusValue) ?? "DRAFT")
                  }
                >
                  <SelectTrigger id="inv-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inv-currency" className="text-xs">
                  Currency
                </Label>
                <Select
                  items={currencyItems}
                  value={form.currency}
                  onValueChange={(v) => set("currency", v ?? "BDT")}
                >
                  <SelectTrigger id="inv-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                id="inv-date"
                label="Issuance date"
                value={form.issuanceDate}
                onChange={(v) => set("issuanceDate", v)}
                type="date"
              />
              <Field
                id="inv-due"
                label="Pay within (days)"
                value={form.dueInDays}
                onChange={(v) => set("dueInDays", v)}
                placeholder="7"
                numeric
                integer
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bill to</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Field
                id="bt-name"
                label="Billing name"
                value={form.billToName}
                onChange={(v) => set("billToName", v)}
                placeholder="Client name"
              />
              <Field
                id="bt-tin"
                label="TIN number (optional)"
                value={form.billToTin}
                onChange={(v) => set("billToTin", v)}
              />
              <div className="sm:col-span-2">
                <Field
                  id="bt-address"
                  label="Billing address"
                  value={form.billToAddress}
                  onChange={(v) => set("billToAddress", v)}
                />
              </div>
              <Field
                id="bt-email"
                label="Email"
                value={form.billToEmail}
                onChange={(v) => set("billToEmail", v)}
              />
              <Field
                id="bt-phone"
                label="Phone"
                value={form.billToPhone}
                onChange={(v) => set("billToPhone", v)}
                tel
              />
              <Field
                id="bt-bin"
                label="BIN (optional)"
                value={form.recipientBin}
                onChange={(v) => set("recipientBin", v)}
              />
              <Field
                id="bt-attn"
                label="Attention (optional)"
                value={form.recipientAttention}
                onChange={(v) => set("recipientAttention", v)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Additional details (optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Extra payee and contract details for the voucher. The recipient
                is the Bill To party above. Leave blank for a normal invoice —
                when filled, these render under Bill To.
              </p>

              <p className="text-xs font-medium text-foreground sm:col-span-2">
                Payee information
              </p>
              <Field id="pe-name" label="Payee / firm name" value={form.payeeName} onChange={(v) => set("payeeName", v)} />
              <Field id="pe-email" label="Payee email" value={form.payeeEmail} onChange={(v) => set("payeeEmail", v)} />
              <Field id="pe-work" label="Type of work" value={form.payeeWorkType} onChange={(v) => set("payeeWorkType", v)} />
              <Field id="pe-country" label="Country of service" value={form.payeeCountry} onChange={(v) => set("payeeCountry", v)} />

              <p className="mt-2 text-xs font-medium text-foreground sm:col-span-2">
                Project &amp; contract
              </p>
              <div className="sm:col-span-2">
                <Field id="ct-subject" label="Subject of contract" value={form.contractSubject} onChange={(v) => set("contractSubject", v)} />
              </div>
              <Field id="ct-no" label="Contract no." value={form.contractNo} onChange={(v) => set("contractNo", v)} />
              <Field id="ct-period" label="Contract period" value={form.contractPeriod} onChange={(v) => set("contractPeriod", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.items.map((it, i) => (
                <div
                  key={i}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                >
                  <Field
                    id={`it-label-${i}`}
                    label="Item (bold lead-in)"
                    value={it.label}
                    onChange={(v) => setItem(i, "label", v)}
                    placeholder="50% Advance Upon Kickoff -"
                  />
                  <Field
                    id={`it-detail-${i}`}
                    label="Description"
                    value={it.detail}
                    onChange={(v) => setItem(i, "detail", v)}
                    placeholder="Personal brand identity…"
                  />
                  <Field
                    id={`it-qty-${i}`}
                    label="Quantity"
                    value={it.quantity}
                    onChange={(v) => setItem(i, "quantity", v)}
                    placeholder="1"
                    numeric
                    integer
                  />
                  <Field
                    id={`it-amount-${i}`}
                    label="Amount"
                    value={it.amount}
                    onChange={(v) => setItem(i, "amount", v)}
                    placeholder="50000"
                    numeric
                  />
                  <div className="sm:col-span-2 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(i)}
                      disabled={form.items.length <= 1}
                    >
                      Remove item
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                Add line item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment method</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="pm-type" className="text-xs">
                  Show on invoice
                </Label>
                <Select
                  items={{ BANK: "Bank details", LINK: "Payment link" }}
                  value={form.paymentType}
                  onValueChange={(v) => set("paymentType", v ?? "BANK")}
                >
                  <SelectTrigger id="pm-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">Bank details</SelectItem>
                    <SelectItem value="LINK">Payment link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.paymentType === "LINK" ? (
                <>
                  <div className="sm:col-span-2">
                    <Field
                      id="pm-link"
                      label="Payment link URL (the button)"
                      value={form.paymentLinkUrl}
                      onChange={(v) => set("paymentLinkUrl", v)}
                      placeholder="https://contra.com/payment-link/…"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      id="pm-short"
                      label="Fallback short link (optional)"
                      value={form.paymentLinkShortUrl}
                      onChange={(v) => set("paymentLinkShortUrl", v)}
                      placeholder="https://surl.li/…"
                    />
                  </div>
                </>
              ) : (
                <>
                  <Field id="pm-bank" label="Bank" value={form.payBank} onChange={(v) => set("payBank", v)} />
                  <Field id="pm-acc-name" label="Account name" value={form.payAccountName} onChange={(v) => set("payAccountName", v)} />
                  <Field id="pm-acc-type" label="Account type" value={form.payAccountType} onChange={(v) => set("payAccountType", v)} />
                  <Field id="pm-acc-num" label="Account number" value={form.payAccountNumber} onChange={(v) => set("payAccountNumber", v)} />
                  <Field id="pm-branch" label="Branch name" value={form.payBranch} onChange={(v) => set("payBranch", v)} />
                  <Field id="pm-routing" label="Routing number" value={form.payRouting} onChange={(v) => set("payRouting", v)} numeric integer />
                  <Field id="pm-swift" label="Swift code" value={form.paySwift} onChange={(v) => set("paySwift", v)} />
                  <Field id="pm-bankaddr" label="Bank address" value={form.payBankAddress} onChange={(v) => set("payBankAddress", v)} />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signatory &amp; issuer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="sg-preset" className="text-xs">
                  Signatory (sets the signature)
                </Label>
                <Select
                  items={signatoryItems}
                  value={form.signatureKey}
                  onValueChange={(v) =>
                    applySignatory(v ?? DEFAULT_SIGNATURE_KEY)
                  }
                >
                  <SelectTrigger id="sg-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNATORY_PRESETS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field id="sg-name" label="Signatory name" value={form.signatoryName} onChange={(v) => set("signatoryName", v)} />
              <Field id="sg-title" label="Signatory title" value={form.signatoryTitle} onChange={(v) => set("signatoryTitle", v)} />
              <Field id="sg-phone" label="Signatory phone" value={form.signatoryPhone} onChange={(v) => set("signatoryPhone", v)} tel />
              <Field id="sg-email" label="Signatory email" value={form.signatoryEmail} onChange={(v) => set("signatoryEmail", v)} />
              <Field id="is-email" label="Issuer email" value={form.issuerEmail} onChange={(v) => set("issuerEmail", v)} />
              <Field id="is-phone" label="Issuer phone" value={form.issuerPhone} onChange={(v) => set("issuerPhone", v)} tel />
              <div className="sm:col-span-2">
                <Field id="is-address" label="Issuer address" value={form.issuerAddress} onChange={(v) => set("issuerAddress", v)} />
              </div>
              <div className="sm:col-span-2">
                <Field id="inv-notes" label="Footer note (optional, overrides the default thank-you)" value={form.notes} onChange={(v) => set("notes", v)} />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Live preview
          </p>
          <div
            className="overflow-hidden rounded-md border shadow-sm"
            style={{
              width: INVOICE_WIDTH * PREVIEW_SCALE,
              height: docHeight * PREVIEW_SCALE,
            }}
          >
            <div
              style={{
                transform: `scale(${PREVIEW_SCALE})`,
                transformOrigin: "top left",
                width: INVOICE_WIDTH,
                height: docHeight,
              }}
            >
              <InvoiceDocument data={doc} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
