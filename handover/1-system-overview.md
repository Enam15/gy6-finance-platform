# 1 · System Overview

## What it is

GY6 Finance is an internal **double-entry bookkeeping** web application for the
GY6 agency and its two partners. It is not a simple form-and-list app — it keeps
real books: every movement of money is recorded as a balanced pair of entries on
a permanent ledger, money is stored as exact whole numbers (never rounded
decimals), and mistakes are corrected by reversing entries rather than edits.

It is live at **https://gy6-finance-platform.vercel.app** behind a login.

## What it does

| Area | What you can do |
|---|---|
| **Dashboard** | Cash on hand, money owed to you / that you owe, income-vs-expense charts, filterable by quarter, year, or a custom date range. |
| **Accounts** | Your bank accounts, plus clients, employees, subscriptions and founders. Each has a running balance and its own statement. |
| **Income & Expenses** | Record what's earned or owed as a draft, confirm it onto the books, then record payments against it. Per-entry notes, file attachments, and recurring templates. |
| **Payments** | Mark an entry paid — the money lands in (or comes out of) a chosen bank account. |
| **Transfers** | Move cash between your own bank accounts. |
| **Adjustments** | Correct a balance through a proper posted adjustment (e.g. entering opening balances at go-live). |
| **Distributions** | Split quarterly profit between the partners by their agreed percentages. |
| **Invoices** | Create, number, and print client invoices on GY6's own design, with a currency picker and a signature. |
| **Ledger** | The permanent record of every posting. Reversed entries are kept but marked. |
| **Exports** | Download any list or statement as CSV or Excel. |

Every change is written to an **audit log** that records who did what and when.

## The technology, in plain terms

- **The website** is built with **Next.js** (a React framework). It runs on
  **Vercel**, a hosting service that rebuilds and redeploys the site
  automatically whenever code is pushed to GitHub.
- **The data** lives in a **PostgreSQL** database — currently hosted on
  **Neon**. The app talks to it through **Prisma**, a tool that manages the
  database structure and generates the code to query it.
- **Logins** are handled by **Auth.js**. Passwords are hashed (never stored in
  plain text).

Full version list is in `../PROJECT_CONTEXT.md` §3, and the exact package
versions are in `../package.json`.

## The shape of the code

The code is organised in clear layers, so a change happens in a predictable
place:

```
Pages you see            →  app/**            (screens and buttons)
        │
Request handlers         →  app/api/**        (receive a click, check the login)
        │
Services                 →  services/**       (ALL the accounting rules live here)
        │
Repositories             →  repositories/**   (read and write the database)
        │
Database                 →  PostgreSQL
```

The heart of it is one file — `services/posting-service.ts` — the single place
every balance change flows through. It writes both sides of each entry, updates
the balances, and records the audit log, all inside one database transaction so
a half-finished change can never be saved.

## Current status

- **Live and in use**, deployed on Vercel + Neon.
- **100 commits** of history, each with a detailed message.
- **65 automated tests** pass, alongside type-checking, linting, and a clean
  production build.
- Feature-complete against the original requirements, plus a large round of
  agency feedback (invoices, editable entries, custom account fields, the
  dashboard date range, and more).

## Known gaps and roadmap

Small, non-blocking items — nothing here stops day-to-day use:

- **Transaction categories** can be created but not yet renamed.
- **Partners and their split %** are set in the seed data; there's no admin
  screen to change the ratio over time yet.
- **Ledger filtering/paging** shows the most recent 100 entries; date/account
  filters would help once volume grows.
- Broader automated test coverage of the payment/transfer/distribution services
  (the core money engine and ledger are already well covered).

The fuller roadmap is in `../PROJECT_CONTEXT.md` §13. (Note that document
predates the invoices module and the latest feedback round, so treat its "not
yet built" list as a superset — several items on it are now done.)
