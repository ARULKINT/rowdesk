# 06 — User Roles & Permissions

## 1. Roles

Rowdesk defines exactly two roles, stored on `User.role`:

| Role | Description |
|---|---|
| `DATA_PROCESSOR` | Default role. Works the shared lead queue, sees only their own statistics. |
| `ADMIN` | Everything a Data Processor can do, plus the full `/admin/*` section: users, Google Drive, templates, queue overview, audit log, settings, org-wide statistics, CSV import/export. |

There is no `Guest` concept — every route except `/login` and the login/health API requires a valid session (`requireUser()`); every `/admin/*` route additionally requires `role === "ADMIN"` (`requireAdmin()`).

A user also has a `status`: `ACTIVE` or `DISABLED`. A disabled user's session is treated as invalid immediately (`resolveSessionUser` checks `status !== "ACTIVE"` on every request), even if their session cookie hasn't expired.

## 2. Permission Matrix

| Feature | Guest (unauthenticated) | Data Processor | Admin |
|---|:---:|:---:|:---:|
| View `/login` | ✅ | ✅ (redirected away if already signed in via `/`) | ✅ |
| Dashboard / claim & work the queue | ❌ | ✅ | ✅ |
| Copy outreach message / phone | ❌ | ✅ | ✅ |
| Mark Done / Skip / Next / Previous | ❌ | ✅ (own claims only) | ✅ (own claims only) |
| View own Statistics | ❌ | ✅ | ✅ |
| Change own password | ❌ | ✅ | ✅ |
| View org-wide Statistics | ❌ | ❌ | ✅ |
| Manage users (create/disable/role/reset password) | ❌ | ❌ | ✅ |
| Connect/disconnect Google Drive | ❌ | ❌ | ✅ |
| Scan / Process Drive files | ❌ | ❌ | ✅ |
| Manual CSV import | ❌ | ❌ | ✅ |
| Export processed leads as CSV | ❌ | ❌ | ✅ |
| Manage template dictionaries | ❌ | ❌ | ✅ |
| View Processing Queue overview | ❌ | ❌ | ✅ |
| View Audit Log | ❌ | ❌ | ✅ |
| Change claim-timeout / timezone settings | ❌ | ❌ | ✅ |

## 3. Enforcement Points

Permissions are enforced **twice** for every protected capability — this is deliberate defense in depth, not redundancy by accident:

1. **Server Component guard** — `requireUser()` / `requireAdmin()` in `src/lib/auth.ts`, called at the top of every page (`page.tsx`) or layout (`admin/layout.tsx`). Redirects to `/login` (unauthenticated) or `/dashboard` (authenticated but not admin) before any protected data is fetched.
2. **Route Handler guard** — `getApiUser()` at the top of every mutating API route, followed by an explicit `if (!user || user.role !== "ADMIN")` check for admin-only endpoints. Returns `401`/`403` JSON rather than redirecting, since these are `fetch()` calls from client components, not navigations.

A Server Component redirect alone would not protect the API — a client could call `/api/admin/users` directly. A Route Handler check alone would still server-render admin page content before the API call happens. Both layers are required.

## 4. Record-Level Ownership

Beyond role, individual **records** carry their own ownership check independent of role: `assertOwnership()` in `src/lib/queue.ts` verifies `record.claimedById === callingUserId` before allowing Done/Skip/Release/Previous — an Admin has no special override to act on a record claimed by someone else (except via the explicit Previous "steal the claim" behavior, which still requires the caller to own the record they're currently on — see [11-business-logic.md](11-business-logic.md)).

## 5. Role Changes & Safety Rails

- An admin cannot demote or disable the **last remaining active admin** — `countActiveAdmins()` in `PATCH /api/admin/users/[id]` blocks the operation with a `400` if it would leave zero active admins.
- Resetting a user's password deletes all of that user's existing sessions (`prisma.session.deleteMany`), forcing re-login everywhere.
