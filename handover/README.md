# GY6 Finance — Handover Package

**Prepared:** July 2026 · **Code state:** commit `81e0502` on branch `master`
**Live app:** https://gy6-finance-platform.vercel.app

This folder hands the GY6 Finance Management System over to GY6: the context, the
credentials, and how to run it. Read this page first — it tells you what
everything is and the order to do things in.

> You're reading this **inside the code repository**, so the codebase is all
> around you. The same guide is also distributed as a standalone offline ZIP that
> additionally bundles the repository as a single file and a database structure
> snapshot; those two extras aren't stored in git.

---

## Good news: this is the simple case

There is **no existing data to migrate** — GY6 starts with a fresh database on
its own Neon account, and the app builds itself. That removes the only
time-sensitive, irreversible step a handover like this usually has. Nothing here
has to be rushed, and nothing can be lost.

The one loose end is housekeeping, not urgent: the database password used during
development was shared over chat, so it should be considered compromised. It
closes off by itself the moment the old Neon project is deleted (see
`2-accounts-and-credentials.md`). Since there's no real data behind it, there's
nothing sensitive at stake in the meantime.

---

## What's in this folder

| Item | What it is |
|---|---|
| **`README.md`** | This page. |
| **`1-system-overview.md`** | What the app is, what it does, the tech, the shape of the code. Start here to understand it. |
| **`2-accounts-and-credentials.md`** | Every account and service to take ownership of (GitHub, Vercel, database, logins) and how to transfer them safely. |
| **`3-database-handover.md`** | Setting up GY6's own fresh database and entering opening balances. No data to migrate. |
| **`4-run-and-deploy.md`** | Run it on a laptop, and deploy it to the web. Full list of the settings it needs. |
| **`5-codebase-and-maintenance.md`** | How the code is organised and the handful of rules you must not break when changing it. |
| **`credentials-template.env`** | A fill-in-the-blanks list of every secret value, to complete through a password manager. |

The deeper, original documents live at the **repository root**, one level up:
`../PROJECT_CONTEXT.md` (the full tour), `../PROJECT_RULES.md` (the engineering
rules), `../DEPLOYMENT.md` (the detailed deploy runbook), and `../.env.example`
(the settings template).

---

## The handover in five steps

Do them in this order. Each step points to the document with the detail.

1. **Take ownership of the accounts** → `2-accounts-and-credentials.md`.
   GitHub repo and Vercel project — have the previous owner transfer or invite
   you. Receive any secret values through a password manager.

2. **Create your own Neon database** → `3-database-handover.md` §1.
   A fresh, empty PostgreSQL database on GY6's own Neon account. Copy its two
   connection strings.

3. **Deploy, pointed at your database** → `4-run-and-deploy.md` §B.
   Set the connection strings and a fresh login secret in Vercel and deploy. The
   build creates all the tables automatically. Confirm the health check passes.

4. **Seed reference data + your own logins** → `4-run-and-deploy.md` §5.
   One command loads the categories, system accounts, partners, and your login
   users. Then sign in.

5. **Enter opening balances** → `3-database-handover.md` §3.
   For each account that already holds money, set its starting balance through
   the in-app Adjustments screen.

When you can sign in and the accounts show the right balances, the handover is
complete and the old Neon project can be deleted.

---

## If you only have five minutes

GY6 Finance is a double-entry bookkeeping web app for the agency — income,
expenses, payments, transfers, partner profit splits, invoices, and a dashboard,
all behind a login. It runs on **Vercel** (the web host) with a **PostgreSQL**
database (currently on **Neon**). You deploy a change by pushing to the `master`
branch on GitHub; Vercel rebuilds automatically.

The one thing to understand before touching it: the ledger is **append-only**.
Money records are never edited or deleted — mistakes are fixed by posting a
reversing entry. This is enforced by the database itself. `5-codebase-and-maintenance.md`
explains the few rules that follow from this.
