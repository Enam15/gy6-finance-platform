# GY6 Finance Management System — Full Project Context & Handoff

> A complete, self-contained handoff of everything built so far. Anyone (a
> developer or an AI assistant) should be able to read this and understand
> the project, its decisions, its structure, how to run it, and what is
> left to do.

---

## 0. The one-paragraph summary

GY6 Finance is an **accounting-critical web application** for the GY6 agency
(two partners: **Tashfeen** and **Itmam**). It is **not** a simple CRUD app —
it implements real **double-entry bookkeeping** on an **immutable, append-only
ledger**, with exact (integer) money, accrual accounting, payments, transfers,
balance adjustments, reversals/corrections, quarterly **profit distribution**
between partners, **recurring renewals**, a KPI **dashboard**, and **CSV/XLSX
exports** — all behind **login authentication** with a full audit trail. Built
with **Next.js 16 + React 19 + TypeScript**, **Prisma 7 + PostgreSQL 17**, and
**Auth.js v5**. It is feature-complete against the original requirements and
has a written cloud-deployment runbook (deployment itself is the remaining
step).

---

## 1. Where the real files live (the canonical source)

- **GitHub:** `https://github.com/Enam15/gy6-finance-platform.git`
- **Local working copy:** `C:\Users\musta\Desktop\GY6 DB`
- **Git history:** 53 commits, each phase committed separately with detailed messages.
- **Clean source archive:** `GY6-Finance-Source.zip` (on the Desktop) — all
  source files, no `node_modules`/build artifacts.

> The Git repository is the single source of truth. To continue *building* the
> app you need a coding environment (an IDE or coding agent) that can run
> `npm`, Prisma, and PostgreSQL. Notion AI is excellent for holding this
> context document and planning, but it cannot run, edit, or build the code.

---

## 2. Current status

| Phase | What it delivered | Status |
|---|---|---|
| **Phase 0** | Project scaffold, money type, service/repo skeleton, seed | ✅ Done |
| **Phase 1** | The full ledger engine (schema, posting engine, income/expense/payments/transfers/adjustments/reversal) + tests | ✅ Done |
| **Phase 2A** | UI foundation, accounts, categories, income, expenses pages | ✅ Done |
| **Phase 2B** | Payments UI, transfers, adjustments, ledger view, per-account detail, dashboard, exports | ✅ Done |
| **Phase 2C-α** | Auth (login), route protection, audit actor, reversal UI | ✅ Done |
| **Phase 2C-β** | Dashboard with KPIs + chart; CSV/XLSX exports | ✅ Done |
| **Phase 2C-γ** | Profit distribution; recurring renewals | ✅ Done |
| **Phase 3** | Pre-deploy code prep + Neon/Vercel config + `DEPLOYMENT.md` runbook | ⚙️ Code ready; **cloud setup not yet executed** |

**Verification at every step:** TypeScript typecheck, ESLint, **46 automated
tests**, and a production build all pass. 35 routes total.

**Pending / not yet built (the roadmap):** see Section 13.

---

## 3. Tech stack (with versions)

| Area | Technology | Version | Role |
|---|---|---|---|
| Language | TypeScript | ^6.0.3 (strict) | Type-safe code |
| Framework | Next.js (App Router, Turbopack) | ^16.2.6 | Full-stack web framework |
| UI | React | ^19.2.6 | Components |
| Styling | Tailwind CSS | ^4.3.0 | Utility CSS |
| Components | shadcn/ui + Base UI + lucide-react | 4.8.3 | Prebuilt UI |
| Charts | recharts | ^3.8.0 | Dashboard chart |
| Toasts | sonner | ^2.0.7 | Notifications |
| ORM | Prisma (`prisma-client` generator + driver adapter) | ^7.8.0 | DB access + migrations |
| DB driver | `@prisma/adapter-pg` + `pg` | 7.8.0 / 8.21.0 | Postgres connection |
| Database | PostgreSQL | 17 | Data store |
| Auth | Auth.js / NextAuth | ^5.0.0-beta.31 | Login (Credentials + JWT) |
| Hashing | bcryptjs | ^3.0.3 | Password hashing |
| Validation | Zod | ^4.4.3 | Input validation |
| Exports | exceljs | ^4.4.0 | XLSX generation |
| Tests | Vitest | ^4.1.7 | Automated tests |

---

## 4. Locked architectural decisions (do not silently change these)

- **Single agency, single tenant** (GY6 only) — not multi-tenant SaaS.
- **Single currency**, no FX.
- **Money is integer minor units** (e.g. cents) stored as `BigInt`. **Never
  floating point.** Branded `Money` type (`lib/money.ts`).
- **Double-entry, movement-based ledger.** Five user-facing account types
  (Business, Founder, Client, Employee, Subscription) plus hidden **system
  accounts** (Revenue, Expense, Adjustments, Opening Balances) that give each
  posting a counter-account.
