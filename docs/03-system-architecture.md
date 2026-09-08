# 03 — System Architecture

## 1. Architecture Style

Rowdesk is a **monolithic full-stack Next.js application** (App Router). There is no separate backend service — Server Components, Route Handlers (the API), and the database client all run inside the same Next.js build and deploy as one Vercel project. There are no queues, caches, workers, or microservices.

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph Client["Browser"]
        UI[React UI<br/>Server + Client Components]
    end

    subgraph Vercel["Vercel — Next.js 16 App Router"]
        RSC[Server Components<br/>page.tsx data loading]
        API[Route Handlers<br/>/api/*]
        Lib[Shared lib layer<br/>auth · queue · csv · templates · googleDrive]
    end

    subgraph Data["Data Layer"]
        DB[(PostgreSQL — Neon<br/>SQLite in local dev)]
    end

    subgraph External["External Services"]
        Google[Google Drive API v3<br/>OAuth2]
    end

    UI -->|HTTP navigation| RSC
    UI -->|fetch| API
    RSC --> Lib
    API --> Lib
    Lib -->|Prisma Client| DB
    Lib -->|googleapis SDK| Google
```

## 3. Component Architecture

```mermaid
graph LR
    subgraph Pages["App Router pages (src/app)"]
        Login["/login"]
        Dashboard["/dashboard"]
        Stats["/statistics"]
        Profile["/profile"]
        Admin["/admin/*"]
    end

    subgraph Components["src/components"]
        RowdeskScreen
        AppHeader
        StatCard
        SimpleBarChart
        CleaningSummary
    end

    subgraph Lib["src/lib — server-only shared logic"]
        auth[auth.ts]
        queue[queue.ts]
        csv[csv.ts / csvImport.ts]
        templates[templates.ts / templateDictionary.ts]
        drive[googleDrive.ts]
        encryption[encryption.ts]
        audit[audit.ts]
        rateLimit[rateLimit.ts]
        settings[settings.ts]
        stats[stats.ts]
        schemas[schemas.ts — Zod]
        validate[validate.ts]
        csrf[csrf.ts]
    end

    subgraph Prisma["Prisma Client"]
        client[prisma.ts singleton]
    end

    Dashboard --> RowdeskScreen
    Pages --> AppHeader
    Admin --> Components
    Pages --> Lib
    Lib --> client
    client --> DB[(Database)]
```

## 4. Request Lifecycle (Dashboard Claim Example)

```mermaid
sequenceDiagram
    participant Browser
    participant NextServer as Next.js Server<br/>(dashboard/page.tsx)
    participant Auth as lib/auth.ts
    participant Queue as lib/queue.ts
    participant DB as Database

    Browser->>NextServer: GET /dashboard
    NextServer->>Auth: requireUser()
    Auth->>DB: SELECT session + user
    DB-->>Auth: session valid
    Auth-->>NextServer: SessionUser
    NextServer->>Queue: claimNextRecordForUser(userId)
    Queue->>DB: releaseStaleClaims()
    Queue->>DB: findCandidate() — pending, then skipped
    Queue->>DB: updateMany (compare-and-swap claim)
    DB-->>Queue: count === 1 → success
    Queue->>DB: logAudit(record_claimed)
    Queue-->>NextServer: RecordWithPosition
    NextServer-->>Browser: Rendered RowdeskScreen (React)
```

The compare-and-swap `updateMany({ where: { id, claimedById: null }, data: { claimedById: userId } })` is what guarantees exclusivity: if two requests race for the same record, only one `updateMany` call affects a row (`count === 1`); the loser retries against the next candidate.

## 5. Data Flow — CSV Ingestion

```mermaid
flowchart LR
    A[CSV Source] --> B{Manual upload or<br/>Google Drive?}
    B -->|Manual| C["/api/import<br/>multipart file upload"]
    B -->|Drive| D["/api/admin/drive/process<br/>downloads file text"]
    C --> E[importCsvText — csvImport.ts]
    D --> E
    E --> F[Papa Parse → rows]
    F --> G[mapColumns — header aliasing]
    G --> H[rowToRecord — per-row cleaning]
    H --> I{Name and Phone<br/>both present?}
    I -->|No| J[Row dropped,<br/>counted in removedMissingName/Phone]
    I -->|Yes| K[normalizePhone]
    K --> L[SourceFile + Record rows<br/>created in DB]
    L --> M[Audit log: csv_imported]
```

## 6. Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Login as /api/auth/login
    participant RateLimit as lib/rateLimit.ts
    participant DB as Database

    Browser->>Login: POST {identifier, password}
    Login->>RateLimit: check IP + identifier buckets
    RateLimit-->>Login: allowed
    Login->>DB: find User by username/email
    Login->>Login: bcrypt.compare(password, hash)
    alt invalid credentials
        Login->>DB: logAudit(login_failed)
        Login-->>Browser: 401
    else valid, account ACTIVE
        Login->>DB: create Session row (30-day expiry)
        Login-->>Browser: Set-Cookie rowdesk_session (httpOnly)
        Login->>DB: logAudit(login)
        Login-->>Browser: 200 {user}
    end
```

Every subsequent request re-validates the session server-side by looking up the `Session` row (see [14-authentication-security.md](14-authentication-security.md)) — there is no stateless JWT to trust blindly, so revoking a session (e.g. a password reset) takes effect immediately.

## 7. Google Drive OAuth & Ingestion Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Browser
    participant Connect as /api/admin/drive/connect
    participant Google as Google OAuth
    participant Callback as /api/admin/drive/callback
    participant Scan as /api/admin/drive/scan
    participant Process as /api/admin/drive/process

    Admin->>Connect: GET (click "Connect Google Drive")
    Connect-->>Admin: redirect to Google consent screen (state cookie set)
    Admin->>Google: sign in + grant drive.readonly, userinfo.email
    Google-->>Callback: redirect with ?code&state
    Callback->>Callback: verify state, exchange code for tokens
    Callback->>Callback: encrypt + store tokens (GoogleDriveConnection)
    Callback->>Callback: verifyFolder(GOOGLE_DRIVE_FOLDER_ID)
    Callback-->>Admin: redirect to /admin/drive?connected=1

    Admin->>Scan: POST (click "Scan Drive")
    Scan->>Google: files.list (recursive, breadth-first)
    Scan->>Scan: classifyDriveFile — new/updated/unchanged
    Scan-->>Admin: counts

    Admin->>Process: POST (click "Process New & Updated")
    Process->>Google: files.get (download CSV text)
    Process->>Process: importCsvText (shared pipeline)
    Process-->>Admin: processed/failed counts
```

## 8. Deployment Architecture

```mermaid
graph LR
    Dev[Developer] -->|git push| GitHub[GitHub repo<br/>ARULKINT/rowdesk]
    GitHub -->|vercel --prod<br/>or GitHub integration| Vercel[Vercel Build]
    Vercel -->|prisma generate + migrate deploy<br/>against prisma/postgres/schema.prisma| Neon[(Neon Postgres)]
    Vercel -->|next build| Edge[Vercel Edge/Serverless<br/>Functions]
    Edge --> Neon
    Edge -->|OAuth2| GoogleAPI[Google Drive API]
    User[End User Browser] --> Edge
```

See [18-deployment.md](18-deployment.md) for the full build-command and environment-variable breakdown.

## 9. Component Communication Summary

| From | To | Mechanism |
|---|---|---|
| Browser | Server Components | Standard HTTP navigation (SSR) |
| Client Components (`"use client"`) | Route Handlers | `fetch()` to `/api/*`, JSON in/out |
| Route Handlers / Server Components | Database | Prisma Client (`src/lib/prisma.ts` singleton) |
| Route Handlers | Google Drive | `googleapis` SDK, OAuth2 client (`src/lib/googleDrive.ts`) |
| Any mutating Route Handler | Audit trail | `logAudit()` writes an `AuditLog` row synchronously in the same request |

## 10. Architecture Patterns & Design Decisions

| Pattern | Where it appears | Why it's used | Trade-off |
|---|---|---|---|
| **Server-Components-first, API-only-where-needed** | `src/app/**/page.tsx` fetch directly via Prisma; `src/app/api/**` exists only for client-triggered mutations and the OAuth callback | Avoids a redundant "fetch an API that itself just queries the database" round-trip for every read-heavy admin page | Business logic ends up split between page components (reads) and route handlers (writes) rather than living behind one uniform API surface |
| **Thin Route Handlers over a shared `lib` layer** | Every `route.ts` is a short auth-check + validate + delegate to `src/lib/*` | Keeps the actual business logic (claim algorithm, cleaning rules, template composition) unit-testable in isolation, without needing an HTTP server in the test | The route handlers themselves are consequently under-tested relative to the logic they call — see [17-testing.md](17-testing.md) and [24-known-issues.md](24-known-issues.md) |
| **Compare-and-swap concurrency control, not row locking** | `claimNextRecordForUser()` | Portable across SQLite (dev/test) and PostgreSQL (prod) without relying on a database-specific `SELECT ... FOR UPDATE` | Requires an explicit bounded retry loop (5 attempts) rather than the database blocking automatically |
| **Defense-in-depth authorization** | `requireUser()`/`requireAdmin()` (Server Components) **and** `getApiUser()` + role check (Route Handlers) | Neither layer alone is sufficient — a Server Component guard doesn't protect a directly-called API, and an API-only guard would still server-render protected page content before the check ran | Some duplication of the "is this an admin" check across the codebase |
| **Two Prisma schemas, one shared model definition** | `prisma/schema.prisma` (source) → `prisma/postgres/schema.prisma` (generated mirror) | SQLite locally (no external service needed to develop) without giving up real Postgres in production | Migrations must be manually added to both trees in the correct order — a process step, not something the tooling enforces automatically |
| **No service/repository abstraction layer over Prisma** | `src/lib/*` calls `prisma.*` directly | Prisma's generated client is already a type-safe data-access layer; an additional repository layer would add indirection without a corresponding benefit at this codebase's size | Swapping ORMs would require touching every `src/lib` file directly, rather than one abstraction boundary — accepted as unlikely and low-cost to defer |

None of these are formal named patterns like MVC or Clean Architecture in the textbook sense — Rowdesk is a **Next.js App Router monolith** with a conventional "pages call server-only lib modules which call Prisma" layering, not a deliberately-imposed architectural framework. A single Next.js monolith was the right fit given the actual requirements: one small internal team, one workflow, no need for independent scaling of separate services. This keeps the whole system in one deployable unit with one database connection pool, which is appropriate at this scale.
