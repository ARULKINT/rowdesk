# 25 — Future Roadmap

Recommendations below are derived directly from the gaps identified in [24-known-issues.md](24-known-issues.md), [22-performance-scalability.md](22-performance-scalability.md), and [14-authentication-security.md](14-authentication-security.md). None of this is currently implemented — this document is explicitly forward-looking, distinct from the "Current Implementation" content in the rest of this package.

## Immediate (critical fixes)

| Item | Why it's immediate |
|---|---|
| Add a duplicate-CSV-import guard | Silent data duplication actively risks double outreach to the same lead and inflated statistics — the most concrete "bug-shaped" gap in the system today |
| Verify/document Neon's backup and point-in-time-recovery configuration explicitly | The application has zero backup logic of its own; confirming the platform-level safety net actually covers the desired recovery-point objective is cheap and urgent |

## Short Term (important improvements)

| Item | Rationale |
|---|---|
| Move rate limiting to a shared store (Redis/Upstash) | Closes the multi-instance gap in login brute-force protection before it's ever actually tested under real attack conditions |
| Add API Route Handler-level tests | Closes the test-coverage gap between "business logic is tested" and "the HTTP contract is tested" |
| Add a CI workflow gating deploys on `test`/`typecheck`/`lint`/`build` | Removes the current manual-discipline dependency for shipping safely |
| Either wire up or remove the unused `Timezone` setting | Avoids the setting misleading an admin into thinking it has an effect it doesn't |
| Clean up the dead `Record.called` field (drop or repurpose) | Small, low-risk cleanup that removes confusing dead API surface |

## Medium Term (architecture and feature improvements)

| Item | Rationale |
|---|---|
| Self-service password reset (email-based) | Removes the single point of failure of "an admin must be reachable" for account recovery |
| True pagination on the Processing Queue's claimed/completed tables | Scales the admin UI past the current hard 50/20-row caps |
| Bulk operations (bulk skip stale claims, bulk export by filter, bulk retire templates) | Reduces admin toil as team size and data volume grow |
| Add a minimal end-to-end (Playwright) smoke test suite | Catches UI-wiring regressions that unit/integration tests structurally can't |
| Add Content-Security-Policy headers | Defense-in-depth beyond the app's existing output escaping |

## Long Term (major enhancements and scalability)

| Item | Rationale |
|---|---|
| Multi-factor authentication for admin accounts | Admin accounts hold full data and configuration access; MFA meaningfully raises the bar for account takeover |
| Structured logging + external log aggregation / APM | Closes the observability gap noted throughout [15-error-handling.md](15-error-handling.md) — currently limited to the `AuditLog` business trail and raw Vercel function logs |
| Formal accessibility (WCAG 2.1 AA) audit and remediation | Current accessibility support is partial and unaudited |
| Background-job processing for large CSV/Drive imports | Removes the risk of a very large import exceeding a serverless function's execution time limit |
| Dependency vulnerability scanning in CI (Dependabot / `npm audit`) | Ongoing supply-chain hygiene as the dependency tree ages |
| A formalized, tested disaster-recovery runbook | Moves DR from "implicitly relies on the database host" to an actually rehearsed procedure |

## Explicitly Out of Scope for Any Near-Term Roadmap

Multi-tenant/organization support, AI/ML-assisted outreach, in-app message sending, and a native mobile app are all outside the currently-stated purpose of this tool (see [01-project-overview.md](01-project-overview.md) §"Out-of-scope functionality") and are not recommended without a distinct product decision to expand scope.
