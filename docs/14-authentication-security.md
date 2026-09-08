# 14 — Authentication & Security

## 1. Authentication Mechanism

Username-or-email + password, no third-party auth provider, no SSO, no OAuth login for end users (Google OAuth is used only for the *admin's* Google Drive connection, a completely separate concern — see [16-integrations.md](16-integrations.md)).

| Aspect | Implementation |
|---|---|
| Password storage | `bcrypt` hash, cost factor 12 (`bcryptjs`) |
| Session token | Random `cuid` (the `Session` row's own primary key) stored in an httpOnly cookie named `rowdesk_session` |
| Session lifetime | 30 days from creation, no sliding renewal |
| Session validation | Every request re-queries the `Session` table and joins the `User` row — expired or missing sessions are deleted lazily on lookup; disabled users are rejected even with a still-valid, unexpired session |
| Cookie flags | `httpOnly: true`, `sameSite: "lax"`, `secure: true` in production, `path: "/"` |
| Logout | Deletes the `Session` row server-side and clears the cookie |
| Password reset (self-service) | **Not implemented** — "Ask an admin to reset it" is the entire flow; an admin resets it from `/admin/users`, which also force-invalidates all of that user's existing sessions |
| Email verification | **Not implemented** — email is optional and unverified, used only as an alternate login identifier |
| MFA | **Not implemented** |
| Registration | **Not implemented** for self-service — accounts are admin-created only |

## 2. Authorization

Covered in depth in [06-user-roles-permissions.md](06-user-roles-permissions.md). Summary: two roles (`ADMIN`, `DATA_PROCESSOR`), enforced at both the Server Component layer (redirects) and the Route Handler layer (401/403 JSON), plus per-record ownership checks independent of role.

## 3. Security Analysis

### Implemented Security Measures

| Measure | Where | Detail |
|---|---|---|
| Password hashing | `src/lib/auth.ts` | bcrypt cost 12 — resistant to offline brute force at rest |
| Session revocability | DB-backed sessions | Unlike a stateless JWT, deleting the `Session` row invalidates access instantly (used on logout and forced password reset) |
| Login rate limiting | `src/lib/rateLimit.ts`, `/api/auth/login` | 20 attempts / 15 min per IP, 8 attempts / 15 min per identifier — mitigates credential-stuffing/brute-force, in-memory (see caveat below) |
| CSRF defense-in-depth | `src/lib/csrf.ts`, every mutating route | `SameSite=Lax` cookies already block most cross-site POSTs; `isSameOrigin()` adds an explicit Origin/Referer host check on top |
| Input validation | `src/lib/schemas.ts` (Zod) + `parseJsonBody()` | Every mutating endpoint validates its body shape and constraints before touching the database |
| SQL injection resistance | Prisma ORM throughout | No raw string-concatenated SQL anywhere except the fixed literal `SELECT 1` health check |
| XSS resistance in composed messages | `composeMessageHtml()` | Explicitly HTML-escapes both the template body and the substituted business name/domain before inserting via `dangerouslySetInnerHTML`, specifically to prevent a malicious template *or* a malicious scraped CSV value from injecting markup |
| Secrets at rest | `src/lib/encryption.ts` | Google OAuth access/refresh tokens are AES-256-GCM encrypted (authenticated encryption — tamper-evident) before being written to the database, keyed by `ENCRYPTION_KEY` |
| OAuth CSRF | `/api/admin/drive/connect` + `/callback` | Random `state` value round-tripped through a short-lived httpOnly cookie, validated on callback |
| Least-privilege OAuth scope | `googleDrive.ts` | Requests only `drive.readonly` (never write access) plus `userinfo.email` (to display which account is connected) |
| Last-admin protection | `/api/admin/users/[id]` | Cannot lock the whole system out of admin access by disabling/demoting the only remaining admin |
| File-upload type check | `/api/import` | Rejects anything not ending in `.csv` |

### Recommended Security Improvements (not currently implemented)

| Area | Recommendation | Why it matters here |
|---|---|---|
| Rate limiting storage | Move to a shared store (e.g. Upstash Redis) before running more than one serverless instance | The current in-memory `Map` does not share counts across Vercel function instances — see [22-performance-scalability.md](22-performance-scalability.md) |
| Self-service password reset | Add an email-based reset flow | Currently 100% dependent on an admin being reachable |
| MFA | Add TOTP or similar for admin accounts at minimum | Admin accounts have full data and configuration access |
| Content Security Policy | Add explicit CSP headers | No CSP is currently set; the app's own escaping mitigates the main injection vector but defense-in-depth headers are absent |
| Dependency vulnerability scanning | Add `npm audit` / Dependabot to CI | Not currently part of the visible workflow |
| Audit log tamper-evidence | Consider write-once storage or periodic export | `AuditLog` rows are regular mutable-by-privilege-escalation database rows today (no application code path deletes/edits them, but nothing at the DB level prevents it either) |

## 4. Data Privacy

The only genuinely sensitive data at rest is: user password hashes (never plaintext), Google OAuth tokens (encrypted), and business-listing contact data (names/phones/URLs — not personally sensitive in the legal sense, but the operational reason the tool exists). No payment data, health data, or government ID data is ever collected or stored.

## 5. Rate Limiting Detail

| Bucket key | Limit | Window | Applies to |
|---|---|---|---|
| `login:ip:<ip>` | 20 | 15 minutes | Any login attempt from that IP |
| `login:id:<identifier>` | 8 | 15 minutes | Any login attempt for that specific username/email |

No other endpoint is rate-limited. IP is read from `x-forwarded-for` (first value) or `x-real-ip`, falling back to `"unknown"` if neither header is present.
