# 19 — Installation & Developer Setup

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js | Version compatible with Next.js 16 / React 19 (Node 20+ recommended) |
| npm | Ships with Node; used as the package manager (`package-lock.json` is present) |
| Git | To clone the repository |
| A terminal that can run `npx` | For Prisma CLI commands |

No Docker, no local Postgres, and no Google Cloud account are required to get the app running locally — SQLite is used by default and Google Drive is optional.

## 2. Repository Setup

```bash
git clone https://github.com/ARULKINT/rowdesk.git
cd rowdesk
npm install
```

## 3. Environment Configuration

```bash
cp .env.example .env
```

At minimum, `DATABASE_URL="file:./dev.db"` (already the default in `.env.example`) is enough to run the app with no Google Drive integration. Leave `ENCRYPTION_KEY` and the `GOOGLE_*` variables blank to skip Drive setup entirely — the Admin → Google Drive page will simply show "not configured."

To enable Google Drive locally, follow the inline instructions in `.env.example` (create a Google Cloud project, enable the Drive API, configure the OAuth consent screen with the `drive.readonly` scope, create a Web-application OAuth client, register `http://localhost:3000/api/admin/drive/callback` as a redirect URI) and fill in all four `GOOGLE_*` variables plus `ENCRYPTION_KEY` (any long random string, e.g. `openssl rand -hex 32`).

## 4. Database Setup

```bash
npx prisma migrate dev    # creates dev.db and applies every migration in prisma/migrations/
npm run db:seed           # tsx prisma/seed.ts — see below
```

`npm run db:seed` is idempotent-ish (checks `count === 0` before creating) and produces:

| What | Detail |
|---|---|
| Admin user | username `admin`, password `ChangeMe123!` |
| Data Processor user | username `processor1`, password `ChangeMe123!` |
| Default template dictionary | Named "Default", active, seeded with the 3 built-in starter templates |
| Sample source file | `sample-leads.csv` with 5 realistic sample records |

**Change or remove these seeded credentials before using the app for anything beyond local development.**

## 5. Running Locally

```bash
npm run dev
```

Open `http://localhost:3000` — you land on `/login`. Sign in with the seeded admin or processor credentials above.

### Important gotcha: stale Prisma Client after a schema change

If `prisma/schema.prisma` is edited while `npm run dev` is already running, **restart the dev server** after running `prisma migrate dev`. Node does not hot-reload native/generated `node_modules` packages like the Prisma Client — a long-running dev server keeps the old client in memory even after `prisma generate` writes a new one to disk, producing `Cannot read properties of undefined` errors on any new model/field until restarted.

## 6. Testing

```bash
npm test          # vitest run
npx tsc --noEmit  # typecheck
npm run lint      # ESLint
```

Tests run against an isolated, auto-migrated SQLite file (`prisma/test.db`) — never against `dev.db`. See [17-testing.md](17-testing.md).

## 7. Building

```bash
npm run build     # next build (local build — does NOT run the Postgres-specific migrate step;
                   # that only happens in the Vercel build command, see 18-deployment.md)
npm run start      # serves the production build locally
```

## 8. Debugging Tips

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot read properties of undefined` on a Prisma model | Stale client after a schema edit | Restart `npm run dev` |
| `Error validating datasource db: the URL must start with the protocol file:` | `DATABASE_URL` in the current shell/process environment is set to a Postgres URL, overriding `.env` (dotenv does not override existing `process.env` values by default) | Unset the stray shell env var, or restart the dev server from a clean shell |
| Google Drive shows "not configured" | One or more `GOOGLE_*` env vars unset | Fill in `.env`, restart the dev server |
| `EPERM`/rename error running `prisma generate` | A running dev server holds a lock on the query-engine DLL | Stop the dev server (or delete `node_modules/.prisma/client` and regenerate) before switching schemas |

## 9. Contributing / Making a Change End-to-End

1. Edit code under `src/`.
2. If the change touches the database, follow the dual-schema migration workflow in [18-deployment.md](18-deployment.md) §2.
3. Add/update tests under the relevant `src/lib/*.test.ts`.
4. Run `npm test`, `npx tsc --noEmit`, `npm run lint`.
5. Manually verify the change in the browser against `npm run dev` (and, for anything Drive-related, against a real connected account).
6. Commit, push, and deploy per [18-deployment.md](18-deployment.md).
