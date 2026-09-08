# 02 — Requirements

## 1. Functional Requirements

| ID | Requirement | Description | Priority | Status | Related Feature |
|---|---|---|---|---|---|
| FR-01 | Username/password login | User authenticates with username-or-email + password | Critical | Implemented | [14-authentication-security.md](14-authentication-security.md) |
| FR-02 | Role-based access | Two roles (`ADMIN`, `DATA_PROCESSOR`) gate navigation and API access | Critical | Implemented | [06-user-roles-permissions.md](06-user-roles-permissions.md) |
| FR-03 | Manual CSV import | Admin uploads a `.csv`; app maps columns, cleans rows, creates records | Critical | Implemented | [12-data-processing.md](12-data-processing.md) |
| FR-04 | Google Drive CSV import | Admin connects a Google account via OAuth2; app scans a fixed folder (and subfolders) for CSVs and imports new/changed ones | High | Implemented | [16-integrations.md](16-integrations.md) |
| FR-05 | Locked single-record queue | Visiting the dashboard atomically claims exactly one unclaimed record for the caller | Critical | Implemented | [11-business-logic.md](11-business-logic.md) |
| FR-06 | Mark record Done | Permanently locks a record as completed, timestamped and attributed | Critical | Implemented | [11-business-logic.md](11-business-logic.md) |
| FR-07 | Skip a record | Returns the record to the shared pool, marked `skipped`, for anyone to pick up | Critical | Implemented | [11-business-logic.md](11-business-logic.md) |
| FR-08 | Next / Previous navigation | Next releases the claim and claims the next available record; Previous steps back one row within the same source file, overriding locks if necessary | High | Implemented | [11-business-logic.md](11-business-logic.md) |
| FR-09 | Outreach message composer | Cycles through admin-defined templates, substituting `{name}`/`{domain}`, with one-click clipboard copy | High | Implemented | [12-data-processing.md](12-data-processing.md) |
| FR-10 | Phone copy-to-clipboard | One-click copy of the record's phone number | Medium | Implemented | [08-ui-ux.md](08-ui-ux.md) |
| FR-11 | Verified toggle + open Maps | Marks a record verified and opens its Google Maps URL in a new tab | Medium | Implemented | [08-ui-ux.md](08-ui-ux.md) |
| FR-12 | Admin user management | Create, edit, disable/enable, change role, reset password for any user | Critical | Implemented | [21-admin-manual.md](21-admin-manual.md) |
| FR-13 | Template dictionary management | Create dictionaries of outreach templates, activate exactly one at a time, add/edit/retire/reorder templates within it | High | Implemented | [21-admin-manual.md](21-admin-manual.md) |
| FR-14 | Statistics dashboards | Org-wide (admin) and personal (all users) completion metrics, filterable by date range / user / source file | Medium | Implemented | [08-ui-ux.md](08-ui-ux.md) |
| FR-15 | Processing Queue overview | Live counts, per-file breakdown, currently-claimed table, recently-completed table, CSV export | Medium | Implemented | [08-ui-ux.md](08-ui-ux.md) |
| FR-16 | Audit log | Every consequential action is recorded and searchable/filterable | High | Implemented | [21-admin-manual.md](21-admin-manual.md) |
| FR-17 | Configurable claim timeout | Admin sets how long a claim can sit idle before it's automatically released | Medium | Implemented | [21-admin-manual.md](21-admin-manual.md) |
| FR-18 | CSV export of processed leads | Download all `done` records (optionally filtered) as CSV | Medium | Implemented | [21-admin-manual.md](21-admin-manual.md) |
| FR-19 | Self-service password change | Any signed-in user can change their own password from Profile | Low | Implemented | [20-user-manual.md](20-user-manual.md) |
| FR-20 | Phone number normalization | Scraped numbers with a leading trunk `0`/`91` and formatting punctuation are normalized to a clean 10-digit value on import | Medium | Implemented | [12-data-processing.md](12-data-processing.md) |

## 2. Non-Functional Requirements

| Category | Requirement | Status | Notes |
|---|---|---|---|
| **Performance** | Dashboard claim/action round-trip should feel instant for a small team | Implemented (adequate for current scale) | No caching layer; every page is `dynamic = "force-dynamic"` — see [22-performance-scalability.md](22-performance-scalability.md) |
| **Scalability** | Support a handful of concurrent users reliably | Implemented | Not designed/tested for high concurrency; see [22-performance-scalability.md](22-performance-scalability.md) |
| **Availability** | Reachable during business hours | Implemented via Vercel's managed hosting | No formal SLA or redundancy beyond Vercel's own platform guarantees |
| **Reliability** | No two users ever claim the same record | Implemented, covered by an automated concurrency test | Compare-and-swap `updateMany`, portable across SQLite/Postgres |
| **Security** | Passwords hashed, sessions server-validated, CSRF-defended mutations | Implemented | See [14-authentication-security.md](14-authentication-security.md) |
| **Maintainability** | Single shared cleaning/import pipeline for both CSV sources | Implemented | `src/lib/csvImport.ts` used by both `/api/import` and the Drive processor |
| **Usability** | Minimal-click workflow for a non-technical data-entry user | Implemented | Large single-record card, one-key actions |
| **Accessibility** | Keyboard/focus-visible support, semantic form labeling | Partially implemented | No formal WCAG audit performed — see [24-known-issues.md](24-known-issues.md) |
| **Compatibility** | Modern evergreen browsers | Implemented (implicit via Next.js/React 19 baseline) | No legacy-browser targeting |
| **Portability** | Deployable to any Postgres-backed host, dev runs on SQLite | Implemented | Dual-schema Prisma setup — see [18-deployment.md](18-deployment.md) |
| **Observability** | Structured logs, metrics, alerting | Not implemented | Only `GET /api/health` exists; no APM/metrics — see [15-error-handling.md](15-error-handling.md) |
| **Data integrity** | Records immutable once `done`; every mutation audited | Implemented | Enforced in `src/lib/queue.ts` |
| **Privacy** | Google OAuth tokens encrypted at rest | Implemented | AES-256-GCM via `ENCRYPTION_KEY` |
| **Recoverability** | Database backups | Not implemented by the app itself | Relies entirely on the Postgres host's (Neon) backup features — see [23-maintenance.md](23-maintenance.md) |

Recommended (not yet implemented) non-functional improvements are listed in [25-roadmap.md](25-roadmap.md).
