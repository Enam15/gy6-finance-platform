# 4 · Run & Deploy

How to get the code, run it on a laptop, and put it live. The original, more
detailed runbook is at the repo root, `../DEPLOYMENT.md` — this is the handover-
focused version.

## Getting the code

- **From GitHub** (once you have access — see `2-accounts-and-credentials.md`):
  `git clone https://github.com/Enam15/gy6-finance-platform.git`
- You already have it if you're reading this inside a clone of the repository.
- The offline handover ZIP also ships the whole repository as a single bundle
  file, restorable with `git clone <bundle-file> gy6-finance-platform`.

## The settings the app needs

The app reads these from a `.env` file locally, and from **Vercel → Settings →
Environment Variables** in production. A blank template is in
`credentials-template.env`; the reference is `../.env.example`.

| Setting | Needed where | What it is |
|---|---|---|
| `DATABASE_URL` | local + Vercel | Database connection the app uses. In production, the **pooled** string. |
| `DIRECT_URL` | local + Vercel | Database connection for structure changes/migrations. The **direct** string. Locally, same as `DATABASE_URL`. |
| `AUTH_SECRET` | local + Vercel | Random key that signs login sessions. Generate one (below). |
| `SEED_TASHFEEN_EMAIL` / `SEED_TASHFEEN_PASSWORD` | local only (seeding) | First login user's email + password. |
| `SEED_ITMAM_EMAIL` / `SEED_ITMAM_PASSWORD` | local only (seeding) | Second login user's email + password. |
| `SEED_RESET_PASSWORDS` | local only | Set to `1` to overwrite existing users' passwords when re-seeding; otherwise `0`. |

Generate a fresh `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## §A — Run it on a laptop (for development)

Prerequisites: **Node.js 20+**, **PostgreSQL 17**, npm.

```bash
npm install                       # install dependencies
cp .env.example .env              # then edit .env with your values
                                  # (PowerShell: Copy-Item .env.example .env)

npx prisma migrate deploy         # build the database structure
npx prisma generate               # generate the database client code

npm run db:seed                   # create reference data + login users
npm run dev                       # http://localhost:3000
```

This is a fresh, empty database, so `migrate deploy` builds all the tables and
`db:seed` fills in the reference data and login users.

Checks you can run any time: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`.

---

## §B — Put it live (production on Vercel)

1. **Vercel → Add New → Project**, import the GitHub repo. It auto-detects
   Next.js; leave the build settings alone. (The repo's build command already
   runs the database migrations before building, so the first deploy sets up an
   empty database automatically — not needed if you restored data, but harmless.)

2. **Before the first deploy**, add the environment variables for the
   **Production** environment: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (the
   three from the table above). The `SEED_*` ones are not needed in Vercel.

3. **Deploy.** Watch the build log; it should finish without errors.

4. **Confirm it's alive:** open `https://<your-app>.vercel.app/api/health` — it
   should return `{"status":"ok",...}`. That proves the app reached the database.

**Deploying changes afterwards:** push to the `master` branch on GitHub. Vercel
rebuilds and applies any new database changes automatically. That's the whole
workflow.

---

## §5 — Create your own login users

The app has no public sign-up — users are created by seeding. Do this once from a
laptop, pointed at the **production** database's direct connection.

Set the values (PowerShell shown; use strong passwords, 12+ characters):

```powershell
$env:DATABASE_URL           = "<your production DIRECT connection string>"
$env:NODE_ENV               = "production"
$env:SEED_TASHFEEN_EMAIL    = "tashfeen@gy6.com"
$env:SEED_TASHFEEN_PASSWORD = "<strong password>"
$env:SEED_ITMAM_EMAIL       = "itmam@gy6.com"
$env:SEED_ITMAM_PASSWORD    = "<strong password>"
npm run db:seed
# clear the sensitive values from this terminal afterwards:
Remove-Item Env:SEED_TASHFEEN_PASSWORD, Env:SEED_ITMAM_PASSWORD
```

- Re-running the seed is safe. It adds/updates reference data and users without
  duplicating anything, and won't touch existing passwords unless you set
  `SEED_RESET_PASSWORDS=1`.

Then open the site and sign in with the account you just created. Next, enter
your opening balances (`3-database-handover.md` §3). When you can sign in and the
balances look right, the handover is complete.
