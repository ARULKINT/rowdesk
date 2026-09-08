# 23 — Maintenance & Operations

## 1. Routine Maintenance Tasks

| Task | Frequency | How |
|---|---|---|
| Dependency updates | Periodic, as needed | `npm outdated`, update `package.json`, re-run the full test suite before deploying |
| Rotate `ENCRYPTION_KEY` | Only if compromised | Rotating it **invalidates the existing Google Drive connection** (stored tokens become undecryptable) — the admin must reconnect Drive afterward |
| Review the Audit Log for anomalies | Periodic (admin discretion) | `/admin/audit`, filter by action type (e.g. `login_failed`) |
| Clean up stale template dictionaries | As needed | No automated cleanup — retired templates and inactive dictionaries persist indefinitely; delete manually via direct database access if truly unwanted (no in-app delete exists) |

## 2. Database Migrations

Every schema change must be applied to **both** the SQLite and PostgreSQL schema/migration trees — see [18-deployment.md](18-deployment.md) §2 for the exact commands. Forgetting the Postgres side means the next production deploy's `prisma migrate deploy` step simply has nothing new to apply, silently leaving production on the old schema while local dev has moved on — there is no automated check that catches this mismatch; it must be caught by the developer following the documented workflow.

## 3. Log Cleanup

`AuditLog` grows without bound — there is no retention policy, archival job, or delete path implemented anywhere in the codebase. At current data volumes this is not a practical concern; if the table grows very large over years of operation, a manual archival strategy (export-then-truncate old rows, or move to a Postgres table partitioning scheme) would need to be designed and is not currently built.

## 4. Monitoring

`GET /api/health` is the only built-in monitoring hook. **Recommended but not configured**: point an external uptime monitor (Vercel's own monitoring, UptimeRobot, Better Uptime, etc.) at this endpoint on a short interval (e.g. every 1–5 minutes) so database connectivity loss is caught automatically rather than by a user reporting the app is down.

## 5. Backups

The application itself performs no backups. Production data durability depends entirely on Neon's platform-level backup and point-in-time-recovery features — verify these are enabled/adequate for your data-loss tolerance directly in the Neon project settings; this is outside the application codebase.

## 6. Disaster Recovery

| Scenario | Current preparedness |
|---|---|
| Vercel deployment failure / bad deploy | Roll back to a previous Vercel deployment (code); database migrations are **not** automatically reversible — see [18-deployment.md](18-deployment.md) §8 |
| Database corruption/loss | Fully dependent on Neon's backup/PITR capability; no application-level export/import tooling exists beyond the processed-leads CSV export (which covers only `done` records, not the full dataset) |
| Lost `ENCRYPTION_KEY` | Google Drive connection becomes permanently unrecoverable (the stored tokens can never be decrypted again) — reconnect from scratch; no other data is affected, since it's the only thing encrypted with that key |
| Accidental admin lockout | Prevented proactively by the last-admin-protection rule ([11-business-logic.md](11-business-logic.md)); if it somehow still occurs, direct database access (setting a user's `role` to `ADMIN` via SQL) is the only recovery path |

There is no formalized, tested disaster-recovery runbook beyond the points above — this is a gap worth closing before the tool holds data the business cannot afford to lose (see [24-known-issues.md](24-known-issues.md)).

## 7. Incident Response

No formal incident-response process is documented for this project. In practice: check the Vercel function logs for the affected time window, check `/api/health`, check the Audit Log for the relevant user/entity, and check Neon's own dashboard for database-side incidents.

## 8. Dependency & Security Maintenance

No automated dependency-vulnerability scanning (Dependabot, `npm audit` in CI) is currently configured — see [14-authentication-security.md](14-authentication-security.md) §3 for this and other recommended security improvements.
