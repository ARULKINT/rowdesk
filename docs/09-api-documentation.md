# 09 — API Documentation

All endpoints are Next.js Route Handlers under `src/app/api/`. There is no separate API framework, versioning scheme, or OpenAPI spec — this document is the source of truth.

**Conventions used by every mutating (`POST`/`PATCH`) endpoint:**
- `isSameOrigin(request)` check first → `403 {"error": "Invalid request origin."}` on failure (CSRF defense-in-depth).
- Session lookup via `getApiUser()` → `401 {"error": "Not signed in."}` if absent.
- Admin-only endpoints additionally check `user.role === "ADMIN"` → `403 {"error": "Admin access required."}`.
- Request bodies validated with a Zod schema via `parseJsonBody()` → `400` with a field-level error message on failure.
- Successful mutations return `200` with a small JSON payload (rarely the full updated entity).

## 1. API Summary Table

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Sign in | Public (rate-limited) |
| POST | `/api/auth/logout` | Sign out | Any user |
| GET | `/api/health` | Liveness/DB-readiness probe | Public |
| POST | `/api/import` | Manual CSV upload | Admin |
| POST | `/api/profile/password` | Change own password | Any user |
| POST | `/api/queue/claim` | Claim next available record | Any user |
| POST | `/api/queue/action` | Skip / Done / Next / Previous | Any user |
| PATCH | `/api/records/[id]` | Toggle Called/Verified on own claim | Any user |
| GET / POST | `/api/admin/dictionaries` | List / create template dictionaries | Admin |
| POST | `/api/admin/dictionaries/[id]/activate` | Activate a dictionary | Admin |
| POST | `/api/admin/templates` | Add a template to a dictionary | Admin |
| PATCH | `/api/admin/templates/[id]` | Edit / retire / restore / reorder a template | Admin |
| GET | `/api/admin/drive/connect` | Begin Google OAuth flow (redirect) | Admin |
| GET | `/api/admin/drive/callback` | OAuth redirect target (redirect) | Admin |
| POST | `/api/admin/drive/disconnect` | Remove the Drive connection | Admin |
| POST | `/api/admin/drive/scan` | Scan the configured Drive folder tree | Admin |
| POST | `/api/admin/drive/process` | Import new/updated Drive CSVs | Admin |
| GET | `/api/admin/export` | Download processed leads as CSV | Admin |
| GET | `/api/admin/settings` *(via page, not a GET route)* | — | — |
| POST | `/api/admin/settings` | Update claim timeout / timezone | Admin |
| GET / POST | `/api/admin/users` | List / create users | Admin |
| PATCH | `/api/admin/users/[id]` | Edit / disable / enable / role / reset password | Admin |

> Settings are read server-side directly via `getSettings()` in the page component — there is no `GET /api/admin/settings` route; only the `POST` (save) exists.

## 2. Authentication

### `POST /api/auth/login`

| | |
|---|---|
| **Purpose** | Authenticate and start a session |
| **Auth** | None (rate-limited: 20/15min per IP, 8/15min per identifier) |
| **Request body** | `{ identifier: string, password: string }` |
| **Processing** | Look up user by username or email → `bcrypt.compare` → check `status === "ACTIVE"` → create `Session` row → set `rowdesk_session` cookie |
| **Response 200** | `{ user: { id, name, username, role } }` |
| **Response 401** | `{ error: "Incorrect username or password." }` |
| **Response 403** | `{ error: "This account has been disabled. Contact an admin." }` |
| **Response 429** | `{ error: "Too many login attempts..." }` |
| **Example request** | `POST /api/auth/login { "identifier": "admin", "password": "••••••••" }` |

### `POST /api/auth/logout`

Deletes the current `Session` row and clears the cookie. `200 { ok: true }`.

## 3. Queue

### `POST /api/queue/claim`

| | |
|---|---|
| **Purpose** | Claim the next available record (used by the "Refresh Queue" button when the queue was empty) |
| **Auth** | Any signed-in user |
| **Response 200** | `{ record: QueueRecordDTO | null }` |

### `POST /api/queue/action`

| | |
|---|---|
| **Purpose** | The single endpoint behind Skip / Done and Next Name / Next / Previous |
| **Auth** | Any signed-in user (record ownership enforced server-side) |
| **Request body** | `{ recordId: string, action: "skip" \| "done" \| "next" \| "previous" }` |
| **Processing (skip/done/next)** | Mutates the given record's status (or releases it), then calls `claimNextRecordForUser()` excluding that record |
| **Processing (previous)** | Calls `claimPreviousInFile()` — releases the current claim, claims the record at `rowIndex - 1` in the same source file (stealing the claim if another user holds it), unless that row is `done` or doesn't exist |
| **Response 200 (skip/done/next)** | `{ record: QueueRecordDTO \| null }` |
| **Response 200 (previous)** | `{ record: QueueRecordDTO \| null, moved: boolean, blockedReason?: "start_of_file" \| "target_done" }` |
| **Response 409** | `{ error: "This record is no longer assigned to you." }` (ownership lost) |

### `PATCH /api/records/[id]`

| | |
|---|---|
| **Purpose** | Toggle `called` / `verified` on the caller's currently-claimed record |
| **Auth** | Any signed-in user, must currently hold the claim |
| **Request body** | `{ called?: boolean, verified?: boolean }` |
| **Response 200** | The updated `Record` |
| **Response 409** | Ownership error if the record isn't (still) claimed by the caller |

