# 24 — Known Issues, Technical Debt & Limitations

Identified by direct code inspection — nothing here is speculative.

## 1. Known Issues by Severity

### High

| Issue | Location | Impact | Cause | Recommended Solution |
|---|---|---|---|---|
| Rate limiter doesn't share state across serverless instances | `src/lib/rateLimit.ts` | Login brute-force protection is effectively weaker than its configured limits once more than one function instance is warm | In-memory `Map`, explicitly documented as single-instance-only | Move to a shared store (Redis/Upstash) before relying on this at scale |
| No self-service password reset | `src/lib/auth.ts`, `/login` | Any locked-out user is fully blocked until an admin manually resets their password | Never implemented (deliberately deferred, not a bug) | Add an email-based reset flow (requires adding email-sending capability, currently absent) |
| Duplicate CSV import has no guard | `src/lib/csvImport.ts` | Manually re-uploading an already-imported file creates a second, fully duplicate `SourceFile` + `Record` set, inflating counts and creating duplicate outreach targets | No dedup/fingerprint check against existing `SourceFile`s | Hash the file content (or compare filename + row count + first-row content) and warn/block on an apparent re-upload |
| No disaster-recovery runbook | Operational, not code | Untested recovery path in a genuine data-loss scenario | Never formalized | Write and periodically test a DR runbook; verify Neon backup/PITR settings explicitly |

### Medium

| Issue | Location | Impact | Cause | Recommended Solution |
|---|---|---|---|---|
| `Timezone` setting is stored but not applied | `src/lib/settings.ts`, `admin/settings` | The configured timezone doesn't currently affect any date bucketing/display — all date math uses the server's local `Date` | Setting was added to the schema/UI ahead of the feature that would consume it | Either wire it into `dailyCounts()`/date-range resolution, or remove the setting until it's implemented, to avoid a false impression of effect |
| `Record.called` field is dead in the UI | `prisma/schema.prisma`, `src/lib/schemas.ts` | Harmless but confusing — the field, its PATCH support, and its DTO field all still exist even though the "Called" toggle button was removed from the UI in favor of a phone-Copy button | Deliberate minimal-footprint decision at the time (avoiding a schema migration for a UI-only change) | Either restore a UI use for it, or do a follow-up migration to drop the column and its API surface cleanly |
| No true pagination on "Currently claimed" / "Recently completed" | `src/app/admin/queue/page.tsx` | Only the first 50 / 20 rows respectively are ever shown, with no way to see more | Hard `take` limit, not real pagination | Add page-based pagination matching the Audit Log's existing pattern |
| No automated end-to-end browser tests | `src/lib/*.test.ts` (unit/integration only) | UI regressions (button wiring, layout) aren't caught automatically | No Playwright/Cypress setup | Add a minimal E2E suite covering login → claim → done as a smoke test |
| No API Route Handler-level tests | `src/app/api/**/route.ts` | Request/response contract (status codes, error shapes) isn't directly tested — only the underlying `src/lib` logic is | Test suite targets business logic, not HTTP layer | Add integration tests that call the route handlers directly (see recommended cases in [17-testing.md](17-testing.md)) |
| No dependency vulnerability scanning in CI | Repository-wide | Vulnerable transitive dependencies could go unnoticed | No Dependabot/`npm audit` gate configured | Enable Dependabot or add an `npm audit` step to a CI workflow |

### Low

| Issue | Location | Impact | Cause | Recommended Solution |
|---|---|---|---|---|
| No accessibility (WCAG) audit performed | UI-wide | Unknown compliance level beyond the basic measures already in place (focus-visible, `aria-live`, reduced-motion) | Never formally audited | Run an automated + manual WCAG 2.1 AA pass |
| No Content-Security-Policy headers | Next.js config | Missing defense-in-depth against injection, beyond the app's own output escaping | Never added | Add CSP headers via `next.config.ts` |
| AuditLog `metadata` is a JSON string, not a structured/queryable column | `prisma/schema.prisma` | Audit search is a text `contains` match, not a structured query | Chosen for SQLite/Postgres portability (no native JSON column used) | Acceptable at current log volume; revisit if the log grows to a size where structured querying becomes necessary |
| No CI pipeline gating deploys on tests passing | Repository-wide | A broken build/test could theoretically be deployed | Deploys are manual (`vercel --prod`) or via direct Git integration, with no required-checks gate | Add a CI workflow (e.g. GitHub Actions) that runs `npm test`, `tsc --noEmit`, `lint`, `build` and blocks merge/deploy on failure |

## 2. Deliberate Design Trade-offs (Not Bugs)

These are worth calling out explicitly because they look like they could be issues but are intentional, documented decisions:

| Trade-off | Reasoning |
|---|---|
| The **Previous** button can steal a claim from another active user | Explicitly requested behavior — prioritizes quick self-correction over strict lock exclusivity for this one specific, opt-in navigation action. See [11-business-logic.md](11-business-logic.md). |
| Google Drive's source folder is fixed by an environment variable, not admin-editable in the UI | Deliberate — prevents accidental repointing to the wrong folder by a UI click; a redeploy is required to change it. |
| No record is ever hard-deleted | Deliberate — the audit trail and processed-lead history are meant to be permanent. |
| `Done` records are permanently immutable, even to admins | Deliberate data-integrity guarantee — see [11-business-logic.md](11-business-logic.md). |

## 3. Limitations Summary

| Category | Limitation |
|---|---|
| Functionality | No bulk operations (bulk skip, bulk reassign, bulk delete); no multi-tenant/org partitioning; no in-app message sending (compose-and-copy only) |
| Performance | Not tested/designed for high-concurrency or very large record counts; see [22-performance-scalability.md](22-performance-scalability.md) |
| Security | No MFA, no self-service password reset, no CSP headers |
| Scalability | In-memory rate limiter is single-instance-only |
| UX | No formal accessibility audit; no mobile-native app, web-responsive only |
| Compatibility | No legacy-browser support target; assumes a modern evergreen browser |
| Infrastructure | No CI/CD gate; migrations must be manually kept in sync across two schema files |
| Data processing | No duplicate-import detection; no chunked/background processing for very large files |