- **Immutable ledger:** `statement_entries` is append-only, enforced by a
  **database trigger** AND repository design. Corrections are **reversals**
  (mirror entries), never edits/deletes.
- **Accrual basis:** confirming an income/expense posts the *full* amount;
  **payments are separate posted events**; `amount_due = total − paid`.
- **Profit distribution** percentages are **configurable with history**
  (currently Tashfeen 65% / Itmam 35%), distributed quarterly, allocated with
  the **largest-remainder method** so shares sum exactly to the total.
- **Renewals** create new **DRAFT** (pending, unconfirmed) entries and **never
  auto-post**; apply to both income and expense.
- **Layered architecture:** UI → API routes → **Services** (all business
  logic) → **Repositories** (data access) → PostgreSQL. No business logic in
  components.
- **Calendar fiscal year** (Jan–Dec). UTC for all date math.
- The authoritative rules live in **`PROJECT_RULES.md`** at the repo root.

---

## 5. Architecture & data flow

```
User (browser)
   │
   ▼
Pages & Components  (app/**, components/**)      ← React, what the user sees
   │  (client components POST via fetch)
   ▼
API Route Handlers  (app/api/**/route.ts)        ← validate input, read session
   │
   ▼
Services  (services/*.ts)                        ← ALL business/accounting rules
   │
   ▼
Repositories  (repositories/*.ts)                ← data access only, no logic
   │
   ▼
PostgreSQL (via Prisma + pg adapter)
```

**The posting engine (`services/posting-service.ts`) is the single chokepoint
for every balance change.** It:
1. Locks the affected accounts (`SELECT … FOR UPDATE`) in sorted id order
   (deadlock-safe).
2. Computes each account's balance delta from its **normal balance**
   (debit-normal vs credit-normal).
3. Rejects postings that would make a balance negative (unless the account
   allows it).
4. Writes the ledger entries, updates balances, and records an audit log —
   **all inside one atomic database transaction.**

Server components read data by calling services directly (no HTTP round-trip);
client components (dialogs, action buttons) call the API routes and then
`router.refresh()`.

---

## 6. The accounting model (concepts whoever continues must understand)

- **Debit / Credit:** every transaction has two equal sides. The system never
  records a one-sided entry.
- **Normal balance:** Business, Client, Founder accounts are **debit-normal**
  (grow on debit). Employee, Subscription accounts are **credit-normal** (grow
  on credit). This is derived from the account category.
- **Account meanings:** Business = real cash; Client = outstanding receivable;
  Employee/Subscription = outstanding payable; Founder = cumulative
  distribution received.
- **System accounts** (hidden): Revenue (counter to confirmed income), Expense
  (counter to confirmed expense), Adjustments (counter to manual corrections),
  Opening Balances (counter to go-live balances).
- **Posting recipes:**
  - Confirm income → DR client account / CR Revenue.
  - Income payment → DR Business (cash in) / CR client; updates amount_paid.
  - Confirm expense → DR Expense / CR payee account.
  - Expense payment → DR payee / CR Business (cash out); updates amount_paid.
  - Transfer → DR destination / CR source (both Business accounts).
  - Adjustment → posts the difference against the Adjustments account.
  - Distribution → DR each partner's Founder account / CR the Business source.
  - Reversal → mirror of the original (DR/CR swapped), linked via
    `reversesEntryId`.

---

## 7. Data model (Prisma — `prisma/schema.prisma`)

**Enums:** `AccountCategoryKey` (BUSINESS, FOUNDER, CLIENT, EMPLOYEE,
SUBSCRIPTION, SYSTEM), `SystemAccountKey` (REVENUE, EXPENSE, ADJUSTMENTS,
OPENING_BALANCES), `NormalBalance` (DEBIT, CREDIT), `EntryState` (DRAFT,
CONFIRMED, REVERSED), `CategoryKind` (INCOME, EXPENSE), `RecurrenceUnit` (DAY,
WEEK, MONTH, YEAR), `StatementEntryType` (INCOME, EXPENSE, PAYMENT, TRANSFER,
ADJUSTMENT, REVERSAL, OPENING_BALANCE, DISTRIBUTION), `StatementSourceType`
(INCOME_ENTRY, EXPENSE_ENTRY, PAYMENT, TRANSFER, BALANCE_ADJUSTMENT,
DISTRIBUTION), `AuditAction` (CREATE, UPDATE, DELETE, CONFIRM, REVERSE,
TRANSFER, ADJUST, RENEW, EXPORT).

**Models:**
- `AccountCategory` — the 6 categories (5 user + SYSTEM).
- `Account` — money-holding entity; `balance` (BigInt), `normalBalance`,
  `systemKey?`, `allowNegative`, `isActive`.
