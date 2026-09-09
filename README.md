# Rowdesk

An internal tool for cleaning and enriching scraped business-listing data (Google Maps exports) and sending domain-protection outreach. Multiple team members pull records from a shared, locked queue one at a time; an admin manages users, source files, templates, and Google Drive ingestion, and can see stats and a full audit trail.

## Architecture

- **Next.js 16 (App Router) + TypeScript**, Route Handlers for the API, Server Components for data-loading pages.
- **Prisma ORM over PostgreSQL** — there is no local database. Local dev, tests, and production all point at Postgres (see [Database](#database)); local dev normally points at the same production database via `.env.local`.
- **Session auth**: bcrypt-hashed passwords, an httpOnly session cookie backed by a `Session` table (no third-party auth provider). Every route is authorized server-side — `requireUser()` / `requireAdmin()` in Server Components, a `getApiUser()` check at the top of every mutating Route Handler.
- **Locked shared queue**: visiting `/dashboard` atomically claims the next available record via a compare-and-swap `updateMany` with a retry loop (`src/lib/queue.ts`) — portable to Postgres without raw `SELECT FOR UPDATE`. Stale claims self-heal on the next claim attempt (configurable timeout in Admin → Settings).
- **Google Drive ingestion**: OAuth2 (read-only `drive.readonly` scope) via `googleapis`, tokens encrypted at rest (AES-256-GCM). Scanning a configured folder classifies each CSV as New/Updated/Unchanged by comparing Drive's `modifiedTime` to the last version we successfully processed; each processed file becomes a **new** `SourceFile` version rather than overwriting the old one, so already-claimed/completed records are never touched.
- **Design tokens**: the color system is CSS custom properties (`src/app/globals.css`), not Tailwind's palette — Tailwind is used for layout/spacing utilities only. Typography: Libre Franklin (display), IBM Plex Sans (UI), IBM Plex Mono (data/counters).

## Local development

```bash
npm install
vercel env pull .env.local   # pulls the real DATABASE_URL (and other secrets) from Vercel
cp .env.example .env          # fill in ENCRYPTION_KEY / GOOGLE_* if you need Google Drive locally
npx prisma generate
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`. There is no separate seed/setup step for the database itself — you're pointed at the real (production) database, so log in with a real account.

**Note on schema changes**: if you edit `prisma/schema.prisma` while `npm run dev` is already running, restart it after `prisma migrate dev`/`migrate deploy`. Node doesn't hot-reload native `node_modules` packages like the generated Prisma Client, so a long-running dev server keeps the old client in memory even after `prisma generate` writes a new one to disk — you'll see `Cannot read properties of undefined` errors on any new model until you restart.

## Environment variables

See `.env.example` for the full annotated list. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. Written into `.env.local` by `vercel env pull`; takes precedence over `.env` |
| `ENCRYPTION_KEY` | Only if connecting Google Drive | Encrypts stored OAuth tokens at rest (any long random string, e.g. `openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Only if connecting Google Drive | OAuth client from Google Cloud Console — see `.env.example` for setup steps |

Never commit `.env`. `.env.example` documents the shape without secrets.

## Database

One schema, one migration history, one database — `prisma/schema.prisma` + `prisma/migrations/`, PostgreSQL, used for local dev, and production alike. There is no local/SQLite database and no separate "dev" copy of the schema to keep in sync — `DATABASE_URL` (from `.env.local`, pulled via `vercel env pull`) points local dev at the same Neon Postgres database production uses.

After changing models in `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name <change>
```

This computes and applies the migration against whatever `DATABASE_URL` currently resolves to — normally the real database, since there's nothing else to point it at. Review the generated `.sql` before running this against data you care about; for anything destructive, prefer writing the migration by hand or testing the diff first with `prisma migrate diff`.

Production migrations also run automatically as part of the Vercel build (see `vercel.json`'s `buildCommand`): `prisma generate` and `prisma migrate deploy` (not `migrate dev` — that's interactive/dev-only) both run against `prisma/schema.prisma`, then `next build` runs. So a migration created and committed locally gets applied again (as a no-op, since it's already applied) on the next deploy — that's expected, not a bug.

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
- **Next**: releases the claim without changing status, then claims the next available record as usual.
- **Previous**: steps back to the previous row (by row position) *in the same source file* and claims it, releasing the current claim without changing its status. This is a deliberate exception to the normal "only claim what's available" rule — it steals the claim from whoever currently holds that row, if anyone, so you can quickly correct the last record or two. The one thing it won't do is step back into a `done` row, since done stays permanently locked; disabled entirely on row 1 of a file.
- **Stale claims**: a record claimed and not resolved within the configured timeout (Admin → Settings, default 30 minutes) is automatically released back to the pool on the next claim attempt anywhere in the app.

## Testing

```bash
npm test        # vitest run — 37 tests as of Phase 4
npx tsc --noEmit
npm run lint
npm run build
```

There is no local/disposable database, so the database-backed tests (`auth.test.ts`, `queue.test.ts` — password hashing, session resolution, queue claim/skip/done/ownership/stale-release/concurrency) only run when `TEST_DATABASE_URL` is set, pointing at a disposable Postgres database (e.g. a separate Neon branch — never production, since these tests freely delete rows):

```bash
TEST_DATABASE_URL="<postgres-url>" npm test
```

Without it, those two files skip themselves (`vitest.setup.ts` prints a warning) and the rest of the suite still runs — CSV column detection/cleaning rules, Google Drive New/Updated/Unchanged classification and folder-ID parsing, and the token encryption round-trip.

## Deployment (Vercel)

This repo is already set up for it — `vercel.json`'s `buildCommand` runs `prisma generate` + `prisma migrate deploy` against `prisma/schema.prisma` before `next build`, so a normal Vercel deploy (git push, or `vercel --prod`) handles migrations automatically. To set this up from scratch elsewhere:

1. Push to a Git repo, import it into Vercel (`vercel link` locally, or via the dashboard).
2. Provision Postgres and connect it to the project — `vercel integration add neon --plan free_v3` (or Supabase, or point `DATABASE_URL` at any existing Postgres instance) sets `DATABASE_URL` for you across environments; Neon specifically gives each Vercel environment (production/preview/development) its own branch.
3. Generate the initial migration once against a real reachable Postgres URL — see [Database](#database) — and commit `prisma/migrations/`.
4. Set any remaining env vars from the table above (`ENCRYPTION_KEY`, `GOOGLE_*`) in the Vercel project settings if you're using Google Drive.
5. Deploy. `vercel.json` handles running migrations as part of the build from here on — no separate migration step needed for future schema changes, as long as you commit the new `prisma/migrations/` entry (step 3's pattern).

If using Google Drive: update `GOOGLE_REDIRECT_URI` to the production URL and add the same redirect URI in Google Cloud Console.

## Monitoring

`GET /api/health` checks the database is reachable and returns `{status: "ok"}` (200) or `{status: "error"}` (503) — point an uptime monitor (Vercel's own, UptimeRobot, etc.) at it. No application-level metrics/APM are wired up; add one (Sentry, Vercel Analytics, etc.) if you need it.

## Admin usage

Admin nav: **Dashboard** (same locked-queue screen as everyone), **Statistics** (org-wide, filterable by date range/user/source file), **Users** (create/edit/disable/enable/role/reset password), **Google Drive** (connect, scan, process), **Processing Queue** (live counts, source files, currently-claimed and recently-completed tables, CSV export of processed records), **Template Dictionaries** (manage the outreach message templates the Dashboard composer pulls from — exactly one dictionary is "active" at a time), **Audit Log** (every login/claim/done/skip/user/template/settings/Drive action, searchable and filterable), **Settings** (claim-lock timeout, timezone).

To create your first real admin (rather than using the seeded dev one), have an existing admin create the user from Admin → Users with role `ADMIN`, or insert one directly via `npm run db:seed` logic as a reference for the fields required.
