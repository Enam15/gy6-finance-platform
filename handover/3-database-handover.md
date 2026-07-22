# 3 · Database Setup

**Your situation is the simple one:** there is no existing data to preserve, and
GY6 will run its own **Neon** database. So there is nothing to export or migrate —
GY6 creates a fresh database, the app builds its own structure on the first
deploy, and you enter the current balances by hand. This document is that path.

You do **not** need the previous owner's database or any export file. The old
Neon project can simply be retired once GY6 is live (see the end).

---

## §1 — Create GY6's own Neon database

On **GY6's own Neon account** (free tier is fine):

1. Neon console → **Create project** → name it e.g. `gy6-finance`, pick a region.
2. Open **Connection Details** and copy **both** connection strings:
   - **Pooled** — the host contains `-pooler`. This becomes `DATABASE_URL`.
   - **Direct** — the same host **without** `-pooler`. This becomes `DIRECT_URL`.
   Toggle "Connection pooling" in the Neon UI to see each form. Both end in
   `?sslmode=require` — keep that.

That's the only Neon setup needed. (Any PostgreSQL 17 host works — Supabase,
Railway, RDS, self-managed — Neon is just what the app was built and tested on.)

---

## §2 — Let the app build the structure

You don't create tables by hand. When GY6 first deploys the app (see
`4-run-and-deploy.md`), its build step runs the database migrations
automatically and creates every table, index, and the append-only ledger
protection.

Then the **seed** loads the reference data the app needs to work — the account
categories, the internal system accounts, the two partners, and the login users.
That command is in `4-run-and-deploy.md` §5.

So the order is just: create the Neon database (§1) → deploy (`4-run-and-deploy.md`
§B) → seed (`4-run-and-deploy.md` §5). No SQL to run by hand.

---

## §3 — Enter the opening balances

After seeding, the books are empty but correct. For each real account that
already holds money, use the in-app **Adjustments** screen to set its starting
balance: pick the account, enter its real current amount, reason "Opening
balance". This records a proper posted entry, so the books start correct and
auditable rather than with numbers typed straight into the database.

Then create the real categories, accounts, clients, and any recurring templates
as you go.

---

## The database structure snapshot (offline ZIP only)

The offline handover ZIP includes `database/local-dev-snapshot.sql` — a snapshot
of the developer's local database (full table structure plus a little sample
data). It is **not committed to this repository** and **you don't need it**,
since the app builds its own structure. It's there only as a structure reference
and to rehearse a restore. The authoritative structure is `prisma/schema.prisma`
and the migrations in `prisma/migrations/`, which are in this repo.

---

## If real data DOES accumulate before handover

You said there's none today. If you keep using the live app and real
transactions build up before GY6 takes over, you'd then want to copy that data
across instead of starting empty. That's a standard PostgreSQL export/restore:

```bash
# Export from the old Neon (its DIRECT connection string), before disconnecting:
pg_dump "postgresql://USER:PASSWORD@OLD-DIRECT-HOST/neondb?sslmode=require" \
  --no-owner --no-privileges --format=plain -f gy6-data.sql

# Load into GY6's new Neon (its DIRECT connection string):
psql "postgresql://USER:PASSWORD@NEW-DIRECT-HOST/neondb?sslmode=require" -f gy6-data.sql
```

The export carries the structure, data, and migration history together, so the
app treats the database as already up to date. But for your stated case — no data
— ignore this and use §1–§3.

---

## Retiring the old Neon project

Once GY6 is live on their own database and you've confirmed it works, you can
**delete or disconnect the old Neon project** from your account at any time.
There's no data to lose, so no special timing is needed. Deleting it also closes
off the database password that was exposed during development.
