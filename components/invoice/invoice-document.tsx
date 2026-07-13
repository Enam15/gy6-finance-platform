import type { CSSProperties } from "react";
import { currencySymbol } from "@/lib/invoice/currencies";

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

  // Optional formal-voucher details. When any are filled they render as
  // labelled groups directly under Bill To (the page grows to fit); a normal
  // invoice with none of these set is pixel-unchanged.
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
  contractSubject?: string | null;
  contractNo?: string | null;
  contractPeriod?: string | null;

  payBank?: string | null;
  payAccountName?: string | null;
  payAccountType?: string | null;
  payAccountNumber?: string | null;
  payBranch?: string | null;
  payRouting?: string | null;
  paySwift?: string | null;
  payBankAddress?: string | null;
  paymentType?: string;
  paymentLinkUrl?: string | null;
  paymentLinkShortUrl?: string | null;

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
  return currencySymbol(currency);
}

/** Ensure a user-entered URL is absolute so the link actually navigates
 *  (a bare "contra.com/…" would otherwise be treated as a relative path). */
function normalizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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

type FormalGroup = {
  title: string;
  pairs: [string, string | null | undefined][];
};

/** Formal-voucher groups rendered under Bill To, in the invoice's field style. */
function FormalUnderBillTo({ groups }: { groups: FormalGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div style={{ marginTop: 14 }}>
      {groups.map((g, i) => (
        <div key={g.title} style={{ marginTop: i === 0 ? 0 : 8 }}>
          <div
            style={{
              color: INK,
              fontSize: 9,
              fontWeight: 700,
              fontFamily: SERIF,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 2,
            }}
          >
            {g.title}
          </div>
          <Fields align="left" pairs={g.pairs} />
        </div>
      ))}
    </div>
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

function isFilled(v: string | null | undefined): boolean {
  return v != null && `${v}`.trim() !== "";
}

/**
 * Additional-voucher groups shown under Bill To. The recipient is the Bill To
 * party (shown above), and the bank is in Payment Method, so neither repeats
 * here - only Payee and Contract. Groups with no values are dropped.
 */
function buildFormalGroups(data: InvoiceDocumentData): FormalGroup[] {
  return (
    [
      {
        title: "Payee",
        pairs: [
          ["Name", data.payeeName],
          ["Email", data.payeeEmail],
          ["Type of Work", data.payeeWorkType],
          ["Country of Service", data.payeeCountry],
        ],
      },
      {
        title: "Contract",
        pairs: [
          ["Subject of Contract", data.contractSubject],
          ["Contract No", data.contractNo],
          ["Contract Period", data.contractPeriod],
        ],
      },
    ] as FormalGroup[]
  )
    .map((g) => ({ title: g.title, pairs: g.pairs.filter(([, v]) => isFilled(v)) }))
    .filter((g) => g.pairs.length > 0);
}

/**
 * Extra vertical space needed under Bill To for the formal details, so the
 * bottom-anchored signature/footer sit below them and the page grows to fit.
 * Estimated from filled-line counts (over-estimated a touch, wrap-prone
 * fields counted as two lines, so the footer never overlaps). A normal
 * invoice with no formal details returns 0 and is pixel-identical.
 */
function computeExtra(data: InvoiceDocumentData): number {
  const groups = buildFormalGroups(data);
  if (groups.length === 0) return 0;

  const billToLines = [
    data.billToName,
    data.billToAddress,
    data.billToEmail,
    data.billToPhone,
    data.billToTin,
    data.recipientBin,
    data.recipientAttention,
  ].filter(isFilled).length;

  let formalHeight = 14; // gap under Bill To
  for (const g of groups) {
    formalHeight += 15; // group heading
    for (const [label] of g.pairs) {
      formalHeight += /Address|Subject/.test(label) ? 34 : 18;
    }
    formalHeight += 8; // gap after group
  }
  formalHeight += 16; // safety

  const leftBottom = 522 + billToLines * 18 + formalHeight;
  return Math.max(0, Math.ceil(leftBottom + 16 - 760));
}

/** Total rendered height of the invoice canvas (grows with formal details). */
export function invoiceCanvasHeight(data: InvoiceDocumentData): number {
  return INVOICE_HEIGHT + computeExtra(data);
}

export function InvoiceDocument({ data }: { data: InvoiceDocumentData }) {
  const sym = symbol(data.currency);
  const total = data.items.reduce((sum, it) => sum + safeBig(it.amount), 0n);
  const logoUrl = data.logoUrl ?? "/invoice/logo-halftone.svg";
  const signatureUrl = data.signatureUrl ?? "/invoice/signature.png";

  const formalGroups = buildFormalGroups(data);
  const extra = computeExtra(data);
  const canvasHeight = INVOICE_HEIGHT + extra;

  return (
    <div
      style={{
        width: INVOICE_WIDTH,
        height: canvasHeight,
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
            ["BIN", data.recipientBin],
            ["Attention", data.recipientAttention],
          ]}
        />
        <FormalUnderBillTo groups={formalGroups} />
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
        {data.paymentType === "LINK" ? (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                color: INK60,
                fontSize: 12,
                fontFamily: SERIF,
                lineHeight: "18px",
              }}
            >
              Pay securely online via the link below.
            </div>
            {data.paymentLinkUrl ? (
              <a
                href={normalizeUrl(data.paymentLinkUrl)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  width: 113,
                  marginTop: 12,
                  background: "#31363B",
                  color: "#F4EEDF",
                  borderRadius: 10,
                  padding: "7px 0",
                  textAlign: "center",
                  textDecoration: "none",
                  fontFamily: SERIF,
                  fontSize: 14,
                }}
              >
                Payment Link
              </a>
            ) : null}
            {data.paymentLinkShortUrl ? (
              <div
                style={{
                  marginTop: 12,
                  color: INK60,
                  fontSize: 12,
                  fontFamily: SERIF,
                  lineHeight: "18px",
                }}
              >
                Button not working?
                <br />
                Pay here:{" "}
                <a
                  href={normalizeUrl(data.paymentLinkShortUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: INK60 }}
                >
                  {data.paymentLinkShortUrl}
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <Fields
            align="right"
            pairs={[
              ["Bank", data.payBank],
              ["Account Name", data.payAccountName],
              ["Account Type", data.payAccountType],
              ["Account Number", data.payAccountNumber],
              ["Branch Name", data.payBranch],
              ["Routing Number", data.payRouting],
              ["Swift Code", data.paySwift],
              ["Bank Address", data.payBankAddress],
            ]}
          />
        )}
      </div>

      {/* Signature + signatory block */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={signatureUrl}
        alt="Signature"
        style={{
          position: "absolute",
          left: 436,
          top: 678 + extra,
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
          top: 733 + extra,
          width: 154,
          ...RULE,
          borderTop: `1px solid ${INK60}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 320,
          top: 736 + extra,
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
          top: 760 + extra,
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
