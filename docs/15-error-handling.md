# 15 — Error Handling & Logging

## 1. Error Handling Philosophy

Every mutating API route follows the same pattern: validate → check ownership/permission → attempt the operation → return either a success payload or `{ error: string }` with an appropriate status code. There is no global error-code taxonomy (no `"ERR_RECORD_LOCKED"`-style machine codes) — errors are human-readable strings intended to be shown directly to the user.

## 2. Error Catalogue

| Error | Cause | System Behavior | User Experience | Recovery |
|---|---|---|---|---|
| Incorrect username or password | Bad credentials on login | `401`, `login_failed` audit entry | Inline red error message on the login form | Retry with correct credentials |
| Account disabled | Admin disabled the user | `403` | "This account has been disabled. Contact an admin." | Admin re-enables the account |
| Too many login attempts | Rate limit exceeded | `429` | "Too many login attempts. Try again in a few minutes." | Wait out the 15-minute window |
| Invalid request origin | Origin/Referer host mismatch on a mutating request | `403` | Generic failure toast (this should not occur in normal browser use) | N/A — indicates a cross-site request was blocked |
| Not signed in | No/expired/invalid session on a protected API call | `401` | Client-side redirect or failure toast depending on where triggered | Sign in again |
| Admin access required | Non-admin calls an admin-only endpoint | `403` | Failure toast / page redirect | N/A (by design) |
| This record is no longer assigned to you | Claim ownership lost (stolen via stale-timeout release, or via another user's Previous) between page load and action | `409` | "Couldn't save — try again" toast; next claim attempt gets a fresh record | Reload / retry — a new claim is issued automatically |
| Validation error (various) | Request body fails its Zod schema | `400` with the schema's specific message | Inline form error or toast | Correct the input and resubmit |
| Couldn't find a "name"/"phone" column | CSV missing a required column | `400`, lists the columns that *were* found | Error shown on the Import page | Fix the CSV headers and re-upload |
| No usable rows found | Every CSV row missing Name or Phone | `400` | Error shown on the Import page | Fix the source data |
| Username or email already exists | Duplicate on user creation | `409` | Inline error in the Create User form | Choose a different username/email |
| Can't disable the last active admin / Can't remove the last active admin's role | Would leave zero active admins | `400` | Inline error | Promote another user to admin first |
| Current password is incorrect | Self-service password change | `400` | Inline error on the form | Retry with the correct current password |
| Google Drive isn't configured | Missing `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI` | Redirect with `?error=` query param | Banner on `/admin/drive` | Admin sets the env vars, redeploys |
| GOOGLE_DRIVE_FOLDER_ID isn't set | Missing folder env var when scanning/processing | `400` | Banner / inline error | Admin sets the env var, redeploys |
| Google didn't return a refresh token | Re-connecting without revoking prior access | Thrown from `connectWithCode`, surfaced as the OAuth error banner | Instructs the admin to revoke access at `myaccount.google.com/permissions` and reconnect | Revoke, reconnect |
| Couldn't scan/process the Drive folder | Any Google API error during scan/process | `500` (scan) or per-file `error` status (process) | Banner error, or that file's row shows `error` status with a tooltip | Retry the scan/process; check the underlying Drive API error message |
| Database unreachable | Connection failure | `503` from `/api/health`; unhandled elsewhere surfaces as a Next.js error boundary | Generic "Something went wrong" via `error.tsx` boundaries | Investigate database connectivity |

## 3. Error Boundaries (Client-Side)

| Boundary | Scope |
|---|---|
| `src/app/error.tsx` | Root — catches anything not caught by a more specific boundary |
| `src/app/admin/error.tsx` | All `/admin/*` pages |
| `src/app/dashboard/error.tsx` | The Dashboard specifically |

These are standard Next.js App Router error boundaries (`"use client"` components exporting a default function receiving `{ error, reset }`), rendering a generic fallback (`ErrorState` component) rather than a raw stack trace.

## 4. Client-Side Failure Handling Pattern

`RowdeskScreen.tsx` wraps every mutating `fetch()` in a `try/catch`; on failure it shows a toast ("Couldn't save — try again") rather than crashing the page, and leaves local state as-is so the user can retry the same action. Clipboard-copy failures fall back to a "Select & Ctrl+C" message rather than silently failing.

## 5. Logging

There is no structured application logger (no Winston/Pino) and no external log aggregation configured. Two logging channels exist:

1. **`AuditLog` table** — the primary, durable record of consequential actions. Every login (success/failure), every record claim/skip/complete/release, every admin user/template/settings/Drive action is written here via `logAudit()`. This is a business audit trail, not a debug log — see [21-admin-manual.md](21-admin-manual.md) for how it's reviewed.
2. **Runtime `console.error`/thrown exceptions** — uncaught errors surface in Vercel's function logs (visible via the Vercel dashboard or `vercel logs`), with no additional structuring, sampling, or retention policy configured by the app itself.

## 6. Monitoring

`GET /api/health` is the only purpose-built monitoring surface — it checks database connectivity via `SELECT 1` and returns `200`/`503` accordingly, intended to be polled by an external uptime monitor (Vercel's own, UptimeRobot, etc.; none is configured by the codebase itself). No APM, metrics, tracing, or alerting integration exists. See [23-maintenance.md](23-maintenance.md) for operational recommendations around this gap.
