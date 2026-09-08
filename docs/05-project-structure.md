# 05 — Project Structure

## 1. Top-Level Layout

```
crm-fx2/
├── docs/                        # This documentation package
├── prisma/
│   ├── schema.prisma            # Source of truth — SQLite (local dev/test)
│   ├── postgres/
│   │   ├── schema.prisma        # Generated mirror — PostgreSQL (production)
│   │   └── migrations/          # Postgres-specific migration history
│   ├── migrations/              # SQLite migration history
│   └── seed.ts                  # Dev-only seed script
├── scripts/
│   └── sync-postgres-schema.mjs # Regenerates prisma/postgres/schema.prisma
├── src/
│   ├── app/                     # Next.js App Router — pages + API routes
│   ├── components/              # Shared React components
│   └── lib/                     # Server-only business logic, one module per concern
├── public/                      # Static assets (unused SVG placeholders from create-next-app)
├── vercel.json                  # Custom production build command
├── prisma.config.ts             # Prisma CLI configuration (replaces package.json#prisma)
├── vitest.config.ts / vitest.setup.ts   # Test runner config + isolated test DB bootstrap
├── .env.example                 # Documented environment variable shape
└── README.md                    # Developer-facing quick reference
```

## 2. `src/app` — Routes

| Path | Type | Purpose |
|---|---|---|
| `page.tsx` | Server Component | Root `/` — redirects to `/dashboard` or `/login` based on session |
| `login/page.tsx` | Client Component | Login form |
| `dashboard/page.tsx` | Server Component | Claims a record, loads active templates, renders `RowdeskScreen` |
| `dashboard/error.tsx` | Error boundary | Dashboard-scoped error UI |
| `statistics/page.tsx` | Server Component | Personal statistics (any signed-in user) |
| `profile/page.tsx`, `profile/ChangePasswordForm.tsx` | Server + Client | Self-service profile / password change |
| `admin/layout.tsx` | Server Component | Wraps all `/admin/*` pages; enforces `requireAdmin()` |
| `admin/statistics/page.tsx` | Server Component | Org-wide statistics with filters |
| `admin/users/page.tsx`, `UsersTable.tsx` | Server + Client | User management |
| `admin/drive/page.tsx`, `DrivePanel.tsx` | Server + Client | Google Drive connection, scan, process |
| `admin/queue/page.tsx` | Server Component | Processing Queue overview + export |
| `admin/templates/page.tsx`, `DictionariesPanel.tsx` | Server + Client | Template dictionary management |
| `admin/audit/page.tsx` | Server Component | Audit log, filterable, paginated |
| `admin/settings/page.tsx`, `SettingsForm.tsx` | Server + Client | Claim timeout / timezone settings |
| `admin/import/page.tsx` | Client Component | Manual CSV upload form |
| `admin/error.tsx`, `admin/loading.tsx` | Boundaries | Admin-scoped error/loading UI |
| `error.tsx` (root) | Error boundary | App-wide fallback error UI |

### API Route Handlers (`src/app/api/**/route.ts`)

See [09-api-documentation.md](09-api-documentation.md) for full per-endpoint documentation. Directory shape:

```
api/
├── auth/{login,logout}/route.ts
├── health/route.ts
├── import/route.ts
├── profile/password/route.ts
├── queue/{action,claim}/route.ts
├── records/[id]/route.ts
└── admin/
    ├── dictionaries/route.ts
    ├── dictionaries/[id]/activate/route.ts
    ├── drive/{connect,callback,disconnect,scan,process}/route.ts
    ├── export/route.ts
    ├── settings/route.ts
    ├── templates/route.ts
    ├── templates/[id]/route.ts
    ├── users/route.ts
    └── users/[id]/route.ts
```

## 3. `src/components`

| File | Responsibility |
|---|---|
| `RowdeskScreen.tsx` + `.module.css` | The entire Dashboard/queue UI — record card, composer, action bar |
| `AppHeader.tsx` | Top navigation bar, role-aware menu |
| `LogoutButton.tsx` | Logout action |
| `StatCard.tsx` | Reusable labeled-number stat tile |
| `SimpleBarChart.tsx` | Hand-built bar chart (no charting library) for daily completion counts |
| `CleaningSummary.tsx` | Import cleaning-result stat block (shared by manual import and Drive import UI) |
| `LoadingState.tsx`, `ErrorState.tsx` | Reusable loading/error placeholders |

## 4. `src/lib` — Server-Only Business Logic

Every file here (except `schemas.ts`, `validate.ts`, `csv.ts`, `templates.ts`, `time.ts` which are safely isomorphic or explicitly pure) is marked `import "server-only"` so it can never be accidentally bundled into client JavaScript.

| File | Responsibility |
|---|---|
| `prisma.ts` | Singleton Prisma Client instance (prevents connection-pool exhaustion from hot-reload in dev) |
| `auth.ts` | Password hashing, session create/destroy/resolve, `requireUser`/`requireAdmin`/`getApiUser` guards |
| `queue.ts` | The locking/claim state machine — claim, skip, done, release, previous |
| `csv.ts` | Column-mapping, per-row cleaning rules, phone normalization, domain extraction (pure functions, unit-tested directly) |
| `csvImport.ts` | Orchestrates `csv.ts` against a full CSV file, persists `SourceFile` + `Record` rows |
| `googleDrive.ts` | OAuth2 client, folder verification, recursive CSV listing, file download, Drive-file classification |
| `templates.ts` | `{domain}`/`{name}` token substitution for outreach messages |
| `templateDictionary.ts` | Reads the currently-active template dictionary |
| `encryption.ts` | AES-256-GCM encrypt/decrypt for Drive OAuth tokens at rest |
| `audit.ts` | `logAudit()` — the single write path into `AuditLog` |
| `rateLimit.ts` | In-memory fixed-window rate limiter (login endpoint) |
| `settings.ts` | Reads/writes `SystemSetting` key-value rows (claim timeout, timezone) |
| `stats.ts` | Daily-count bucketing helper for the bar charts |
| `time.ts` | Thin wrapper around `Date.now()` (testability seam) |
| `schemas.ts` | Every Zod validation schema used by mutating routes |
| `validate.ts` | `parseJsonBody()` — shared request-body parsing + 400 response helper |
| `csrf.ts` | `isSameOrigin()` — Origin/Referer check for mutating routes |
| `testing/server-only-stub.ts` | Test-only replacement for the `server-only` package (aliased in `vitest.config.ts`) |

## 5. `prisma/`

| Path | Purpose |
|---|---|
| `schema.prisma` | Canonical model definitions, SQLite datasource — **edit this one** |
| `migrations/` | SQLite migration history (applied locally and in tests) |
| `postgres/schema.prisma` | Mechanically generated from `schema.prisma` with only the `datasource` block swapped to PostgreSQL — **never hand-edit** |
| `postgres/migrations/` | PostgreSQL migration history (applied in the Vercel build) |
| `seed.ts` | Creates a dev admin (`admin` / `ChangeMe123!`), a dev processor, a default template dictionary, and sample records — **local dev only** |

## 6. Files Deliberately Not Documented Further

`public/*.svg`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `.vercel/*` — generated/boilerplate artifacts from `create-next-app` and the Vercel CLI, carrying no project-specific logic.
