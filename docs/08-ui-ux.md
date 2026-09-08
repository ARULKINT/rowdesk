# 08 — User Interface Documentation

> **Note on screenshots**: this documentation set was generated without a captured, saved set of real screenshot image files (the automated capture tool in this environment did not return a usable file path). Per the documentation's own visual-content rule ("do not fabricate screenshots — use accurate diagrams and explicit text instead when real screenshots are unavailable"), every screen below is documented with a precise field-by-field breakdown and layout description instead of an embedded image. All content was verified directly against the live deployed application at the time of writing.

## 1. Screen Inventory

| Screen | Route | Access | Purpose |
|---|---|---|---|
| Login | `/login` | Public | Authenticate |
| Dashboard (Lead Queue) | `/dashboard` | Any signed-in user | Work the locked queue |
| My Statistics | `/statistics` | Any signed-in user | Personal performance |
| Profile | `/profile` | Any signed-in user | View account, change password |
| Admin — Statistics | `/admin/statistics` | Admin | Org-wide performance, filters |
| Admin — Users | `/admin/users` | Admin | User management |
| Admin — Google Drive | `/admin/drive` | Admin | OAuth connection, scan/process |
| Admin — Processing Queue | `/admin/queue` | Admin | Live counts, source files, claims, export |
| Admin — Import CSV | `/admin/import` | Admin | Manual CSV upload |
| Admin — Template Dictionaries | `/admin/templates` | Admin | Outreach message management |
| Admin — Audit Log | `/admin/audit` | Admin | Full action history |
| Admin — Settings | `/admin/settings` | Admin | Claim timeout, timezone |

## 2. Login (`/login`)

**Layout**: Centered card, max-width 380px, on the page background color. "Rowdesk / Lead Queue" wordmark above the card.

| Element | Type | Behavior |
|---|---|---|
| Username or email | Text input, required | `autoComplete="username"` |
| Password | Password input, required | `autoComplete="current-password"` |
| Login | Submit button | Disabled + "Signing in…" while in flight |
| Error message | Inline text, `role="alert"` | Shown below the fields on failure |
| "Forgot your password?" | Static text | "Ask an admin to reset it" — no self-service reset flow exists |

**States**: idle → submitting (button disabled) → success (client-side `router.push("/dashboard")`) or error (red inline message, form re-enabled).

## 3. Dashboard — Lead Queue (`/dashboard`)

This is the primary screen, rendered by `RowdeskScreen.tsx`. Single-column card, centered, roughly 700px max width.

```
┌───────────────────────────────────────────────────────────┐
│ Rowdesk  LEAD QUEUE            Row 12/34   Done today  3   │  ← topbar
├───────────────────────────────────────────────────────────┤
│  filename.csv                              [PROCESSING]     │  ← card head + status chip
│                                                               │
│  NAME (2/3 width)                    RATING (1/3 width)     │
│  ┌─────────────────────────────┐    ┌──────────┐            │
│  │ Business Name                │    │ ★ 4.8/5  │            │
│  └─────────────────────────────┘    └──────────┘            │
│                                                               │
│  PHONE                               MAP URL                 │
│  ┌───────────────────┬─────────┐    ┌──────────────┬──────┐ │
│  │ 8680948502         │  Copy   │    │ maps.google… │ ⚪Verified│
│  └───────────────────┴─────────┘    └──────────────┴──────┘ │
│                                                               │
│  WEBSITE                                                     │
│  ┌───────────────────────────────────────────┬────────────┐ │
│  │ example.com                                 │  OPEN ↗    │ │
│  └───────────────────────────────────────────┴────────────┘ │
│                                                               │
│  OUTREACH MESSAGE                                             │
│  Hi Sir/Madam, this is Arul from Forge & Flint.               │
│  ...I came across [Business Name] and thought...              │
│  ◁  Template 1 / 6  ▷                    [Copy message]      │
│                                                               │
│  [ Previous ] [ Skip ] [   Done and Next Name   ] [ Next ]   │
│                                                               │
│  toast area (e.g. "Done — Business Name · you · 14:32:05")   │
└───────────────────────────────────────────────────────────┘
   Verified and Done states persist as you move through the queue.
```

| Element | Type | Notes |
|---|---|---|
| Row X / Y | Static text | Position of the current record within its source file (`rowIndex + 1` / `totalInFile`) |
| Done today | Live counter | Increments client-side on every Done action |
| Status chip | Badge | `PROCESSING` (claimed, not yet resolved) / `SKIPPED` / `DONE`, color-coded |
| Name | Read-only field | Business name from the CSV |
| Rating | Read-only field | `★ X.X / 5`, or `— / 5` if null |
| Phone | Field + **Copy** button | Copies the raw phone value to the clipboard; button flashes "Copied ✓" for 2s |
| Map URL | Field + **Verified** toggle | Toggling on opens the Maps URL in a new tab and persists the flag (`PATCH /api/records/[id]`) |
| Website | Field + **OPEN ↗** button | Opens the site in a new tab; disabled if no website URL |
| Outreach message | Rich text block | Business name/domain highlighted (`<mark>`) inline; `white-space: pre-wrap` preserves template paragraph breaks |
| Template cycle (◁ / ▷) | Buttons | Cycles through the active dictionary's templates, wrapping at both ends |
| Copy message | Button | Copies the fully composed plain-text message; label flashes "Copied!" |
| **Previous** | Button | Steps to the previous row (by position) in the same source file; disabled at row 1 of a file |
| **Skip** | Button | Marks skipped, releases claim, claims next |
| **Done and Next Name** | Button (accent-colored, primary action) | Marks done, releases claim, claims next |
| **Next** | Button | Releases claim without changing status, claims next |
| Toast | Ephemeral message | Confirms Done/Skip outcomes, or reports save failures; auto-dismisses after ~2.6s |