- `AuditLog` — append-only record of every state change (action, entity,
  before/after JSON, actorId, actorLabel, timestamp).
- `TransactionCategory` — income/expense labels.
- `StatementEntry` — **the immutable ledger** (transactionGroupId, entryType,
  debit/credit account, amount, effectiveDate, sourceType, sourceId,
  reversesEntryId). Append-only (DB trigger blocks UPDATE/DELETE).
- `IncomeEntry` / `ExpenseEntry` — operational records; totalAmount,
  amountPaid, amountDue, entryDate, paymentDueOn, state, `renewalTemplateId?`.
- `Payment` — instalment against a confirmed income/expense entry.
- `Transfer` — cash movement between Business accounts.
- `BalanceAdjustment` — manual balance correction (previous/new/difference,
  reason).
- `Partner` + `PartnerShareSlice` — profit-distribution partners and their
  time-sliced share ratios.
- `Distribution` + `DistributionShare` — a quarterly distribution event and
  each partner's allocated share (ratio + denominator snapshotted).
- `RenewalTemplate` — recurring income/expense recipe (kind, account,
  category, amount, interval count + unit, nextRunOn, endOn?).
- `AppUser` — login users (email, bcrypt passwordHash).
- `Attachment` — receipt/invoice metadata (schema present, **no UI yet**).

**Migrations** (in `prisma/migrations/`, applied in order):
`init` → `ledger` → `app_users` → `partners` → `distribution_enums` →
`renewal_templates`.

---

## 8. Directory map (annotated)

```
app/                         Next.js App Router (pages + API)
  page.tsx                   Dashboard (KPIs + chart)
  layout.tsx                 Root layout (sidebar, session, toaster)
  login/                     Login page + form
  accounts/                  Accounts list + [id] detail + create dialog
  categories/                Transaction categories
  income/  expenses/         Income & expense modules (+ confirm/pay/reverse)
  transfers/  adjustments/   Money movement
  distributions/  renewals/  Profit split & recurring billing
  ledger/                    Immutable ledger feed
  api/**/route.ts            20 API endpoints (CRUD, confirm, payments,
                             reverse, exports, distributions, renewals, health)
components/
  app-sidebar.tsx            Navigation + signed-in user + sign out
  reverse-button.tsx         Shared reversal dialog
  export-links.tsx           CSV/XLSX download links
  monthly-income-expense-chart.tsx   Dashboard chart (recharts)
  ui/                        shadcn/ui primitives
services/                    14 services — ALL business logic
  posting-service.ts         ★ the double-entry engine (core)
  income / expense / payment / transfer / balance-adjustment / reversal
  distribution / renewal / dashboard / account / transaction-category
  partner / statement-entry
repositories/                13 repositories — data access only
lib/
  money.ts                   ★ Money type + allocateMoney (largest remainder)
  dates.ts                   UTC period math + recurrence advance
  prisma.ts                  Prisma client singleton (pg adapter)
  env.ts                     Validated env vars
  result.ts  errors.ts       Result type + domain errors
  csv.ts  xlsx.ts  json.ts   Export + BigInt serialization helpers
  auth.ts  validation.ts  entry-status.ts  utils.ts
prisma/
  schema.prisma              The data model
  migrations/                SQL migrations (incl. the append-only trigger)
  seed.ts                    Reference data (categories, system accounts,
                             partners, users)
  seed-demo.ts               Realistic demo dataset (for demos)
tests/                       money, posting-service, dates, ledger-queries
auth.ts / auth.config.ts     Auth.js setup (Node + Edge-safe slice)
proxy.ts                     Route-protection middleware (Next 16 "proxy")
DEPLOYMENT.md                Step-by-step Vercel + Neon runbook
PROJECT_RULES.md             Authoritative engineering/accounting rules
```

---

## 9. Feature & route inventory

**Pages (15):** `/` (dashboard), `/login`, `/accounts`, `/accounts/[id]`,
`/categories`, `/income`, `/expenses`, `/transfers`, `/adjustments`,
`/distributions`, `/renewals`, `/ledger`.

**API endpoints (20):**
- `GET/POST /api/accounts`, `GET /api/accounts/[id]/export`
- `GET/POST /api/transaction-categories`
- `GET/POST /api/income`, `POST /api/income/[id]/confirm|payments|reverse`,
  `GET /api/income/export`
- `GET/POST /api/expenses`, `POST /api/expenses/[id]/confirm|payments|reverse`,
  `GET /api/expenses/export`
- `GET/POST /api/transfers`, `POST /api/transfers/[id]/reverse`
- `GET/POST /api/adjustments`, `POST /api/adjustments/[id]/reverse`
- `GET/POST /api/distributions`, `POST /api/distributions/preview`
- `GET/POST /api/renewals`, `POST /api/renewals/generate`
- `GET /api/ledger/export`
- `GET /api/health` (public), `/api/auth/[...nextauth]` (Auth.js)

