# 5 · Codebase & Maintenance

For whoever will change or extend the code. Read this before your first edit.
The authoritative, longer versions are `../PROJECT_RULES.md`
(the engineering rules) and `../PROJECT_CONTEXT.md` (the full tour).

## Where things live

```
app/                Screens and API endpoints (Next.js App Router)
  page.tsx          Dashboard
  accounts/ income/ expenses/ transfers/ adjustments/
  distributions/ ledger/ invoices/ categories/ login/
  api/**/route.ts   The endpoints the screens call
components/          Reusable UI (sidebar, dialogs, tables, charts)
services/           ★ ALL accounting logic — one file per area
  posting-service.ts   ★★ the double-entry engine; every balance change goes here
repositories/       Database reads/writes only, no logic
lib/
  money.ts          ★ money type + exact allocation (never use floats for money)
  prisma.ts         Database client
  dates.ts          UTC date + recurrence helpers
  auth.ts           Who is the logged-in user
prisma/
  schema.prisma     The data model (source of truth for the structure)
  migrations/        Ordered structure changes (17 of them)
  seed.ts            Reference data + login users
tests/              Automated tests
```

## How a change flows

A button in a screen calls an endpoint in `app/api/**`, which checks the login
and hands off to a **service**. The service holds the rules and calls
**repositories** to touch the database. Screens that only display data call the
service directly. So: **logic goes in services, never in components.**

## The rules you must not break

These come from the accounting nature of the app. Breaking one can silently
corrupt the books.

1. **Never edit or delete a ledger entry.** `statement_entries` is append-only —
   the database itself blocks updates and deletes. Fix mistakes by posting a
   **reversal** (a mirror entry) or an **adjustment**. This is why "delete a
   transaction" is deliberately not a feature.

2. **Never change a balance by hand.** Every balance change must go through
   `PostingService.post()`, which writes both sides of the entry, updates the
   balances, and records an audit log — all in one database transaction. Don't
   write `account.balance = …` anywhere else.

3. **Money is whole numbers, never decimals/floats.** It's stored in the
   smallest unit (like paisa/cents) as a `BigInt`, always through `lib/money.ts`.
   A floating-point amount will eventually be wrong by a rounding error, which is
   unacceptable in accounting.

4. **Every money operation runs inside a database transaction**, so a
   half-finished change can never be saved.

5. **Every state change writes an audit log** (who, what, before/after, when),
   taken from the logged-in user.

6. **Income and expenses stay in separate tables.** They can share code, not
   storage.

7. **Financial data is never public.** All the real routes require a login;
   keep it that way.

Fuller list with the reasoning: `../PROJECT_RULES.md`.

## Everyday tasks

```bash
npm run dev              # run locally
npm test                 # run the automated tests
npm run typecheck        # check types
npm run lint             # check style
npm run build            # production build (what Vercel runs)
```

**Changing the database structure:**
1. Edit `prisma/schema.prisma`.
2. `npm run prisma:migrate` — creates a migration file and applies it locally.
3. Commit the new file under `prisma/migrations/`.
4. Push to `master` — the next deploy applies it in production automatically.

Migrations only go forward; you never hand-edit an old one.

**Before committing anything**, run the four checks above — they're the same
gates the project has always used, and they all currently pass.

## Two small operational notes

- After changing the schema, run `npx prisma generate` so the database client
  code is regenerated (it lives in `lib/generated/prisma`, which is not committed
  and is rebuilt automatically on install).
- Money values are passed to the browser as plain strings, and API responses use
  a helper (`lib/json.ts`) because the big-number type can't be turned into JSON
  directly. If you add an endpoint that returns money, use that helper.

## Getting help from the history

Every commit has a descriptive message explaining what changed and why. To
understand any piece of code, `git log` and `git blame` on that file will show
the reasoning at the time it was written.
