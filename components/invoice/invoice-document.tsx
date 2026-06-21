import type { CSSProperties } from "react";

/**
 * Faithful render of GY6's invoice design (do not alter the layout/typography
 * without a design change). Pure presentational - safe in both server (print)
 * and client (editor preview) components. The canvas is a fixed 590x835 box
 * (A4 ratio); callers scale it with a CSS transform for previews.
 */

export interface InvoiceItemData {
  label: string;
  detail?: string | null;
  quantity: number;
  /** Line total, BigInt minor units as a string. */
  amount: string;
}

export interface InvoiceDocumentData {
  number: number;
  /** Pre-formatted, e.g. "June 15, 2026". */
  issuanceDate: string;
  dueInDays: number;
  /** Currency code shown in the table header; "BDT" renders the "Tk" symbol. */
  currency: string;

  issuerEmail?: string | null;
  issuerAddress?: string | null;
  issuerPhone?: string | null;

  billToName: string;
  billToAddress?: string | null;
  billToEmail?: string | null;
  billToPhone?: string | null;
  billToTin?: string | null;

  payBank?: string | null;
  payAccountName?: string | null;
  payAccountType?: string | null;
  payAccountNumber?: string | null;
  payBranch?: string | null;
  payRouting?: string | null;

  signatoryName?: string | null;
  signatoryTitle?: string | null;
  signatoryPhone?: string | null;
  signatoryEmail?: string | null;

  notes?: string | null;
  items: InvoiceItemData[];

  signatureUrl?: string;
  logoUrl?: string;
}

export const INVOICE_WIDTH = 590;
export const INVOICE_HEIGHT = 835;

const SERIF =
  "var(--font-invoice-serif),'Source Serif 4','Source Serif Pro',Georgia,serif";
const DISPLAY = "'Antilag',var(--font-invoice-serif),Georgia,serif";
const PIXEL = "'OffBit','Source Code Pro','Courier New',monospace";
const INK = "#0F161A";
const INK80 = "rgba(15,22,26,0.80)";
const INK60 = "rgba(15,22,26,0.60)";

function safeBig(v: string): bigint {
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
}

