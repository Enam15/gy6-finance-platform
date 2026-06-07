# Deploying GY6 Finance to production

This is the step-by-step runbook to take the app live on **Vercel** with a
**Neon** PostgreSQL database. You run the cloud steps; the code is already
prepared for them.

Estimated time: ~30–45 minutes for a first deploy.

---

## 0. Prerequisites

- The repo is pushed to GitHub (`Enam15/gy6-finance-platform`).
- A **Vercel** account (free Hobby tier is fine): https://vercel.com
- A **Neon** account (free tier is fine): https://neon.tech
- Node.js installed locally (you already have it) — needed once to seed.

---

## 1. Create the Neon database

1. In the Neon console, **Create project** (name it e.g. `gy6-finance`,
   region closest to you).
2. After it creates, open **Connection Details**. You need **two**
   connection strings:
   - **Pooled** — the host contains `-pooler` (e.g.
     `ep-cool-name-12345-pooler.eu-central-1.aws.neon.tech`). This is your
     `DATABASE_URL`.
   - **Direct** — the same host *without* `-pooler`. This is your
     `DIRECT_URL`.
   Toggle the "Connection pooling" switch in the Neon UI to see each form.
   Both end with `?sslmode=require` — keep that.
3. Copy both strings somewhere safe for the next steps.

> Why two: the app uses the pooled string so serverless functions don't
> exhaust connections; Prisma migrations use the direct string because
> poolers break the locks that schema changes rely on.

---

## 2. Generate an AUTH_SECRET

Run locally and copy the output:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

This signs the login session. Use a **fresh** one for production (do not
reuse the dev value).

---

## 3. Create the Vercel project

1. Vercel dashboard → **Add New… → Project**.
2. **Import** the `gy6-finance-platform` GitHub repo.
3. Framework preset auto-detects **Next.js**. Leave build settings default —
   the repo's `vercel-build` script (`prisma migrate deploy && next build`)
   runs automatically, so the first deploy creates all database tables.
4. **Before** clicking Deploy, expand **Environment Variables** and add the
   ones in the next step.

---

## 4. Set environment variables (Vercel → Project → Settings → Environment Variables)

Add these for the **Production** environment:

| Name | Value |
|------|-------|
| `DATABASE_URL` | the Neon **pooled** string (from step 1) |
| `DIRECT_URL` | the Neon **direct** string (from step 1) |
| `AUTH_SECRET` | the value from step 2 |

That's all the app needs at runtime. (The `SEED_*` variables are only needed
on your machine when you seed in step 6 — they don't have to live in Vercel.)

Then trigger the deploy (Deploy button, or it builds on import).

---

## 5. Confirm the deploy + migrations

1. Watch the Vercel build log. You should see `prisma migrate deploy` apply
   all migrations, then `next build` succeed.
2. Once live, open `https://<your-app>.vercel.app/api/health` — it should
   return `{"status":"ok",...}`. That confirms the app can reach the
   database.

If the build fails on `migrate deploy`, the most common cause is `DIRECT_URL`
not being set or pointing at the pooled host — fix and redeploy.

---

## 6. Seed the production reference data + users

The database has tables now but no reference data (account categories, the
internal system accounts, partners) or login users. Seed once from your
machine, pointed at production.

Pick **strong** passwords (≥ 12 chars). In PowerShell, from the repo folder:

```powershell
$env:DATABASE_URL   = "<Neon DIRECT string>"
$env:NODE_ENV       = "production"
$env:SEED_TASHFEEN_EMAIL    = "tashfeen@gy6.com"
$env:SEED_TASHFEEN_PASSWORD = "<strong password>"
$env:SEED_ITMAM_EMAIL       = "itmam@gy6.com"
$env:SEED_ITMAM_PASSWORD    = "<strong password>"
npm run db:seed
# clean the sensitive vars out of this shell session afterwards:
Remove-Item Env:SEED_TASHFEEN_PASSWORD, Env:SEED_ITMAM_PASSWORD
```

Expect the log to list the 6 categories, 4 system accounts, 2 partners, and
2 app users. (`NODE_ENV=production` makes the seed reject weak passwords.)

> Re-running the seed is safe — it upserts. It will **not** overwrite an
> existing user's password unless you also set `SEED_RESET_PASSWORDS=1`.

---

## 7. Log in + smoke test

1. Open `https://<your-app>.vercel.app` — you should be redirected to
   `/login`.
2. Log in with one of the seeded accounts.
3. Quick checks: create a test account, record + confirm an income, record a
   payment, download an export, then reverse the test entry. Confirm the
   dashboard updates.

---

## 8. Enter real opening balances

For each real account that already holds money at go-live, set its starting
balance via **Adjustments** (or the opening-balance flow): pick the account,
enter its real current balance, reason "Opening balance at go-live". This
posts against the internal Opening Balances account so the books start
correct.

Then create your real categories, accounts, and any renewal templates.

---

## Custom domain (optional)

Vercel → Project → **Settings → Domains** → add your domain and follow the
DNS instructions. Auth already trusts the host, so login keeps working.

---

## Troubleshooting

- **Build fails at `prisma migrate deploy`** — `DIRECT_URL` missing or set to
  the pooled host. Set it to the direct (non-`-pooler`) string; redeploy.
- **`/api/health` returns 503** — the app can't reach the DB. Check
  `DATABASE_URL` (pooled string, `?sslmode=require` present).
- **Login fails / callback host error** — set `AUTH_TRUST_HOST=true` in
  Vercel env (the code already sets `trustHost`, this is a belt-and-suspenders
  fallback) and confirm `AUTH_SECRET` is set.
- **"Too many connections"** — make sure `DATABASE_URL` is the **pooled**
  Neon string, not the direct one.

---

## Routine operations after go-live

- **Deploy a change**: push to the GitHub default branch — Vercel rebuilds and
  applies any new migrations automatically.
- **Schema change**: develop with `npm run prisma:migrate` locally; commit the
  generated migration; the next deploy applies it via `vercel-build`.
- **Rotate a password**: set the `SEED_*` vars + `SEED_RESET_PASSWORDS=1` and
  re-run `npm run db:seed` against `DIRECT_URL`.
- **Back up**: Neon keeps automatic point-in-time backups; review the
  retention window on your plan.
