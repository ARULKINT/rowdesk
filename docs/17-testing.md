# 17 — Testing Documentation

## 1. Test Framework & Setup

**Vitest** (`^5.0.0`), configured in `vitest.config.ts`:
- `@` path alias resolved to `src/`.
- `server-only` package aliased to a no-op stub (`src/lib/testing/server-only-stub.ts`) so server-only modules can be imported directly in tests running under Node rather than the Next.js server runtime.
- `fileParallelism: false` — test files run sequentially, not in parallel workers, because they share one SQLite database file.

**`vitest.setup.ts`** runs once before the suite: deletes any existing `prisma/test.db`, points `DATABASE_URL` at a fresh file, and runs `npx prisma migrate deploy` against it — every test run starts from a clean, fully-migrated, empty database, **never** the local dev database (`dev.db`), which may hold real imported data.

Run with:
```bash
npm test          # vitest run — full suite, single pass
npx tsc --noEmit   # typecheck (run alongside tests, not part of `npm test`)
npm run lint       # ESLint
npm run build      # production build (also a correctness check)
```

## 2. Current Test Inventory

As of this documentation, **7 test files, 75 tests**, all passing.

| Test file | Subject | What it covers |
|---|---|---|
| `src/lib/auth.test.ts` | Authentication | Password hash round-trip, wrong-password rejection, plaintext-never-stored assertion, session resolution (valid/unknown/expired/disabled-user) |
| `src/lib/csv.test.ts` | CSV cleaning | Column mapping (exact/aliased/missing headers), row trimming, missing-name/phone rejection, blank-optional-field handling, rating parsing, `normalizePhone()` (leading trunk 0, country code, punctuation stripping), `extractDomain()` |
| `src/lib/encryption.test.ts` | Token encryption | Encrypt/decrypt round-trip, random-IV non-determinism, wrong-key failure, missing-`ENCRYPTION_KEY` error |
| `src/lib/googleDrive.test.ts` | Drive integration logic | Recursive CSV listing against a fake Drive client (single folder, nested subfolders, duplicate-parent-link revisit guard), `getConfiguredFolderId()` (URL vs bare ID), `extractFolderId()`, `classifyDriveFile()` (new/updated/unchanged/mid-import), `isGoogleDriveConfigured()` |
| `src/lib/queue.test.ts` | Queue locking & navigation | Concurrent-claim exclusivity, claim resumption, empty-queue handling, skip-and-reclaim visibility, skip doesn't immediately hand back the same record, pending-preferred-over-skipped ordering, **skipped-pool FIFO rotation regression test**, ownership enforcement (done/skip/release all reject a non-owner), stale-claim timeout release (and non-release within the timeout), and the full `claimPreviousInFile` behavior matrix (step back + release, start-of-file block, done-row block, claim-stealing, non-owner rejection) |
| `src/lib/rateLimit.test.ts` | Rate limiting | Allows up to the limit, blocks past it, tracks independent keys separately |
| `src/lib/templates.test.ts` | Outreach composition | `{domain}`/`{name}` substitution (individually and combined), fallback values when empty, HTML escaping of both template body and substituted value (XSS-injection attempts via template *and* via CSV value), starter-template shape assertion |

## 3. Test Types Present

| Type | Present? | Detail |
|---|---|---|
| Unit tests | Yes | Pure-function modules (`csv.ts`, `templates.ts`, `encryption.ts`) |
| Integration tests | Yes | Modules that hit the real (test) database through Prisma (`auth.ts`, `queue.ts`) — these are integration tests in the sense that they exercise real SQL against a real (if ephemeral) database, not mocked |
| End-to-end (browser) tests | No | No Playwright/Cypress/etc. — UI flows were verified manually against the live deployment during development, not via an automated E2E suite |
| API contract tests | No | Route Handlers themselves (the `route.ts` files) are not directly unit-tested; their underlying logic (in `src/lib`) is |
| Security tests | Partial | XSS-escaping is explicitly tested (`templates.test.ts`); no dedicated auth-bypass/injection fuzz testing exists |
| Performance tests | No | No load or benchmark tests |

## 4. Concurrency Test Detail — Why It Matters

The single most safety-critical test in the suite is in `queue.test.ts`:

```
it("never assigns the same record to two concurrently-claiming users", async () => {
  const [a, b] = await Promise.all([
    claimNextRecordForUser(userA.id),
    claimNextRecordForUser(userB.id),
  ]);
  expect(a!.id).not.toBe(b!.id);
});
```

This directly exercises the compare-and-swap race described in [11-business-logic.md](11-business-logic.md) — it is the automated proof that Rowdesk's core promise ("nobody works the same lead twice") actually holds under concurrent access, not just in the happy-path single-user case.

## 5. Recommended Additional Test Cases (Not Currently Implemented)

| Test ID | Feature | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| REC-01 | Login route | Seeded user exists | POST valid credentials to `/api/auth/login` | `200`, session cookie set, `AuditLog` row written | High |
| REC-02 | Login rate limiting (route-level) | Fresh rate-limit buckets | POST 9 failed logins for one identifier | 9th response is `429` | Medium |
| REC-03 | CSV import route | Admin session | POST a `.csv` file to `/api/import` | `200` with correct `ImportSummary`; `SourceFile`/`Record` rows created | High |
| REC-04 | Admin-only route rejection | Data Processor session | POST to any `/api/admin/*` route | `403 {error: "Admin access required."}` | High |
| REC-05 | Same-origin rejection | Any session | POST with a foreign `Origin` header | `403 {error: "Invalid request origin."}` | Medium |
| REC-06 | Last-admin protection | Exactly one active admin | Attempt to disable/demote that admin | `400`, admin remains active | High |
| REC-07 | Statistics aggregation correctness | Records with known `done`/`doneAt`/`doneById` values | Load `/admin/statistics` with a date filter | Counts match the seeded data exactly | Medium |
| REC-08 | Drive OAuth callback state mismatch | A stale/forged `state` param | Hit the callback with a wrong state | Redirect with an error, no tokens stored | Medium |
| REC-09 | CSV export filtering | Records across multiple users/files | GET `/api/admin/export?userId=X&fileId=Y` | Only matching rows appear in the CSV | Low |
| REC-10 | End-to-end Dashboard flow (Playwright) | Seeded admin + processor | Log in as processor, claim, copy message, mark done | UI reflects Done state; DB row updated | Medium |

## 6. Manual Testing Performed During Development

Every feature documented in this package (login, claim/skip/done/next/previous, CSV upload, Google Drive OAuth connect/scan/process end-to-end against a real Drive folder, template dictionary CRUD and composer substitution, user management, statistics filters, audit log filters, phone-copy, CSV export) was manually exercised against the live production deployment (`https://crm-fx2.vercel.app`) using real or realistic data as part of building the feature, in addition to the automated suite above.