**Empty state**: when no record is available, the card is replaced with an "All done" message and a **Refresh Queue** button (calls the claim endpoint again without changing any status).

## 4. My Statistics (`/statistics`)

Grid of `StatCard` tiles (My Completed, Completed Today, Completed This Week, Completed This Month, Avg / Hour, Skipped (30d), Available In Queue) above a 14-day bar chart of completions per day (`SimpleBarChart`). Read-only.

## 5. Profile (`/profile`)

Displays the signed-in user's name/username/email/role, and a `ChangePasswordForm` (current password + new password, minimum 8 characters).

## 6. Admin — Statistics (`/admin/statistics`)

Filter bar (`<select>` range: Today/Yesterday/7d/30d/Custom, date pickers for custom range, user filter, source-file filter) → 6 `StatCard` tiles (Total, Completed, Pending, Removed, In Progress, Skipped) → bar chart of completions per day → a per-user performance table (Completed in range, Completed Today, Avg/Hour, Active/Idle status based on last session within 15 minutes) → a Data Quality tile row (Missing Rating/Maps URL/Website, Removed for missing Name/Phone).

## 7. Admin — Google Drive (`/admin/drive`)

Three states depending on configuration, shown as a single card at the top:

1. **Not configured** — instructions to set the three `GOOGLE_*` env vars.
2. **No folder configured** — instructions to set `GOOGLE_DRIVE_FOLDER_ID`.
3. **Connected** (or **Not connected** with a Connect button) — shows the connected Google account email and the resolved folder name, explicitly labeled "(and its subfolders) — fixed, not admin-editable".

When connected with a folder, below the connection card: 6 `StatCard` tiles (Total files, New, Updated, Unchanged, Processing, Errors), a **Scan Drive** / **Process New & Updated** button pair with inline status messages, and a table of every known Drive file (filename, last modified, last processed, status badge, record count).

## 8. Admin — Processing Queue (`/admin/queue`)

Header with **Export processed CSV** and **Import CSV** links. 4 `StatCard` tiles (Pending, Claimed, Completed, Skipped). A `CleaningSummary` block (original/removed/final row totals across all files, missing-field counts). Three tables: Source files (per-file done/pending/skipped breakdown), Currently claimed (up to 50 rows, oldest claim first), Recently completed (up to 20 rows, most recent first).

## 9. Admin — Import CSV (`/admin/import`)

Single-file upload form with column-expectation help text, an Import button, and — on success — the `CleaningSummary` result block before auto-redirecting to the Processing Queue.

## 10. Admin — Template Dictionaries (`/admin/templates`)

"+ Create dictionary" form (name + "seed with 3 starter templates" checkbox) followed by one card per dictionary: name, Active badge or "Set active" button, a list of templates (each editable inline, retirable/restorable, reorderable with ↑/↓), and an "+ Add template" textarea at the bottom of each dictionary card.

## 11. Admin — Audit Log (`/admin/audit`)

Filter bar (user, action type, free-text search) above a table (Time, User, Action, Entity, Details) with Newer/Older pagination (50 rows per page).

## 12. Admin — Settings (`/admin/settings`)

A small form: Claim timeout (minutes, 1–1440) and Timezone (free text, defaults to `Asia/Kolkata`).

## 13. Loading / Empty / Error States

| State type | Implementation |
|---|---|
| Route-level loading | `admin/loading.tsx` — a generic loading placeholder shown by Next.js while a Server Component's data fetch is in flight |
| Route-level error | `error.tsx` at the root, `admin/error.tsx`, `dashboard/error.tsx` — React error boundaries per Next.js convention |
| Empty tables | Every admin table renders an explicit "No … yet" row instead of an empty `<tbody>` |
| Dashboard empty queue | Dedicated "All done" card, described above |
| Field-level errors | Inline red text near the relevant form control, using the `--accent` color token |

## 14. Responsive Behavior

Layout uses CSS Grid with breakpoint-based column collapse (Tailwind `sm:`/`lg:` prefixes on stat-tile grids; the Dashboard action bar collapses from a 4-column grid to a single column under 560px via a `@media (max-width: 560px)` rule in `RowdeskScreen.module.css`). No dedicated mobile-app-style navigation exists — the same header/nav renders at all widths.

## 15. Theming

Full light/dark support via CSS custom properties in `globals.css`, driven by `prefers-color-scheme` (no manual in-app toggle exists). Color tokens: `--bg`, `--surface`, `--surface-alt`, `--ink`, `--ink-muted`, `--border`, `--border-soft`, `--accent` (burnt orange), `--accent-contrast`, `--accent-soft`, `--success`, `--success-soft`, `--chip`, `--shadow`.

## 16. Accessibility Notes

`:focus-visible` outlines are explicitly styled; the login error and toast messages use `role="alert"` / `aria-live="polite"` respectively; reduced-motion is respected (`@media (prefers-reduced-motion: no-preference)` gates the transition rules). No formal WCAG audit has been performed — see [24-known-issues.md](24-known-issues.md).