---

## 10. How to run it locally (for a developer)

**Prerequisites:** Node.js ≥ 20, PostgreSQL 17, npm.

```bash
# 1. Install dependencies
npm install

# 2. Create a database named gy6_finance in PostgreSQL

# 3. Copy .env.example to .env and fill in:
#    DATABASE_URL, DIRECT_URL (same locally), AUTH_SECRET,
#    SEED_TASHFEEN_PASSWORD, SEED_ITMAM_PASSWORD
#    Generate AUTH_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 4. Apply migrations and generate the client
npx prisma migrate deploy
npx prisma generate

# 5. Seed reference data (+ optional demo data)
npm run db:seed
npm run db:seed:demo      # realistic sample data (optional)

# 6. Run
npm run dev               # http://localhost:3000
```

**Verification scripts:** `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`.

**Demo login:** `tashfeen@gy6.local` / `Tashfeen!2026Dev` (or
`itmam@gy6.local` / `Itmam!2026Dev`) — these are the seed values; change them
for any real use.

---

## 11. The offline demo bundle (for the internship defence)

A separate, self-contained Windows package was built at
`C:\Users\musta\Desktop\GY6-Finance-Demo` (~1.35 GB). It bundles the app, a
portable Node.js, a portable PostgreSQL (with sample data), and runs by
double-clicking `start.bat` — no installation or internet required. It is a
*deliverable*, not part of the repo. A study guide PDF
(`GY6-Finance-Defence-Guide.pdf`) accompanies it.

---

## 12. Deployment (Phase 3 — code ready, not yet live)

The code is prepared for **Vercel + Neon (hosted PostgreSQL)**:
- `proxy.ts` route protection, `/api/health`, production-safe seed.
- `vercel-build` script runs `prisma migrate deploy && next build`.
- `DATABASE_URL` = pooled connection (runtime); `DIRECT_URL` = direct
  connection (migrations).
- Full step-by-step instructions are in **`DEPLOYMENT.md`**.

**Remaining work:** create the Neon database + Vercel project, set environment
variables, deploy, seed production users, enter real opening balances.

---

## 13. What's left to do (roadmap & open items)

1. **Execute the cloud deployment** (Vercel + Neon) per `DEPLOYMENT.md`.
2. **Attachments UI** — the `Attachment` model exists but has no upload/view
   screen (receipts/invoices on income & expense entries).
3. **Partners admin UI** — partners and their split % are seed-only today;
   add screens to manage them and change ratios over time.
4. **Payment reversal UI** — `ReversalService` supports it; no button yet
   (no payment-listing surface).
5. **Ledger filtering & pagination** — the ledger view shows the latest 100
   entries; add date/account filters and paging.
6. **Broader automated test coverage** — currently money, posting engine,
   dates, and ledger queries are tested; the income/expense/payment/transfer/
   distribution/renewal services rely on manual verification.
7. **Minor:** the Next 16 `proxy.ts` naming is current; revisit if Auth.js
   guidance changes.

---

## 14. Conventions & gotchas (read before changing code)

- **Never use floats for money.** Always go through `lib/money.ts`.
- **Never write to `statement_entries` directly** — only the posting engine
  posts; the DB trigger will reject edits/deletes anyway.
- **All balance changes go through `PostingService.post()`** inside a
  transaction. Do not update `account.balance` by hand.
- **Services return a `Result` type** (`{ ok, value }` or `{ ok, error }`),
  not thrown errors, for expected failures. Routes map `!ok` to HTTP 400.
- **BigInt cannot be JSON-serialized** — use `lib/json.ts` (`jsonResponse`)
  for API responses, and pass money to client components as decimal strings.
- **Dates are UTC** and stored as `@db.Date`; use `lib/dates.ts` helpers.
- **Every write records an audit log** with `actorId`/`actorLabel` from the
  session (`lib/auth.ts` `getActor()`).
- **Prisma client is generated** to `lib/generated/prisma` (gitignored) — run
  `npx prisma generate` after any schema change.
- **Migrations are forward-only**; create them with `npm run prisma:migrate`.

---

## 15. Glossary (plain definitions)

- **Double-entry:** every transaction recorded as equal debit + credit.
- **Ledger:** the permanent, unchangeable list of all postings.
- **Accrual:** recognize income/expense when earned/incurred, not when paid.
- **Posting:** writing a balanced entry to the ledger.
- **Reversal:** a mirror entry that cancels a previous one (the way mistakes
  are fixed — nothing is deleted).
- **Normal balance:** the side (debit or credit) on which an account grows.
- **Distribution:** splitting quarterly profit between the partners.
- **Renewal:** a recurring income/expense template that generates draft
  entries when due.

---

*End of handoff. The Git repository at the GitHub URL in Section 1 is the
authoritative, complete source.*