function formatAmount(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const major = abs / 100n;
  const cents = abs % 100n;
  const m = major.toLocaleString("en-US");
  const s = cents === 0n ? m : `${m}.${cents.toString().padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

function symbol(currency: string): string {
  return currency === "BDT" ? "Tk" : currency;
}

/** One "Label: value" line block, matching the two-tone field styling. */
function Fields({
  pairs,
  align,
}: {
  pairs: [string, string | null | undefined][];
  align: "left" | "right";
}) {
  const visible = pairs.filter(([, v]) => v != null && `${v}`.trim() !== "");
  return (
    <>
      {visible.map(([k, v], i) => (
        <div
          key={i}
          style={{
            color: INK60,
            fontSize: 10,
            fontFamily: SERIF,
            lineHeight: "18px",
            textAlign: align,
          }}
        >
          <span style={{ fontWeight: 600 }}>{k}: </span>
          <span style={{ fontWeight: 400 }}>{v}</span>
        </div>
      ))}
    </>
  );
}

const ITEM_COL: CSSProperties = { flex: 1, paddingRight: 8 };
const QTY_COL: CSSProperties = { width: 80, textAlign: "right" };
const TOTAL_COL: CSSProperties = { width: 95, textAlign: "right" };
const RULE: CSSProperties = {
  height: 0,
  borderTop: `1px solid ${INK}`,
  width: "100%",
};

export function InvoiceDocument({ data }: { data: InvoiceDocumentData }) {
  const sym = symbol(data.currency);
  const total = data.items.reduce((sum, it) => sum + safeBig(it.amount), 0n);
  const logoUrl = data.logoUrl ?? "/invoice/logo-halftone.svg";
  const signatureUrl = data.signatureUrl ?? "/invoice/signature.png";

  return (
    <div
      style={{
        width: INVOICE_WIDTH,
        height: INVOICE_HEIGHT,
        position: "relative",
        background: "#EEE6D0",
        overflow: "hidden",
        fontFamily: SERIF,
        color: INK,
      }}
    >
      {/* Header: number, title, logo, issuer contact */}
      <div
        style={{
          position: "absolute",
          left: 28,
          top: 41,
          color: INK80,
          fontSize: 54.86,
          fontFamily: PIXEL,
          fontWeight: 700,
          letterSpacing: 1.65,
        }}
      >
        #{data.number.toString().padStart(2, "0")}
      </div>
      <div
        style={{
          position: "absolute",
          left: 167,
          top: 103,
          color: INK,
          fontSize: 78.97,
          fontFamily: DISPLAY,
          fontWeight: 400,
        }}
      >
        Invoice
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt="GY6"
        style={{
          position: "absolute",
          left: 232,
          top: 32,
          width: 131,
          height: 82,
          objectFit: "contain",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 417,
          top: 41,
          width: 145,
          textAlign: "right",
          color: INK60,
          fontSize: 10,
          fontFamily: SERIF,
          fontWeight: 400,
          lineHeight: "18px",
        }}
      >
        {data.issuerEmail}
        <br />
        {data.issuerAddress}
        <br />
        {data.issuerPhone}
      </div>

      <div
        style={{
          position: "absolute",
          left: 236,
          top: 217,
          color: INK60,
          fontSize: 10,
          fontFamily: SERIF,
          fontWeight: 700,
        }}
      >
        Issuance Date: {data.issuanceDate}
      </div>

      {/* Items table */}
      <div style={{ position: "absolute", left: 28, top: 246, width: 534 }}>
        <div style={RULE} />
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <div style={ITEM_COL}>Item</div>
          <div style={QTY_COL}>Quantity</div>
          <div style={TOTAL_COL}>Total ({data.currency})</div>
        </div>

        {data.items.map((it, i) => (
          <div
            key={i}
            style={{ display: "flex", marginTop: 18, fontSize: 12 }}
          >
            <div style={ITEM_COL}>
              <span style={{ fontWeight: 400, color: INK }}>{it.label} </span>
              {it.detail ? (
                <span style={{ fontWeight: 400, color: INK60 }}>
                  {it.detail}
                </span>
              ) : null}
            </div>
            <div style={QTY_COL}>
              {it.quantity.toString().padStart(2, "0")}
            </div>
            <div style={TOTAL_COL}>{formatAmount(safeBig(it.amount))}</div>
          </div>
        ))}

        <div style={{ ...RULE, marginTop: 22 }} />
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <div style={ITEM_COL} />
          <div style={QTY_COL}>Total</div>
          <div style={TOTAL_COL}>
            {sym} {formatAmount(total)}
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div
        style={{
          position: "absolute",
          left: 28,
          top: 504,
          color: INK,
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        Bill To
      </div>
      <div style={{ position: "absolute", left: 28, top: 522, width: 252 }}>
        <Fields
          align="left"
          pairs={[
            ["Billing Name", data.billToName],
            ["Billing Address", data.billToAddress],
            ["Email", data.billToEmail],
            ["Phone", data.billToPhone],
            ["TIN Number", data.billToTin],
          ]}
        />
      </div>

      {/* Payment method */}
      <div
        style={{
          position: "absolute",
          left: 319,
          top: 506,
          width: 243,
          textAlign: "right",
          color: INK,
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        Payment Method
      </div>
      <div style={{ position: "absolute", left: 319, top: 524, width: 243 }}>
        <Fields
          align="right"
          pairs={[
            ["Bank", data.payBank],
            ["Account Name", data.payAccountName],
            ["Account Type", data.payAccountType],
            ["Account Number", data.payAccountNumber],
            ["Branch Name", data.payBranch],
            ["Routing Number", data.payRouting],
          ]}
        />
      </div>

      {/* Signature + signatory block */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={signatureUrl}
        alt="Signature"
        style={{
          position: "absolute",
          left: 436,
          top: 678,
          width: 131,
          height: 54,
          objectFit: "contain",
          // Lets a white-background signature blend onto the cream paper
          // (white -> transparent, black strokes stay black).
          mixBlendMode: "multiply",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 408,
          top: 733,
          width: 154,
          ...RULE,
          borderTop: `1px solid ${INK60}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 320,
          top: 736,
          width: 242,
          textAlign: "right",
          fontSize: 10,
          fontFamily: SERIF,
        }}
      >
        <span style={{ color: INK, fontWeight: 700 }}>
          {data.signatoryName}
          <br />
        </span>
        <span style={{ color: INK60, fontWeight: 600 }}>
          {data.signatoryTitle}
          <br />
          Phone:
        </span>
        <span style={{ color: INK60, fontWeight: 400 }}>
          {" "}
          {data.signatoryPhone}
          <br />
        </span>
        <span style={{ color: INK60, fontWeight: 600 }}>Email:</span>
        <span style={{ color: INK60, fontWeight: 400 }}>
          {" "}
          {data.signatoryEmail}
        </span>
      </div>

      {/* Footer note */}
      <div
        style={{
          position: "absolute",
          left: 33,
          top: 760,
          width: 243,
          color: "rgba(50,55,59,0.60)",
          fontSize: 10,
          fontFamily: SERIF,
          fontWeight: 600,
          lineHeight: "15px",
        }}
      >
        {data.notes ? (
          data.notes
        ) : (
          <>
            Thank you for choosing GY6 !<br />
            Please make payments within {data.dueInDays} days after issuance.
          </>
        )}
      </div>
    </div>
  );
}
