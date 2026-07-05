import type { CSSProperties } from "react";

/**
 * Optional formal-voucher detail below the branded invoice. Renders nothing
 * unless a recipient/payee/contract field is filled, so a normal invoice is
 * completely unchanged. Uses fixed light colours so it prints cleanly in any
 * theme.
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

function filled(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim() !== "";
}

const tableStyle: CSSProperties = {
  border: "1px solid #D1D5DB",
  borderRadius: 6,
  overflow: "hidden",
  breakInside: "avoid",
};
const headStyle: CSSProperties = {
  background: "#E5E7EB",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 13,
  color: "#111827",
};
const labelCell: CSSProperties = {
  padding: "7px 12px",
  fontWeight: 600,
  color: "#111827",
  width: "42%",
  verticalAlign: "top",
};
const valueCell: CSSProperties = {
  padding: "7px 12px",
  color: "#374151",
  verticalAlign: "top",
};

function DetailTable({ title, rows }: { title: string; rows: Row[] }) {
  const visible = rows.filter(([, v]) => filled(v));
  if (visible.length === 0) return null;
  return (
    <div style={tableStyle}>
      <div style={headStyle}>{title}</div>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
      >
        <tbody>
          {visible.map(([label, value], i) => (
            <tr key={i} style={{ borderTop: "1px solid #E5E7EB" }}>
              <td style={labelCell}>{label}</td>
              <td style={valueCell}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
        maxWidth: 900,
        margin: "0 auto",
        fontFamily:
          "var(--font-invoice-serif),'Source Serif 4',Georgia,serif",
        color: "#111827",
      }}
    >
      <h2
        style={{
          fontSize: 15,
          fontWeight: 700,
          margin: "0 0 12px",
          color: "#111827",
        }}
      >
        Formal details
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <DetailTable title="Recipient Information" rows={recipient} />
        <DetailTable title="Payee Bank Information" rows={bank} />
        <DetailTable title="Payee Information" rows={payee} />
        <DetailTable title="Project &amp; Invoice Information" rows={project} />
      </div>
    </div>
  );
}
