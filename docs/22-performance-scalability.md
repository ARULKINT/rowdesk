# 22 — Performance & Scalability

## 1. Current Performance Characteristics

| Aspect | Current implementation | Assessment |
|---|---|---|
| Page rendering | Every data-bearing page is `export const dynamic = "force-dynamic"` — no static generation, no ISR, no route-level caching | Correct for this app (every page shows live, per-user or org-wide state) but means every navigation pays a full server round-trip and DB query |
| Database queries | Direct Prisma queries per request, no caching layer, no precomputed rollups | Fine at current data volumes (hundreds to low thousands of records); statistics pages run several `count`/`groupBy`/`aggregate` queries in parallel via `Promise.all` per request |
| Claim operation | Compare-and-swap `updateMany` with up to 5 retry attempts | O(1) per attempt; retries only occur under genuine concurrent contention for the same record, which is rare at this team size |
| Drive folder scan | Breadth-first traversal, capped at 500 folders, sequential API calls per folder for files + subfolders (`Promise.all` per folder, but folders processed as a queue, not all at once) | Adequate for a folder tree with dozens of subfolders; would slow linearly with folder count on a very large tree |
| CSV import | Single `createMany` bulk insert per file | Efficient — one round-trip regardless of row count |
| Frontend | No client-side data-fetching library (no React Query/SWR) — plain `fetch()` + local state | Simple, but no request deduplication/caching; not a concern at this UI's interaction volume |

## 2. Database Query Patterns Worth Noting

- `Record` has indexes on `(sourceFileId, rowIndex)`, `(status, claimedById)`, and `(claimedAt)` specifically to keep the claim/candidate-search queries and the stale-claim sweep fast as record counts grow.
- The Statistics pages issue on the order of 8–10 separate queries per page load (counts, aggregates, group-bys) rather than one denormalized read — acceptable at current scale, but the first place to optimize (e.g. a materialized daily-rollup table) if record counts grow into the hundreds of thousands.

## 3. Known Bottlenecks / Risks

| Risk | Detail | Mitigation status |
|---|---|---|
| In-memory rate limiter | `src/lib/rateLimit.ts`'s `Map` is per-process. Vercel can (and does, under load) run multiple serverless function instances simultaneously — each gets its own independent rate-limit state, so the *effective* limit is `(limit × number of concurrently-warm instances)`, not the configured limit | Documented in code and here; not yet fixed. Fix: move to a shared store (Redis/Upstash) |
| No caching of frequently-read, slow-changing data (e.g. active template list) | Every Dashboard load re-queries the active dictionary and its templates | Not a real bottleneck at current query cost; flagged for completeness |
| No pagination on some admin tables | "Currently claimed" (capped at 50) and "Recently completed" (capped at 20) use a hard `take` limit rather than true pagination — Audit Log *does* paginate properly | Acceptable today; would need real pagination if claimed-record counts regularly exceed 50 |
| Duplicate-import risk | Manually re-uploading an already-imported CSV creates a second full duplicate `SourceFile`/`Record` set — no dedup check exists | See [24-known-issues.md](24-known-issues.md) |

## 4. Scalability

### Current Scalability

Rowdesk is built and has been operated as a **single small-team, single-organization** tool. It is not designed, tested, or intended for high-concurrency or multi-tenant use.

### Database Scaling

Neon Postgres supports autoscaling compute and read replicas natively (a Neon platform feature, not something the app implements) — available if needed without application code changes, since Prisma talks to it over a standard Postgres connection string.

### Application Scaling

Next.js on Vercel scales serverless function instances automatically under load. The main constraint this introduces is the rate-limiter caveat above — anything else in the request path is stateless per-request (each request does its own Prisma queries; no server-side session/state is held in process memory except that rate-limit `Map`).

### Horizontal vs. Vertical Scaling

Horizontal scaling (more function instances) is what Vercel does automatically; there is no vertical-scaling knob to turn (no dedicated server to resize) beyond Neon's own compute-size settings for the database.

### Caching / CDN

Static assets are served through Vercel's edge network automatically. No application-level HTTP caching (`Cache-Control` headers) is set on any dynamic route, and none would be safe to add without care given every page renders per-user, per-session state.

### Queueing

No background job queue exists. All processing (CSV import, Drive scan/process) happens synchronously within the triggering HTTP request — a very large CSV or a very large Drive folder tree would extend that request's duration accordingly, up to whatever timeout Vercel's function platform enforces. There is no chunking/streaming/background-job fallback for oversized imports.

### Microservices Opportunity

None identified as worthwhile at this project's current scope — splitting Google Drive ingestion or CSV processing into a separate service would add operational complexity (a second deployable, inter-service auth, a message queue) without a corresponding need, given the current data and team-size scale.

## 5. Recommended Improvements (Not Currently Implemented)

1. Move rate limiting to a shared store before this deployment ever runs with more than one warm instance under real attack conditions.
2. Add a lightweight in-memory or edge-cache layer for the active template list if Dashboard load latency ever becomes noticeable.
3. Consider a background-job approach (or at least chunked processing) for CSV/Drive imports if file sizes grow large enough to risk a function timeout.
4. Add true pagination (not a hard cap) to the "Currently claimed" table if a team's concurrent claim count regularly exceeds 50.
