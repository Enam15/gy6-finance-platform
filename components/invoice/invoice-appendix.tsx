import type { CSSProperties } from "react";
import { INVOICE_WIDTH, INVOICE_HEIGHT } from "@/components/invoice/invoice-document";

/**
 * Optional formal-voucher detail for formal clients. Rendered as a second
 * page in the SAME visual language as the branded invoice (cream paper, ink
 * serif type) so it reads as a continuation of the same document rather than
 * a foreign table sheet. Renders nothing unless a recipient/payee/contract
 * field is filled, so a normal invoice is completely unchanged.
 */
export interface InvoiceAppendixData {
  recipientName?: string | null;
  recipientBin?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientAddress?: string | null;
  recipientAttention?: string | null;
  payeeName?: string | null;
  payeeFirm?: string | null;
  payeeBin?: string | null;
  payeeAddress?: string | null;
  payeeEmail?: string | null;
  payeeWorkType?: string | null;
  payeeCountry?: string | null;
  payAccountName?: string | null;
  payAccountNumber?: string | null;
  payBank?: string | null;
  payRouting?: string | null;
  paySwift?: string | null;
  payBranch?: string | null;
  payBankAddress?: string | null;
  contractSubject?: string | null;
  contractNo?: string | null;
  contractPeriod?: string | null;
  invoiceDate?: string | null;
  invoiceNumber?: string | null;
}

type Row = [string, string | null | undefined];

const SERIF =
  "var(--font-invoice-serif),'Source Serif 4','Source Serif Pro',Georgia,serif";
const DISPLAY = "'Antilag',var(--font-invoice-serif),Georgia,serif";
const PIXEL = "'OffBit','Source Code Pro','Courier New',monospace";
const INK = "#0F161A";
const INK80 = "rgba(15,22,26,0.80)";
const INK60 = "rgba(15,22,26,0.60)";
const CREAM = "#EEE6D0";

function filled(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim() !== "";
}

const RULE: CSSProperties = { height: 0, borderTop: `1px solid ${INK}`, width: "100%" };

/** A two-tone "Label: value" line, matching the invoice's field styling. */
function Line({ label, value }: { label: string; value: string | null | undefined }) {
  if (!filled(value)) return null;
  return (
    <div
      style={{
        color: INK60,
        fontSize: 10.5,
        fontFamily: SERIF,
        lineHeight: "19px",
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}: </span>
      <span style={{ fontWeight: 400 }}>{value}</span>
    </div>
  );
}

/** A titled group of fields; renders nothing when every field is empty. */
function Group({ title, rows }: { title: string; rows: Row[] }) {
  const visible = rows.filter(([, v]) => filled(v));
  if (visible.length === 0) return null;
  return (
    <div style={{ breakInside: "avoid", marginBottom: 4 }}>
      <div
        style={{
          color: INK,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: SERIF,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 7,
        }}
      >
        {title}
      </div>
      {visible.map(([label, value], i) => (
        <Line key={i} label={label} value={value} />
      ))}
    </div>
  );
}

/** True when any recipient/payee/contract field is set (i.e. the appendix
 *  should render). Bank + invoice date/number alone don't trigger it. */
export function hasAppendixContent(data: InvoiceAppendixData): boolean {
  return [
    data.recipientName,
    data.recipientBin,
    data.recipientPhone,
    data.recipientEmail,
    data.recipientAddress,
    data.recipientAttention,
    data.payeeName,
    data.payeeFirm,
    data.payeeBin,
    data.payeeAddress,
    data.payeeEmail,
    data.payeeWorkType,
    data.payeeCountry,
    data.contractSubject,
    data.contractNo,
    data.contractPeriod,
  ].some(filled);
}

export function InvoiceAppendix({ data }: { data: InvoiceAppendixData }) {
  if (!hasAppendixContent(data)) return null;

  const recipient: Row[] = [
    ["Recipient Name", data.recipientName],
    ["Recipient BIN", data.recipientBin],
    ["Phone", data.recipientPhone],
    ["Email", data.recipientEmail],
    ["Address", data.recipientAddress],
    ["Attention", data.recipientAttention],
  ];
  const payee: Row[] = [
    ["Payee Name", data.payeeName],
    ["Firm Name", data.payeeFirm],
    ["Payee BIN", data.payeeBin],
    ["Payee Address", data.payeeAddress],
    ["Payee Email", data.payeeEmail],
    ["Type of Work", data.payeeWorkType],
    ["Country of Service", data.payeeCountry],
  ];
  const bank: Row[] = [
    ["Account Name", data.payAccountName],
    ["Account Number", data.payAccountNumber],
    ["Bank Name", data.payBank],
    ["Routing Number", data.payRouting],
    ["Swift Code", data.paySwift],
    ["Branch Name", data.payBranch],
    ["Bank Address", data.payBankAddress],
  ];
  const project: Row[] = [
    ["Subject of Contract", data.contractSubject],
    ["Contract No", data.contractNo],
    ["Contract Period", data.contractPeriod],
    ["Invoice Date", data.invoiceDate],
    ["Invoice Number", data.invoiceNumber],
  ];

  return (
    <div
      className="invoice-appendix"
      style={{
        width: INVOICE_WIDTH,
        minHeight: INVOICE_HEIGHT,
        boxSizing: "border-box",
        background: CREAM,
        color: INK,
        fontFamily: SERIF,
        padding: "44px 40px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Header echoing the invoice's #NN + display title */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        {filled(data.invoiceNumber) ? (
          <span
            style={{
              fontFamily: PIXEL,
              fontSize: 24,
              fontWeight: 700,
              color: INK80,
              letterSpacing: 1,
            }}
          >
            #{data.invoiceNumber}
          </span>
        ) : null}
        <span style={{ fontFamily: DISPLAY, fontSize: 44, color: INK }}>
          Formal Details
        </span>
      </div>
      <div style={{ ...RULE, marginTop: 18, marginBottom: 26 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 40,
          rowGap: 28,
          alignItems: "start",
        }}
      >
        <Group title="Recipient Information" rows={recipient} />
        <Group title="Payee Information" rows={payee} />
        <Group title="Payee Bank Information" rows={bank} />
        <Group title="Project &amp; Invoice Information" rows={project} />
      </div>
    </div>
  );
}
