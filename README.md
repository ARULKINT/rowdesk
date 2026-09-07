# Rowdesk

An internal tool for cleaning and enriching scraped business-listing data (Google Maps exports) and sending domain-protection outreach. Multiple team members pull records from a shared, locked queue one at a time; an admin manages users, source files, templates, and Google Drive ingestion, and can see stats and a full audit trail.

## Architecture

- **Next.js 16 (App Router) + TypeScript**, Route Handlers for the API, Server Components for data-loading pages.
- **Prisma ORM** over **SQLite** in local dev, **PostgreSQL** in production — the only change between the two is `prisma/schema.prisma`'s `datasource.provider` and `DATABASE_URL` (see [Database](#database)).
- **Session auth**: bcrypt-hashed passwords, an httpOnly session cookie backed by a `Session` table (no third-party auth provider). Every route is authorized server-side — `requireUser()` / `requireAdmin()` in Server Components, a `getApiUser()` check at the top of every mutating Route Handler.
- **Locked shared queue**: visiting `/dashboard` atomically claims the next available record via a compare-and-swap `updateMany` with a retry loop (`src/lib/queue.ts`) — portable to Postgres without raw `SELECT FOR UPDATE`. Stale claims self-heal on the next claim attempt (configurable timeout in Admin → Settings).
- **Google Drive ingestion**: OAuth2 (read-only `drive.readonly` scope) via `googleapis`, tokens encrypted at rest (AES-256-GCM). Scanning a configured folder classifies each CSV as New/Updated/Unchanged by comparing Drive's `modifiedTime` to the last version we successfully processed; each processed file becomes a **new** `SourceFile` version rather than overwriting the old one, so already-claimed/completed records are never touched.
- **Design tokens**: the color system is CSS custom properties (`src/app/globals.css`), not Tailwind's palette — Tailwind is used for layout/spacing utilities only. Typography: Libre Franklin (display), IBM Plex Sans (UI), IBM Plex Mono (data/counters).

## Local development

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL at minimum
npx prisma migrate dev    # creates dev.db and applies migrations
npm run db:seed           # creates a dev admin + processor account, default templates
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`.

**Seeded dev credentials** (see `prisma/seed.ts`) — change or remove before anything but local dev:
- Admin: `admin` / `ChangeMe123!`
- Data Processor: `processor1` / `ChangeMe123!`

**Note on schema changes**: if you edit `prisma/schema.prisma` while `npm run dev` is already running, restart it after `prisma migrate dev`. Node doesn't hot-reload native `node_modules` packages like the generated Prisma Client, so a long-running dev server keeps the old client in memory even after `prisma generate` writes a new one to disk — you'll see `Cannot read properties of undefined` errors on any new model until you restart.

## Environment variables

See `.env.example` for the full annotated list. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file path in dev, Postgres connection string in production |
| `ENCRYPTION_KEY` | Only if connecting Google Drive | Encrypts stored OAuth tokens at rest (any long random string, e.g. `openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Only if connecting Google Drive | OAuth client from Google Cloud Console — see `.env.example` for setup steps |

Never commit `.env`. `.env.example` documents the shape without secrets.

## Database

Two parallel Prisma schemas, kept in sync mechanically instead of by hand:

- `prisma/schema.prisma` + `prisma/migrations/` — **SQLite**, used for local dev and the test suite. Edit this one.
- `prisma/postgres/schema.prisma` + `prisma/postgres/migrations/` — **PostgreSQL**, used only for the Vercel/production build. This file is generated — never hand-edit it.

Why two files instead of one "flip a line" schema: Prisma's `datasource.provider` is a static string, and migration `.sql` files are provider-specific (SQLite and Postgres SQL aren't interchangeable), so there's no way to share one migration history across both. Splitting them keeps local dev exactly on SQLite (no Docker/Postgres required to hack on this repo) while production runs real Postgres.

After changing models in `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name <change>              # as usual, against SQLite
npm run db:sync-postgres-schema                      # regenerates prisma/postgres/schema.prisma
DATABASE_URL="<postgres-url>" npx prisma migrate dev --schema prisma/postgres/schema.prisma --name <change>
```

That last command needs a real reachable Postgres URL (a Neon branch, local Postgres, whatever you use for this) since `migrate dev` computes and applies the diff interactively. In this project that's a Neon Postgres database, provisioned via the Vercel marketplace integration (`vercel integration add neon`) — it creates separate branches per Vercel environment (production/preview/development) automatically.

Production migrations run automatically as part of the Vercel build (see `vercel.json`'s `buildCommand`): `prisma generate` and `prisma migrate deploy` (not `migrate dev` — that's interactive/dev-only) both target `prisma/postgres/schema.prisma`, then `next build` runs.

Seeding: `npm run db:seed` works against whichever schema's client was last generated — run it locally against SQLite as usual; for production, more realistically create your real admin user directly (see [Admin usage](#admin-usage)) rather than seeding the sample dev data.

Backups: this app doesn't implement its own backup mechanism — use your Postgres host's automated backups/point-in-time recovery (Neon, and most others, offer this).

## Authentication

