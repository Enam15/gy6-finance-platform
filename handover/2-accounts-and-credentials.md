# 2 · Accounts & Credentials

This is what to take ownership of, and how to receive the secret values safely.

## How secrets are handed over (read this first)

**No real password, connection string, or key is written in this handover** — on
purpose. Anything committed to a repo or sent over chat/email should be treated
as leaked. So this document lists *what* the secrets are and *where* they go;
the actual values are transferred separately:

- Use a **password manager** (1Password, Bitwarden, Dashlane) shared vault, or a
  one-time secret link (e.g. onetimesecret.com). Not email, not chat.
- `credentials-template.env` here is the checklist to fill in — keep the
  completed copy **only** in your password manager, never in the repo.
- After the handover, **rotate everything** you can (see the last section). The
  cleanest handover assumes every value here was seen by someone who no longer
  needs it.

---

## The accounts to take over

| Service | What it is | What needs to happen |
|---|---|---|
| **GitHub** | The code repository: `github.com/Enam15/gy6-finance-platform` | Transfer the repo to a GY6-owned GitHub account or organisation, **or** have the current owner add a GY6 account as an admin/owner. This is where all code and deploy triggers come from. |
| **Vercel** | The web host running the live site | Either transfer the project to a GY6 Vercel team, **or** create a fresh GY6 Vercel project and import the GitHub repo (see `4-run-and-deploy.md`). Re-importing is often cleaner than transferring. |
| **Database (Neon)** | Where the data lives | GY6 creates its **own** fresh Neon database — see `3-database-handover.md`. There's no existing data to migrate, so the app builds itself and you enter opening balances by hand. The old Neon project is retired afterwards. |
| **App logins** | The in-app user accounts (currently for the two partners) | GY6 re-creates these with its own emails and passwords by re-seeding — see `4-run-and-deploy.md` §5. The old logins don't need to carry over. |
| **Custom domain** *(if any)* | A branded web address | The live site is on a `vercel.app` address, so there is nothing to transfer unless a custom domain was added later. If one was, move it in Vercel → Settings → Domains. |

---

## The secret values the running app needs

The app itself only needs **three** settings to run. They live in Vercel's
Environment Variables (production) and in a local `.env` file for development.
Full table and how to set them is in `4-run-and-deploy.md`.

| Setting | What it is | At handover |
|---|---|---|
| `DATABASE_URL` | Connection to your database (pooled) | **New** — points at GY6's own database. |
| `DIRECT_URL` | Connection to your database (direct, for migrations) | **New** — same database, direct connection. |
| `AUTH_SECRET` | A random key that signs login sessions | **Generate a fresh one.** Regenerating it simply logs everyone out once — harmless at handover. Command is in `4-run-and-deploy.md`. |

A few more (`SEED_*`) are used only on a laptop when creating login users; they
never need to live in Vercel. All of them are listed in `credentials-template.env`.

---

## After the handover: rotate everything

Treat every credential involved in the old setup as needing replacement:

1. **Database password** — resolved by moving to your own database (step 3 of
   the handover). If for any reason you keep the existing Neon project instead,
   reset its password in the Neon console and update `DATABASE_URL` / `DIRECT_URL`.
2. **`AUTH_SECRET`** — generate a new one for the GY6 deployment.
3. **App login passwords** — set fresh ones when you seed your own users.
4. **Any API tokens** created during development (GitHub personal access tokens,
   Vercel tokens) — revoke the old owner's and issue your own.

Once GY6 controls the GitHub repo, the Vercel project, and its own database with
its own secrets, the previous owner's access is fully severed.