## 4. Import & Export

### `POST /api/import`

| | |
|---|---|
| **Purpose** | Manual CSV upload |
| **Auth** | Admin |
| **Request body** | `multipart/form-data`, field `file` (must end in `.csv`) |
| **Response 200** | `ImportSummary` — `{ sourceFileId, filename, totalRows, imported, removedMissingName, removedMissingPhone, missingRating, missingMapsUrl, missingWebsite }` |
| **Response 400** | Missing required columns, or every row rejected |

### `GET /api/admin/export`

| | |
|---|---|
| **Purpose** | Download all `done` records as CSV |
| **Auth** | Admin |
| **Query params** | `userId?`, `fileId?`, `from?` (ISO date), `to?` (ISO date) |
| **Response** | `text/csv`, `Content-Disposition: attachment` — columns: Name, Google Maps URL, Phone, Average Rating, Website, User ID, Processed Timestamp, Source File, Source File ID, Source Row ID |

## 5. Google Drive

### `GET /api/admin/drive/connect`

Redirects to Google's OAuth consent screen (requesting `drive.readonly` + `userinfo.email`), setting a short-lived `rowdesk_drive_oauth_state` cookie for CSRF protection on the callback.

### `GET /api/admin/drive/callback`

| | |
|---|---|
| **Purpose** | OAuth redirect target |
| **Processing** | Validates `state`, exchanges `code` for tokens, stores them encrypted, auto-verifies the configured folder |
| **Response** | `302` redirect to `/admin/drive?connected=1` on success, or `/admin/drive?error=...` on failure |

### `POST /api/admin/drive/disconnect`

Deletes the `GoogleDriveConnection` row. `200 { ok: true }`.

### `POST /api/admin/drive/scan`

| | |
|---|---|
| **Purpose** | Recursively lists CSVs in the configured folder tree and classifies each as new/updated/unchanged against what's already known |
| **Response 200** | `{ totalFound, created, updated, unchanged }` |
| **Response 400** | Not connected, or `GOOGLE_DRIVE_FOLDER_ID` unset |
| **Response 500** | Drive API error (message passed through) |

### `POST /api/admin/drive/process`

| | |
|---|---|
| **Purpose** | Downloads and imports every `DriveFile` currently `new` or `updated` |
| **Response 200** | `{ processed, failed, results: [{ filename, ok, error?, imported? }] }` |
| **Response 400** | Drive not connected |

## 6. Templates

### `GET /api/admin/dictionaries` *(rendered server-side, not a fetch endpoint — listed for completeness of the resource)*

### `POST /api/admin/dictionaries`

| Request body | `{ name: string, seedStarters: boolean }` |
|---|---|
| **Processing** | Creates a `TemplateDictionary`; becomes active automatically if it's the first one ever created; optionally seeds the 3 built-in starter templates |
| **Response 200** | `{ id }` |

### `POST /api/admin/dictionaries/[id]/activate`

Deactivates whichever dictionary is currently active and activates the target, in a single transaction. `200 { ok: true }`.

### `POST /api/admin/templates`

| Request body | `{ dictionaryId: string, body: string }` (max 2000 chars) |
|---|---|
| **Processing** | Appends to the end of the dictionary's template order |
| **Response 200** | `{ id }` |

### `PATCH /api/admin/templates/[id]`

| Request body (discriminated on `op`) | Effect |
|---|---|
| `{ op: "edit", body }` | Replace the template text |
| `{ op: "retire" }` / `{ op: "restore" }` | Hide/unhide from the composer without deleting |
| `{ op: "move", direction: "up" \| "down" }` | Swap `position` with the adjacent sibling |

## 7. Users

### `GET /api/admin/users`

Returns every user with completed/completedToday counts and last-active timestamp.

### `POST /api/admin/users`

| Request body | `{ name, username, email?, password, role }` |
|---|---|
| **Response 200** | `{ id }` |
| **Response 409** | Username or email already exists |

### `PATCH /api/admin/users/[id]`

| Request body (discriminated on `op`) | Effect |
|---|---|
| `{ op: "disable" }` / `{ op: "enable" }` | Toggle account status; blocked if it would leave zero active admins |
| `{ op: "role", role }` | Change role; same last-admin protection |
| `{ op: "reset_password", password }` | Sets a new password hash, deletes all of that user's sessions |
| `{ op: "edit", name?, email? }` | Update profile fields |

## 8. Settings

### `POST /api/admin/settings`

| Request body | `{ claimTimeoutMinutes: number (1-1440), timezone: string }` |
|---|---|
| **Response 200** | `{ ok: true }` |

## 9. Profile

### `POST /api/profile/password`

| Request body | `{ currentPassword, newPassword }` (newPassword ≥ 8 chars) |
|---|---|
| **Response 400** | Current password incorrect |
| **Response 200** | `{ ok: true }` |

## 10. Health

### `GET /api/health`

Runs `SELECT 1` against the database. `200 { status: "ok", time }` or `503 { status: "error" }`. Intended for uptime monitors (Vercel's own, UptimeRobot, etc.).

## 11. Error Response Shape

Every error response follows `{ "error": "<human-readable message>" }` with an appropriate HTTP status code (`400`, `401`, `403`, `409`, `429`, `500`, `503`). There is no machine-readable error code field — see [15-error-handling.md](15-error-handling.md) for the full catalogue.
