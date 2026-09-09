# 19 — Installation & Developer Setup

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js | Version compatible with Next.js 16 / React 19 (Node 20+ recommended) |
| npm | Ships with Node; used as the package manager (`package-lock.json` is present) |
| Git | To clone the repository |
| A terminal that can run `npx` | For Prisma CLI commands |

No Docker or local Postgres install is needed — local dev connects straight to the real (production) Neon Postgres database via `.env.local`. No Google Cloud account is required either — Google Drive is optional.

## 2. Repository Setup

```bash
git clone https://github.com/ARULKINT/rowdesk.git
cd rowdesk
npm install
```

## 3. Environment Configuration

```bash
vercel env pull .env.local   # pulls the real DATABASE_URL and other secrets from Vercel
cp .env.example .env
```

`.env.local` (from `vercel env pull`) takes precedence over `.env` and provides `DATABASE_URL` — there is nothing to fill in for the database itself. In `.env`, leave `ENCRYPTION_KEY` and the `GOOGLE_*` variables blank to skip Drive setup entirely — the Admin → Google Drive page will simply show "not configured."

To enable Google Drive locally, follow the inline instructions in `.env.example` (create a Google Cloud project, enable the Drive API, configure the OAuth consent screen with the `drive.readonly` scope, create a Web-application OAuth client, register `http://localhost:3000/api/admin/drive/callback` as a redirect URI) and fill in all four `GOOGLE_*` variables plus `ENCRYPTION_KEY` (any long random string, e.g. `openssl rand -hex 32`).

## 4. Database

```bash
npx prisma generate
```

There is no seed step and no local database to set up — you're pointed at the real database, with real data and real accounts already in it. Log in with a real account (ask an existing admin to create one for you from Admin → Users if you don't have one).

## 5. Running Locally

```bash
npm run dev
```

Open `http://localhost:3000` — you land on `/login`.

### Important gotcha: stale Prisma Client after a schema change

If `prisma/schema.prisma` is edited while `npm run dev` is already running, **restart the dev server** after running `prisma migrate dev`. Node does not hot-reload native/generated `node_modules` packages like the Prisma Client — a long-running dev server keeps the old client in memory even after `prisma generate` writes a new one to disk, producing `Cannot read properties of undefined` errors on any new model/field until restarted.

## 6. Testing

```bash
npm test                                    # vitest run — database-backed tests skip themselves
TEST_DATABASE_URL="<postgres-url>" npm test  # full suite, against a disposable Postgres database
npx tsc --noEmit  # typecheck
npm run lint      # ESLint
```

There is no local/disposable database, so `auth.test.ts` and `queue.test.ts` (the tests that reset state by deleting rows) only run when `TEST_DATABASE_URL` points at a database you're fine with being wiped repeatedly — never production. See [17-testing.md](17-testing.md).

## 7. Building

```bash
npm run build     # next build (local build — does NOT run the migrate step;
                   # that only happens in the Vercel build command, see 18-deployment.md)
npm run start      # serves the production build locally
```

## 8. Debugging Tips

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot read properties of undefined` on a Prisma model | Stale client after a schema edit | Restart `npm run dev` |
| `Error validating datasource db: the URL must start with the protocol postgresql://` | `DATABASE_URL` isn't resolving to a Postgres connection string — usually `.env.local` is missing or a stray shell env var is overriding it | Run `vercel env pull .env.local`; check for a stray `$env:DATABASE_URL`/`DATABASE_URL` set in your shell |
| Google Drive shows "not configured" | One or more `GOOGLE_*` env vars unset | Fill in `.env`, restart the dev server |
| `EPERM`/rename error running `prisma generate` | A running dev server holds a lock on the query-engine DLL | Stop the dev server (or delete `node_modules/.prisma/client` and regenerate) before switching schemas |

## 9. Contributing / Making a Change End-to-End

1. Edit code under `src/`.
2. If the change touches the database, follow the dual-schema migration workflow in [18-deployment.md](18-deployment.md) §2.
3. Add/update tests under the relevant `src/lib/*.test.ts`.
4. Run `npm test`, `npx tsc --noEmit`, `npm run lint`.
5. Manually verify the change in the browser against `npm run dev` (and, for anything Drive-related, against a real connected account).
6. Commit, push, and deploy per [18-deployment.md](18-deployment.md).
