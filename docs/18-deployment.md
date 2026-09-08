# 18 — Deployment Documentation

## 1. Environments

| Environment | Database | How it's run |
|---|---|---|
| Local development | SQLite (`prisma/dev.db`) | `npm run dev` (Next.js dev server, Turbopack) |
| Test | SQLite (`prisma/test.db`, ephemeral) | `npm test` (created/migrated fresh every run, see [17-testing.md](17-testing.md)) |
| Production | PostgreSQL (Neon, serverless) | Vercel — `crm-fx2` project, deployed from the `master` branch of `github.com/ARULKINT/rowdesk` |

There is no separate staging environment in this deployment — Vercel does implicitly create **preview** deployments for non-production branches/PRs (each with its own Neon branch, per the marketplace integration's behavior), but none is actively used as a persistent staging environment today.

## 2. Why Two Prisma Schemas

Prisma's `datasource.provider` is a static string, and migration `.sql` files are provider-specific — SQLite and PostgreSQL SQL are not interchangeable. Rather than forcing local development onto Postgres (requiring Docker or a hosted dev database just to run the app), the project maintains **two mechanically-synced schema files**:

- `prisma/schema.prisma` — **source of truth**, SQLite, edited directly. Backs local dev and the test suite.
- `prisma/postgres/schema.prisma` — **generated**, PostgreSQL, produced by `scripts/sync-postgres-schema.mjs` (a regex swap of only the `datasource { }` block; every model definition is copied verbatim). Backs production only. Never hand-edited.

Each has its own independent migration history (`prisma/migrations/` vs `prisma/postgres/migrations/`).

### Adding a schema change (developer workflow)

```bash
# 1. Edit prisma/schema.prisma, then:
npx prisma migrate dev --name <change>              # SQLite — as usual

# 2. Regenerate the Postgres mirror:
npm run db:sync-postgres-schema

# 3. Generate the matching Postgres migration against a real reachable
#    Postgres URL (a Neon branch, local Postgres, whatever's available):
DATABASE_URL="<postgres-url>" npx prisma migrate dev \
  --schema prisma/postgres/schema.prisma --name <change>
```

Step 3 needs a real, reachable Postgres connection because `migrate dev` computes and applies the diff interactively — there is no purely offline way to generate a Postgres migration file.

## 3. Build & Deploy Pipeline

`vercel.json`:
```json
{
  "buildCommand": "prisma generate --schema prisma/postgres/schema.prisma && prisma migrate deploy --schema prisma/postgres/schema.prisma && next build"
}
```

Every Vercel build therefore, in order: (1) generates a fresh Postgres-flavored Prisma Client, (2) runs `migrate deploy` (non-interactive, applies any pending migrations — **not** `migrate dev`) against the production database, (3) builds the Next.js app. This means **schema migrations run automatically as part of every deploy** — there is no separate manual migration step for ordinary changes, as long as the matching `prisma/postgres/migrations/` entry was committed per the workflow above.

```mermaid
flowchart LR
    A[git push / vercel --prod] --> B[Vercel build starts]
    B --> C[prisma generate<br/>--schema postgres/schema.prisma]
    C --> D[prisma migrate deploy<br/>--schema postgres/schema.prisma]
    D --> E[next build]
    E --> F[Deploy to Vercel Functions]
    F --> G[Alias to crm-fx2.vercel.app]
```

## 4. Database Provisioning

Production Postgres is **Neon**, provisioned through the Vercel Marketplace integration (`vercel integration add neon`). This automatically:
- Creates a Neon project.
- Creates a separate database **branch per Vercel environment** (production, preview, development).
- Injects `DATABASE_URL` (and related `POSTGRES_*`/`PG*`/`NEON_*` variables) into the Vercel project's environment variables for each environment.

## 5. Environment Variables

| Variable | Required | Set where | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Always | Local `.env` (SQLite path) / Vercel project settings (Neon Postgres URL, injected by the integration) | Prisma datasource connection string |
| `ENCRYPTION_KEY` | Only if using Google Drive | `.env` / Vercel | Encrypts stored Drive OAuth tokens (any long random string, e.g. `openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | Only if using Google Drive | `.env` / Vercel | OAuth client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Only if using Google Drive | `.env` / Vercel | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Only if using Google Drive | `.env` (localhost) / Vercel (production URL) | Must exactly match a redirect URI registered on the OAuth client |
| `GOOGLE_DRIVE_FOLDER_ID` | Only if using Google Drive | `.env` / Vercel | Fixed source folder (bare ID or full Drive URL) — intentionally not admin-editable in the UI |

Never commit `.env`; `.env.example` documents the shape without secrets.

## 6. Deployment Commands Used in Practice

```bash
vercel link                 # one-time: associate the local repo with the Vercel project
vercel integration add neon --plan free_v3   # one-time: provision Postgres
vercel env pull .env.production.local --environment=production   # inspect prod env vars locally when needed
vercel --prod --yes         # deploy the current working tree to production
```

`vercel --prod --yes` was the command used throughout this project's development to ship each change to `https://crm-fx2.vercel.app` — it builds and promotes to production in one step (equivalent to a Git-push-triggered deploy, but invoked directly from the CLI).

## 7. Production Admin Bootstrapping

The first production admin account cannot be created through the UI (there is no self-registration). It was created once via a temporary, non-committed script run directly against the production database using the generated Postgres Prisma Client, with a randomly generated password shared once and never written to the repository. For any future re-bootstrap, the same approach (a throwaway script, or direct SQL via the Neon console) is the only option — see [19-developer-setup.md](19-developer-setup.md) for the equivalent *local* dev-seeding path, which is UI-free but scripted and safe to re-run (`npm run db:seed`).

## 8. Rollback

Vercel retains every previous deployment; rolling back is "promote an earlier deployment to production" via the Vercel dashboard or `vercel rollback`. **Database migrations are not automatically rolled back** — if a deploy included a destructive schema change, rolling back the *code* does not undo the *migration*; this must be handled manually (Prisma does not generate down-migrations by default).

## 9. SSL/TLS, CDN, Domains

Handled entirely by Vercel's platform (automatic TLS certificates, edge caching for static assets, the `*.vercel.app` domain). No custom domain, CDN configuration, or containerization is present in this codebase.

## 10. CI/CD

There is no separate CI pipeline configuration file (no GitHub Actions workflow) in this repository — Vercel's own Git integration (when connected) or direct CLI invocation (`vercel --prod`) is the entire deploy mechanism. Test/lint/typecheck are run manually/locally rather than gating deploys automatically.
