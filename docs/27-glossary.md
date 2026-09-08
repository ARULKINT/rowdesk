# 27 — Glossary

## Domain Terms

| Term | Definition |
|---|---|
| **Lead** / **Record** | One business listing (name, phone, rating, Maps URL, website) to be processed and contacted. Stored as a `Record` row. |
| **Claim** | The act of a user being assigned exclusive ownership of a record (`claimedById`/`claimedAt`), preventing anyone else from working it until it's resolved or the claim times out. |
| **Queue** | The shared pool of `pending`/`skipped`, unclaimed records that `claimNextRecordForUser()` draws from. |
| **Source File** | One imported CSV, represented by a `SourceFile` row. Each processed Drive-file version creates a new Source File, never overwriting the previous one. |
| **Done** | The permanent, terminal status of a record once a user completes it — it can never be claimed or modified again. |
| **Skipped** | A status meaning a record was set aside and returned to the shared pool for later (by anyone). Not terminal. |
| **Pending** | A record's initial status — never yet claimed and resolved. |
| **Previous** | The queue action that steps back to the row immediately before the current one, within the same source file, overriding normal claim exclusivity if necessary. |
| **Outreach Message** | The composed, ready-to-copy text sent to a lead, built from a Template with `{name}`/`{domain}` substituted. |
| **Template** | One outreach message body belonging to a Template Dictionary, containing optional `{name}`/`{domain}` placeholder tokens. |
| **Template Dictionary** | A named, ordered set of Templates. Exactly one is "active" at a time; the active dictionary's active templates populate every user's composer. |
| **Cleaning** | The per-row validation/normalization that happens at import time: rejecting rows missing Name or Phone, normalizing phone numbers, and tracking missing optional fields. |
| **Verified** | A user-set flag on a record confirming they've visually checked the listing against Google Maps. |
| **Called** | A legacy boolean field on `Record`, no longer exposed in the UI (superseded by the phone Copy button) but still present in the schema/API. |
| **Stale Claim** | A claim whose `claimedAt` has exceeded the configured claim-timeout, automatically released back to the pool on the next claim attempt anywhere in the app. |
| **Audit Log** | The permanent, append-only record of every consequential action taken in the system. |
| **Drive File** | One CSV file tracked in the configured Google Drive folder tree, independent of how many times it's been processed into Source Files. |
| **Cleaning Summary** | The UI block showing original/removed/final row counts and missing-field counts for an import. |

## Technical / Abbreviation Glossary

| Term | Meaning |
|---|---|
| **ORM** | Object-Relational Mapper — Prisma, in this project |
| **CAS** | Compare-And-Swap — the concurrency-safe conditional-update pattern used by the claim logic |
| **CSRF** | Cross-Site Request Forgery — mitigated here via `SameSite=Lax` cookies plus an explicit Origin check |
| **XSS** | Cross-Site Scripting — mitigated via HTML-escaping in `composeMessageHtml()` |
| **AES-256-GCM** | Advanced Encryption Standard, 256-bit key, Galois/Counter Mode — the authenticated-encryption algorithm used to encrypt Google OAuth tokens at rest |
| **bcrypt** | The password-hashing algorithm used for `User.passwordHash` |
| **OAuth2** | The authorization protocol used for the Google Drive connection (not used for end-user login) |
| **Route Handler** | Next.js App Router's term for an API endpoint file (`route.ts`) |
| **Server Component** | A React component that renders on the server and can query the database directly, with no client-side JavaScript required for its own rendering |
| **SSR** | Server-Side Rendering |
| **Prisma Client** | The generated, type-safe database query API produced from `schema.prisma` |
| **Migration** | A versioned, applied SQL change to the database schema, tracked by Prisma in `prisma/migrations/` (SQLite) and `prisma/postgres/migrations/` (PostgreSQL) |
| **cuid** | Collision-resistant unique identifier — the ID format used for every primary key in this schema (Prisma's `@default(cuid())`) |
| **Zod** | The TypeScript-first schema validation library used for every API request body |
| **CI/CD** | Continuous Integration / Continuous Deployment — not currently automated in this project (see [18-deployment.md](18-deployment.md)) |
| **PITR** | Point-In-Time Recovery — a database backup capability relied upon (via Neon) but not implemented by the application itself |

## Business / Organizational Terms

| Term | Meaning |
|---|---|
| **Forge & Flint** | The business name used in this deployment's default outreach templates — the operation running Rowdesk to contact scraped leads |
| **Admin** | The role responsible for configuration, ingestion, and team oversight |
| **Data Processor** | The role responsible for working the lead queue |