Username/email + password, bcrypt-hashed (cost 12), session cookie (httpOnly, `SameSite=Lax`, 30-day expiry) backed by a `Session` DB row so sessions can be revoked (password reset deletes all of a user's sessions). Two roles: `ADMIN` and `DATA_PROCESSOR`. Login is rate-limited in-memory (20/15min per IP, 8/15min per identifier) — see the note in `src/lib/rateLimit.ts` about swapping to a shared store (e.g. Upstash Redis) before running multiple serverless instances, since in-memory counts don't share across processes.

## Google Drive setup

Optional — the Admin → Google Drive page just shows "not configured" until you set it up. Steps are documented inline in `.env.example`; briefly: create a Google Cloud project, enable the Drive API, configure the OAuth consent screen with the `drive.readonly` scope, create a Web application OAuth client, register `<your app URL>/api/admin/drive/callback` as the redirect URI, then set the three `GOOGLE_*` env vars and `ENCRYPTION_KEY`.

The **source folder is fixed via `GOOGLE_DRIVE_FOLDER_ID`**, not admin-editable in the UI — set it once in the environment (bare folder ID or a full Drive URL both work) and every deploy scans that folder plus all of its subfolders. Connecting an account auto-verifies and records the folder immediately; there's no separate "set folder" step. To point at a different folder, change the env var and redeploy/restart — that's a deliberate choice, not a missing feature.

## CSV format

Expected columns (flexible naming — see `src/lib/csv.ts` for the full alias list): `name`, `phone`, `rating`, `maps_url`, `website_url`. Column detection is case/spacing/underscore-insensitive (`"Business Name"`, `business_name`, `businessname` all match).

Cleaning rules: rows missing **Name or Phone are removed** from the dataset (both are required columns *and* required per-row values). Missing Rating, Maps URL, or Website are kept and reported as data-quality stats — they don't cause removal.

## Queue behavior

One record at a time, locked to whoever claims it:
- **Claim**: visiting `/dashboard` atomically claims the next available (`pending` or previously-`skipped`, unclaimed) record, ordered by source file then row — fresh `pending` records are preferred over `skipped` ones so a user skipping through the queue makes forward progress instead of cycling back to what they just skipped.
- **Done**: permanently locks the record (`status=done`, `doneBy`, `doneAt`) — it can never be claimed again.
- **Skip**: releases the claim and marks the record `skipped`; it re-enters the shared pool for anyone (including the same user later) to pick up.
- **Next Name**: releases the claim without changing status.
- **Stale claims**: a record claimed and not resolved within the configured timeout (Admin → Settings, default 30 minutes) is automatically released back to the pool on the next claim attempt anywhere in the app.

Not implemented: a "Previous" button — both source specs hedge this ("where appropriate," "do not bypass ownership rules") without resolving what it should do once locking is in play, so it's left as an open question rather than guessed at.

## Testing

```bash
npm test        # vitest run — 37 tests as of Phase 4
npx tsc --noEmit
npm run lint
npm run build
```

Tests run against an isolated SQLite file (`prisma/test.db`, migrated fresh by `vitest.setup.ts`), never the dev database. Coverage: CSV column detection/cleaning rules, queue claim/skip/done/ownership/stale-release/concurrency (two users claiming simultaneously never get the same record), Google Drive New/Updated/Unchanged classification and folder-ID parsing, and the token encryption round-trip.

## Deployment (Vercel)

This repo is already set up for it — `vercel.json`'s `buildCommand` runs `prisma generate` + `prisma migrate deploy` against `prisma/postgres/schema.prisma` before `next build`, so a normal Vercel deploy (git push, or `vercel --prod`) handles migrations automatically. To set this up from scratch elsewhere:

1. Push to a Git repo, import it into Vercel (`vercel link` locally, or via the dashboard).
2. Provision Postgres and connect it to the project — `vercel integration add neon --plan free_v3` (or Supabase, or point `DATABASE_URL` at any existing Postgres instance) sets `DATABASE_URL` for you across environments; Neon specifically gives each Vercel environment (production/preview/development) its own branch.
3. Generate the initial Postgres migration once against a real reachable Postgres URL — see [Database](#database) — and commit `prisma/postgres/migrations/`.
4. Set any remaining env vars from the table above (`ENCRYPTION_KEY`, `GOOGLE_*`) in the Vercel project settings if you're using Google Drive.
5. Deploy. `vercel.json` handles running migrations as part of the build from here on — no separate migration step needed for future schema changes, as long as you commit the new `prisma/postgres/migrations/` entry (step 3's pattern) alongside the SQLite one.

If using Google Drive: update `GOOGLE_REDIRECT_URI` to the production URL and add the same redirect URI in Google Cloud Console.

## Monitoring

`GET /api/health` checks the database is reachable and returns `{status: "ok"}` (200) or `{status: "error"}` (503) — point an uptime monitor (Vercel's own, UptimeRobot, etc.) at it. No application-level metrics/APM are wired up; add one (Sentry, Vercel Analytics, etc.) if you need it.

## Admin usage

Admin nav: **Dashboard** (same locked-queue screen as everyone), **Statistics** (org-wide, filterable by date range/user/source file), **Users** (create/edit/disable/enable/role/reset password), **Google Drive** (connect, scan, process), **Processing Queue** (live counts, source files, currently-claimed and recently-completed tables, CSV export of processed records), **Template Dictionaries** (manage the outreach message templates the Dashboard composer pulls from — exactly one dictionary is "active" at a time), **Audit Log** (every login/claim/done/skip/user/template/settings/Drive action, searchable and filterable), **Settings** (claim-lock timeout, timezone).

To create your first real admin (rather than using the seeded dev one), have an existing admin create the user from Admin → Users with role `ADMIN`, or insert one directly via `npm run db:seed` logic as a reference for the fields required.
