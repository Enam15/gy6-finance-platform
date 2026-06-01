# GY6 Finance Management System

Foundation for an internal finance and accounting platform for GY6. This repository contains the first implementation layer of the product: the database model, accounting rules, ledger services, core API routes, and early operational screens for accounts, income, expenses, and transaction categories.

The project is intentionally marked as a foundation-stage build. It is not a finished production product yet, but the codebase is structured around the financial controls that the final product will need: correctness, auditability, transaction safety, and maintainable accounting behavior.

## Current Scope

- Next.js application shell with dashboard navigation.
- Accounts module for business, founder, client, employee, subscription, and system accounts.
- Income and expense modules with draft and confirm workflows.
- Transaction category management.
- PostgreSQL schema managed with Prisma.
- Double-entry ledger posting services.
- Immutable statement-entry model with reversal-oriented correction flow.
- Audit-log model for state-changing operations.
- Unit tests for money handling and posting behavior.
- Project planning and design PDFs under [`docs/`](docs/).

## Documentation

The repository includes the planning documents that describe the product direction and implementation strategy:

- [Project Overview](docs/GY6%20Finance%20Platform%20-%20Project%20Overview.pdf)
- [Product Requirements Document](docs/GY6%20Product%20Requirements%20Document.pdf)
- [Technical Design Document](docs/GY6%20Technical%20Design%20Document.pdf)

See [`docs/README.md`](docs/README.md) for a short index.

## Architecture Principles

GY6 is accounting-critical software, so the codebase follows several non-negotiable rules:

- Income and expenses remain separate operational records.
- Confirmed ledger entries are immutable.
- Balance changes must be represented by double-entry postings.
- Financial operations must run inside database transactions.
- Corrections should be made through reversal or adjustment records, not silent edits.
- Monetary values are stored in integer minor units, not floating-point values.

The full engineering rules are documented in [`PROJECT_RULES.md`](PROJECT_RULES.md).

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Prisma 7
- PostgreSQL
- Tailwind CSS
- Base UI / shadcn-style components
- Vitest

## Getting Started

### Prerequisites

- Node.js 20 or newer
- PostgreSQL database
- npm

### Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

On Windows PowerShell, use this instead of `cp`:

```powershell
Copy-Item .env.example .env
```

Then update `.env` with your local or hosted PostgreSQL connection strings.

## Useful Scripts

```bash
npm run dev              # Start the development server
npm run build            # Build the Next.js app
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript checks
npm run test             # Run unit tests
npm run prisma:migrate   # Apply local Prisma migrations
npm run db:seed          # Seed reference data
```

## Repository Status

This repository currently represents the foundation of the GY6 finance platform. The main product experience, advanced reporting, payment workflows, attachment storage, authentication, authorization, deployment configuration, and production hardening are expected to evolve gradually.

## Security Note

Do not commit `.env` files, production secrets, database credentials, API keys, or GitHub tokens. Use `.env.example` for safe placeholder configuration only.
