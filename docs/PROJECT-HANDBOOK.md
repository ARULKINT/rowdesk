# PROJECT-HANDBOOK.md — Rowdesk, Explained Like the Original Developer Is In the Room

This handbook exists so that someone who did **not** build Rowdesk — a non-technical stakeholder, a brand-new developer, an experienced developer joining cold, a tester, an admin, or whoever inherits this project next — can understand what it does, why it exists, and how to work on it, without pulling the original author aside.

It complements, and does not repeat, [`docs/PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md), which is the dense technical reference (full API tables, exact schema, every route). This handbook is the story version: how the product works, journey by journey, click by click, with the technical detail folded in progressively rather than fired all at once. Everything below was verified directly against the source code as of commit `bd3c535` — nothing is invented, and anything uncertain is labeled as such (see [§33](#33-documentation-confidence)).

---

## Table of Contents

1. [Project at a Glance](#1-project-at-a-glance)
2. [Product in One Minute](#2-product-in-one-minute)
3. [Product Mental Model](#3-product-mental-model)
4. [Who Uses the System](#4-who-uses-the-system)
5. [Product Map](#5-product-map)
6. [Feature Catalog](#6-feature-catalog)
7. [Main User Journeys](#7-main-user-journeys)
8. [End-to-End Workflows](#8-end-to-end-workflows)
9. [What Happens When You Click Something?](#9-what-happens-when-you-click-something)
10. [Business Rules](#10-business-rules)
11. [Data, Explained for Humans](#11-data-explained-for-humans)
12. [Data Lifecycle](#12-data-lifecycle)
13. [Architecture — Two Levels](#13-architecture--two-levels)
14. [Component Responsibilities](#14-component-responsibilities)
15. [Request Lifecycle](#15-request-lifecycle)
16. [State & Status Changes](#16-state--status-changes)
17. [Error & Failure Workflows](#17-error--failure-workflows)
18. [External Integrations](#18-external-integrations)
19. [Security — Explained Simply](#19-security--explained-simply)
20. [Codebase Map for New Developers](#20-codebase-map-for-new-developers)
21. [Where Should I Look?](#21-where-should-i-look)
22. [Change Impact Map](#22-change-impact-map)
23. [Safe Development Guide](#23-safe-development-guide)
24. [Common Developer Tasks](#24-common-developer-tasks)
25. [Testing From the Product Perspective](#25-testing-from-the-product-perspective)
26. [Deployment, Explained Simply](#26-deployment-explained-simply)
27. [Known Issues](#27-known-issues)
28. [Knowledge Gaps](#28-knowledge-gaps)
29. [30-Minute New-Developer Onboarding](#29-30-minute-new-developer-onboarding)
30. [FAQ for New Developers](#30-faq-for-new-developers)
31. [Glossary](#31-glossary)
32. [Documentation Confidence](#32-documentation-confidence)
33. [Final System Summary](#33-final-system-summary)

---

## 1. Project at a Glance

| | |
|---|---|
| **Name** | Rowdesk |
| **What it is** | An internal web tool: half data-cleaning pipeline, half manual-outreach CRM |
| **Who built/runs it** | A small internal team — no public signup exists |
| **Live at** | `crm-fx2.vercel.app` (Vercel), backed by one Neon Postgres database |
| **Status** | Actively developed, in production use |
| **Repository name** | `crm-fx2` (the product is branded "Rowdesk" in the UI) |

---

## 2. Product in One Minute

**What is this product?** Rowdesk turns a messy CSV of scraped business listings (name, phone, rating, a Google Maps link, a website) into a clean, working list, and then walks a team through contacting every business on that list with a domain-protection sales message — twice, in two languages, across three timed follow-ups.

**What problem does it solve?** Two problems at once. First: scraped data is dirty — missing names, broken phone numbers, inconsistent spreadsheet columns from different scraping tools. Second: manually working through hundreds or thousands of leads as a team, without a shared system, means duplicate contact, lost track of who's been messaged, and no consistent follow-up timing.

**Who uses it?** Two kinds of people: **Data Processors**, who spend their day working through the lead queue one record at a time, and **Admins**, who feed the system data, manage the team, and watch how it's performing.

**What can users do?** A Data Processor claims a lead, reads its details, copies a pre-written outreach message (in English and Tamil) to send outside the app, marks it done, and moves to the next one — three times per lead, three days apart. An Admin uploads CSVs (or connects a Google Drive folder to pull them automatically), manages who's on the team, writes and organizes the outreach message library, and watches statistics on how the whole operation is progressing.

**What's the most important workflow?** The queue: **claim → read → copy message(s) → done → next**, repeated by every Data Processor, all day, against one shared pool of records that never lets two people work the same lead at once.

**What information does the system manage?** Business leads (name, phone, rating, map link, website), which source file they came from, who's working which one and since when, what outreach stage each one is at, the outreach message library, user accounts, and a full audit trail of every meaningful action.

**What does it depend on?** A Postgres database (Neon) for everything, and optionally Google Drive (for automatic CSV ingestion) — nothing else external.

### One-Sentence Summary

> Rowdesk lets a team clean scraped business-listing data and work it as a shared, locked queue through a three-stage bilingual outreach sequence, while admins manage the data, the team, and the message templates that drive it.

---

## 3. Product Mental Model

If you forget every technical detail, think of Rowdesk like this:

```text
                         ROWDESK
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
      USERS               DATA               ACTIONS
        │                   │                   │
        ▼                   ▼                   ▼
  Data Processors      Leads (Records)      Claim a lead
  Admins               Source Files         Copy a message
                        Outreach Templates   Mark it done
                        Audit trail          Advance to next stage
                                              Import a CSV
                                              Connect Google Drive
                                              Manage users
```

- **Users** are just two kinds: people who *work* the leads, and people who *feed and manage* the system.
- **Data** is one big list of leads, grouped by which import batch they came from, plus the message library that gets shown alongside each lead.
- **Actions** are all things one person does to one lead at a time (claim, message, advance, skip) or things an admin does to the whole system (import, configure, manage people).

There is no shopping cart, no payment, no public-facing website — it's a closed, internal work tool. If you've used any kind of shared support-ticket queue (one ticket assigned to one agent at a time), the core mechanic here is the same idea, applied to sales leads instead of tickets.

---

## 4. Who Uses the System

| Role | Who They Are | Main Goal | Can Do | Cannot Do |
|---|---|---|---|---|
| **Data Processor** | A team member doing the actual outreach work | Work through leads efficiently and correctly | Claim/skip/advance/complete records in the queue, copy outreach messages, mark a lead "called"/"verified", see their own statistics, change their own password | See other users' data, import CSVs, manage users/templates/settings, view the audit log, access anything under `/admin/*` |
| **Admin** | Whoever manages the operation | Keep the data clean, the team productive, and the message library effective | Everything a Data Processor can do (the dashboard is identical), plus import CSVs, connect/manage Google Drive, create/edit/disable users and reset their passwords, manage outreach templates, view org-wide statistics and the full audit log, change system settings | Nothing is withheld from an admin within this app — it's the top role |

There is no third role, no per-permission fine-tuning, and no concept of "team lead" or "viewer-only" — just these two.

### Data Processor's Journey

```text
Logs in
   ↓
Lands on /dashboard — a lead is already claimed and waiting
   ↓
Reads the lead's details (name, phone, rating, map link, website)
   ↓
Copies "Message 1" (English) and "Message 2" (Tamil) — sends them outside the app (WhatsApp/SMS, manually)
   ↓
Clicks "Done and Next Name" — the lead advances to its next stage (or completes, if this was the last one)
   ↓
A new lead is claimed automatically — repeat
```

### Admin's Journey

```text
Logs in
   ↓
Either: uploads a CSV (Import CSV page) — or connects Google Drive once, then Scans + Processes new files
   ↓
Leads flow into the shared queue automatically
   ↓
Writes/organizes outreach message templates per stage and language (Admin → Template Dictionaries)
   ↓
Team works the queue via /dashboard, same as any Data Processor
   ↓
Checks Admin → Statistics periodically to see progress; Admin → Users to manage the team; Admin → Audit Log if something needs investigating
```

---

## 5. Product Map

```text
Rowdesk
│
├── Public
│   └── /login              — username/email + password
│
├── Shared (any signed-in user)
│   ├── /dashboard            — the lead queue (the main screen everyone uses)
│   ├── /statistics           — a Data Processor's own completion stats
│   └── /profile              — account info + change password
│
└── Admin-only (/admin/*, blocked entirely for Data Processors)
    ├── /admin/statistics      — org-wide stats, outreach-stage breakdown, per-user performance
    ├── /admin/users           — create/edit/disable/reset-password/change-role
    ├── /admin/drive           — Google Drive connect / scan / process
    ├── /admin/queue           — processing overview, source files, CSV export
    ├── /admin/import          — upload one or more CSV files
    ├── /admin/templates       — outreach message library, by stage × language
    ├── /admin/audit           — searchable log of every meaningful action
    └── /admin/settings        — claim-lock timeout, timezone
```

`/` itself has no content of its own — it just sends you to `/dashboard` if you're signed in, or `/login` if not (`src/app/page.tsx`).

---

## 6. Feature Catalog

| Feature | What It Does | Who Uses It | Entry Point | Main Result | Status |
|---|---|---|---|---|---|
| Locked shared queue | Hands out one lead at a time, exclusively, to whoever asks | Data Processor, Admin | `/dashboard` | A lead assigned to exactly one person | Implemented |
| CSV import & cleaning | Parses a CSV, drops unusable rows, normalizes phone numbers | Admin | `/admin/import` | New leads added to the queue | Implemented |
| Google Drive auto-ingestion | Scans a fixed Drive folder for CSVs and imports new/changed ones | Admin | `/admin/drive` | Same as manual import, without the manual upload step | Implemented |
| 3-stage bilingual outreach sequence | Walks each lead through Initial → Follow-up 1 → Follow-up 2, 3 days apart, with English + Tamil message pairs | Data Processor | `/dashboard` | A fully-worked lead (3 touches, then done) | Implemented |
| Template Dictionaries | Admin-managed, swappable libraries of outreach message text | Admin | `/admin/templates` | The exact text a Data Processor copies on `/dashboard` | Implemented |
| User management | Create/disable/enable/promote/demote/reset-password | Admin | `/admin/users` | Team roster and access control | Implemented |
| Statistics | Personal and org-wide performance numbers and charts | Data Processor, Admin | `/statistics`, `/admin/statistics` | Visibility into throughput and progress | Implemented |
| Audit log | Every significant action, who did it, and when | Admin | `/admin/audit` | An accountability trail | Implemented |
| CSV export | Downloads every completed lead as CSV | Admin | `/admin/queue` → "Export processed CSV" | A results file, e.g. for reporting elsewhere | Implemented |
| Settings | Claim-lock timeout, timezone | Admin | `/admin/settings` | Tunes queue behavior | Implemented (timezone is stored but not yet applied — see [§27](#27-known-issues)) |
| Password reset (self) | Change your own password | Any user | `/profile` | Updated credential | Implemented |
| Password reset (by admin) | Reset another user's password, force-logout their other sessions | Admin | `/admin/users` | Recovered account access | Implemented |
| Self-service signup / public password reset | — | — | — | — | **Not implemented** — accounts are admin-provisioned only |
| AI/ML features of any kind | — | — | — | — | **Not implemented** — confirmed absent from the codebase |

### Feature Deep-Dive: The Locked Queue

**In Simple Words**: Imagine a stack of index cards, one per lead. Whenever someone asks for work, they get handed the top card that nobody else is holding. Once they're done with it, it either goes in the "finished" pile forever, or — for the outreach sequence — gets put back in a "come back to me in 3 days" pile.

**Why It Exists**: Without this, two team members could both message the same business, or leads could get lost/forgotten with no record of who touched what.

**Who Uses It**: Every Data Processor and Admin, every time they visit `/dashboard`.

**Starting Point**: Visiting `/dashboard`.

**User Actions**: Previous, "Done and Next Name" (advance the outreach stage or complete), Next (skip without advancing), toggle "Verified" (opens the map link), Copy Phone, Copy Message 1/2.

**What the System Does**: On page load, the server immediately tries to hand you a lead — either one you already had claimed, or the next available one, picked with a database-level "claim it atomically" operation so two people can never get the same lead (`src/lib/queue.ts`, `claimNextRecordForUser()`).

**Data Involved**: The `Record` table — specifically its `status`, `claimedById`, `claimedAt`, `outreachStage`, and `stageDueAt` columns.

**Final Result**: The Data Processor sees one lead's full details and two ready-to-copy outreach messages on screen.

**Possible Failures**: The queue is empty ("All done" screen with a manual Refresh button); a claimed lead times out and gets silently reassigned to someone else if left untouched too long (default 30 minutes).

**Code Location**: `src/lib/queue.ts` (all logic), `src/app/dashboard/page.tsx` (claims on page load), `src/components/RowdeskScreen.tsx` (the UI), `src/app/api/queue/action/route.ts` + `src/app/api/queue/claim/route.ts` (the API).

**Related Documentation**: [§8.2 of PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md#82-the-queue-claimskipdoneadvanceprevious-state-machine) for the exact state machine.

### Feature Deep-Dive: CSV Import & Cleaning

**In Simple Words**: You give it a spreadsheet of scraped business listings. It figures out which column is the name, which is the phone number, etc. (even if they're labeled differently than expected), throws out rows that are too broken to use, fixes up phone numbers into a consistent format, and adds everything that survives to the shared queue.

**Why It Exists**: Scraped data is never clean, and different scraping tools name their columns differently. Without automatic cleaning, every import would need manual spreadsheet surgery first.

**Who Uses It**: Admin only.

**Starting Point**: `/admin/import` (manual) or `/admin/drive` (automatic, via a connected Drive folder).

**User Actions**: Select one or more `.csv` files, click Import.

**What the System Does**: Reads the header row, matches each column against a list of known name variants (e.g. `phone`, `Phone Number`, `mobilenumber` all mean the same thing), then goes row by row: drops any row with a blank name; normalizes the phone number (strips formatting, handles a leading `91` country code or a leading `0`) and drops the row if what's left isn't a real-looking 10-digit mobile number. Everything that survives becomes a new lead.

**Data Involved**: Creates one `SourceFile` row (the import batch) and one `Record` row per surviving lead.

**Final Result**: A summary showing rows in, rows removed (and why), and rows successfully imported — per file, if multiple were uploaded at once.

**Possible Failures**: No `name` or `phone`-like column found at all (import rejected before any rows are processed); every single row missing name/phone (nothing to import); a file that isn't really a CSV.

**Code Location**: `src/lib/csv.ts` (column detection, phone cleaning — pure functions, fully unit-tested), `src/lib/csvImport.ts` (the shared save-to-database step), `src/app/api/import/route.ts`, `src/app/admin/import/page.tsx`.

### Feature Deep-Dive: The Outreach Sequence & Templates

**In Simple Words**: Every lead gets messaged up to three times — an initial message, then two follow-ups — three days apart each. Every message has two versions shown side by side: one in English, one in Tamil. An admin writes and organizes the actual wording; the app just decides which piece of text to show and when it's time for the next touch.

**Why It Exists**: A single cold message rarely converts; a timed follow-up sequence does better, and doing it in both languages reaches more recipients. Making it structured (not "whenever someone remembers") is what makes the timing consistent across a whole team.

**Who Uses It**: Data Processor (works it), Admin (writes the message content).

**Starting Point**: Appears automatically on `/dashboard` once a lead is claimed; admin side starts at `/admin/templates`.

**User Actions**: Cycle through available message variants (◁ ▷) if more than one exists per stage/language; Copy each message; click "Done and Next Name" once both are copied.

**What the System Does**: Looks up the *active* template dictionary's messages for the lead's current stage and each language, fills in `{domain}`/`{name}` placeholders from the lead's own data, and shows them. On "Done and Next Name": if this isn't the last stage, it schedules the next stage 3 days out and returns the lead to the pool (invisible until then); on the last stage, it finishes the lead permanently.

**Data Involved**: `Record.outreachStage`, `Record.stageDueAt`, and the `Template`/`TemplateDictionary` tables.

**Final Result**: The lead either resurfaces in 3 days at its next stage, or is permanently marked done after the third stage.

**Possible Failures**: No template configured for a given stage/language — shows a clear placeholder instead of blocking the whole queue.

**Code Location**: `src/lib/queue.ts`'s `advanceStage()`, `src/lib/templateDictionary.ts`, `src/lib/templates.ts`, `src/components/RowdeskScreen.tsx`, `src/app/admin/templates/`.

---

## 7. Main User Journeys

### Journey: Data Processor Works a Lead

**Happy Path**:
```text
User arrives at /dashboard
   ↓
A lead is already claimed and shown (claimed automatically on page load)
   ↓
User reads Name, Rating, Phone, Map URL, Website
   ↓
User copies Message 1 (English) — Copy button turns "Copied ✓"
   ↓
User copies Message 2 (Tamil) — same
   ↓
"Done and Next Name" button becomes enabled
   ↓
User clicks it
   ↓
System schedules the next stage (or completes the lead, if it was the last stage)
   ↓
System immediately claims and shows the next available lead
   ↓
User continues
```

**Alternate Path — Skipping**: Instead of copying messages and clicking Done, the user clicks **Next** at any time — the current lead is released (unchanged) and a new one is claimed. Nothing is marked skipped by this action; "skip" as a distinct concept only happens via the underlying `skip` action which isn't currently exposed as a separate button on this screen — see [§28](#28-knowledge-gaps).

**Alternate Path — Correcting a Mistake**: The user clicks **Previous** to step back into the immediately-prior row of the same file (useful right after realizing the last lead needs a second look). If that row is already `done`, or this is the first row of the file, nothing moves and a toast explains why.

**Failure Path**: The queue is empty — the screen shows "All done" with a manual "Refresh Queue" button instead of a lead. Or: a network hiccup during Copy/Done — a toast reading "Couldn't save — try again" appears and nothing is lost (the record stays claimed).

**Recovery Path**: Retry the action; if a lead was claimed but the browser was closed/left idle past the timeout (default 30 minutes), it silently returns to the pool and the user simply gets handed the next available lead on their next visit.

### Journey: Admin Imports New Data

**Happy Path**:
```text
Admin arrives at /admin/import
   ↓
Selects one or more CSV files
   ↓
Clicks Import
   ↓
System parses, cleans, and saves each file, sequentially
   ↓
A per-file cleaning summary is shown (rows in / removed / imported)
   ↓
If every file succeeded, the admin is auto-redirected to /admin/queue after ~2.4s
```

**Failure Path**: One file has no recognizable name/phone column — that file's row shows "failed: Couldn't find a ... column", but any other files in the same batch still process normally, and the page stays put (no auto-redirect) so the failure is actually seen.

**Recovery Path**: Fix the CSV's header row (or accept that some columns just weren't detected) and re-upload just that file.

---

## 8. End-to-End Workflows

### Workflow: CSV Import (Manual)

```text
START
 ↓
Admin selects file(s) on /admin/import and clicks Import
 ↓ (why: to add new leads to the system)
Browser sends a multipart form-data POST to /api/import
 ↓ (who: the browser's fetch() call in AdminImportPage)
Route Handler checks: same-origin? signed in? role === ADMIN?
 ↓ (what can fail: 403 if any check fails)
For each file: parse CSV → detect columns → clean rows → save
 ↓ (business rules: see §10)
A new SourceFile row + one Record row per surviving lead are written to Postgres
 ↓
An AuditLog entry ("csv_imported") is written
 ↓
Response: { processed, failed, results[] } sent back to the browser
 ↓
UI shows a cleaning summary per file
 ↓
USER SEES RESULT: how many rows came in, how many were removed and why, how many were actually added
```
*Implemented in: `src/app/admin/import/page.tsx` → `src/app/api/import/route.ts` → `src/lib/csvImport.ts` → `src/lib/csv.ts` → Postgres via Prisma.*

### Workflow: Working a Lead Through the Full Outreach Sequence

```text
START — a Record exists with outreachStage = "initial", stageDueAt = null
 ↓
Data Processor visits /dashboard → claims it
 ↓
Copies both Message 1 (English) and Message 2 (Tamil) for the "Initial" stage
 ↓
Clicks "Done and Next Name"
 ↓
System sets outreachStage = "followup1", stageDueAt = now + 3 days, releases the claim
 ↓
Record is invisible to the queue until stageDueAt passes
 ↓ (3 days later)
Some Data Processor claims it again — Follow-up 1 messages are shown
 ↓
Copies both messages, clicks "Done and Next Name"
 ↓
System sets outreachStage = "followup2", stageDueAt = now + 3 days, releases the claim
 ↓ (3 days later)
Claimed again — Follow-up 2 messages are shown
 ↓
Copies both messages, clicks "Done — Complete" (same button, different label on the final stage)
 ↓
System sets status = "done", outreachStage = "finished", doneAt = now
 ↓
USER SEES RESULT: the lead disappears from the queue forever; it now counts toward "Completed" everywhere in Statistics
```
*Implemented in: `src/lib/queue.ts`'s `advanceStage()`, driven by `src/components/RowdeskScreen.tsx`'s "Done and Next Name" button via `POST /api/queue/action` with `action: "advance"`.*

### Workflow: Google Drive Auto-Ingestion

```text
START
 ↓
Admin (once) clicks "Connect Google Drive" on /admin/drive
 ↓ (why: authorize Rowdesk to read one specific Drive folder)
Redirected to Google's consent screen → back to Rowdesk with an authorization code
 ↓
Rowdesk exchanges the code for OAuth tokens, encrypts and stores them
 ↓
Admin clicks "Scan Drive"
 ↓ (what: lists every CSV in the configured folder + subfolders)
Each file is classified: New / Updated / Unchanged, by comparing Drive's last-modified time to what was last successfully imported
 ↓
Admin clicks "Process New & Updated"
 ↓
Each pending file is downloaded and run through the exact same cleaning pipeline as manual upload
 ↓
USER SEES RESULT: new leads appear in the queue, and each file's status updates to Processed (or Error, with the reason shown)
```
*Implemented in: `src/lib/googleDrive.ts`, `src/app/api/admin/drive/{connect,callback,scan,process}/route.ts`, `src/app/admin/drive/`.*

---

## 9. What Happens When You Click Something?

### "Done and Next Name" (the main dashboard button)

```text
USER ACTION: click "Done and Next Name" (disabled until both messages are copied)
    ↓
UI EVENT: onClick → runAction("advance")
    ↓
FRONTEND FUNCTION: queueAction() in RowdeskScreen.tsx
    ↓
API REQUEST: POST /api/queue/action  { recordId, action: "advance" }
    ↓
BACKEND HANDLER: src/app/api/queue/action/route.ts
    ↓
BUSINESS LOGIC: advanceStage() in src/lib/queue.ts — checks ownership, decides "schedule next stage" vs. "complete", writes an audit log entry
    ↓
DATABASE: one Record UPDATE (+ one AuditLog INSERT)
    ↓
Then immediately: claimNextRecordForUser() picks and claims the caller's next lead
    ↓
RESPONSE: { record: <next lead, or null if queue is empty> }
    ↓
FRONTEND STATE UPDATE: setRecord(next) — the screen re-renders with the new lead (or the "All done" empty state)
    ↓
USER FEEDBACK: a toast — "Done — <name> · you · <time>" if the lead just fully completed, or "Done — <name> · Follow-up N in 3 days" otherwise
```
Error handling: any non-OK response shows "Couldn't save — try again" and leaves the current lead on screen untouched.

### "Copy message" button (either message box)

```text
USER ACTION: click "Copy message" on Message 1 or 2
    ↓
FRONTEND FUNCTION: handleCopyBox() — composes the final text (template + this lead's {domain}/{name} filled in)
    ↓
Writes it to the clipboard via the browser's Clipboard API — no network request at all
    ↓
FRONTEND STATE UPDATE: that box's "copied" flag flips true → button reads "Copied ✓", and (once both boxes are copied) "Done and Next Name" becomes clickable
```
Error handling: if the clipboard write is blocked by the browser, a toast says "Couldn't copy — select & Ctrl+C" instead of silently failing.

### "Login" button

```text
USER ACTION: submit the login form
    ↓
FRONTEND FUNCTION: handleSubmit() in src/app/login/page.tsx
    ↓
API REQUEST: POST /api/auth/login { identifier, password }
    ↓
BACKEND HANDLER: rate-limit check (IP + identifier) → look up the user by username or email → compare the password against its bcrypt hash
    ↓
On success: a Session row is created, its id becomes an httpOnly cookie, and a login is audit-logged
    ↓
RESPONSE: 200 with the user's basic info, or 401/403/429 with a specific error message
    ↓
FRONTEND: on success, redirect to /dashboard; on failure, show the error message inline on the form
```

### "Verified" toggle (dashboard)

```text
USER ACTION: click the "Verified" pill next to the Map URL
    ↓
FRONTEND: flips the toggle immediately (optimistic UI) and, if turning it ON, opens the Google Maps link in a new tab
    ↓
API REQUEST: PATCH /api/records/{id} { verified: true|false }
    ↓
BACKEND: confirms the caller still owns this record's claim, then updates just that one field
    ↓
No stage/status change happens — this is a manual bookkeeping flag, independent of the queue state machine
```

---

## 10. Business Rules

### Rule: A record with no usable phone number never enters the system

**Why**: The whole point of the pipeline is enabling outreach — a lead nobody can call or message is not useful data, and keeping it around just adds noise.

**Condition**: On CSV import, per row.

**Result**: The row is silently dropped and counted in the import summary as "removed — missing phone".

**Example**: A scraped row with phone `"08680 948502"` (11 digits, leading 0) becomes `8680948502` — kept. A row with `"044-28521234"` (a Chennai landline, doesn't start 6–9 after cleaning) is dropped. A row with `"98765432"` (only 8 digits — scrape noise) is dropped.

**Implementation**: `normalizePhone()` in `src/lib/csv.ts`.

### Rule: A lead in the queue can only ever be worked by one person at a time

**Why**: Prevents two team members duplicating outreach to the same business, and keeps "who's responsible for this lead right now" unambiguous.

**Condition**: Whenever someone visits `/dashboard` or takes a queue action.

**Result**: A database-level compare-and-swap makes claiming atomic — even if two people click at the exact same instant, only one gets the lead.

```text
Two users request a lead at the same instant
 ↓
Both queries see the same candidate lead
 ↓
Both try to claim it — only one UPDATE actually succeeds (claimedById was still null)
 ├── Succeeds → that user gets it
 └── Fails → that user's code retries against the next candidate
```

**Implementation**: `claimNextRecordForUser()` in `src/lib/queue.ts`; verified by a dedicated concurrency test in `queue.test.ts`.

### Rule: A "Done" lead can never be reopened

**Why**: Once outreach is fully complete, that record is a permanent historical fact — reopening it would let someone accidentally re-message a business or corrupt completion statistics.

**Condition**: Any action targeting a record whose `status` is `"done"`.

**Result**: Blocked — even the "Previous" button, which otherwise steals claims freely, explicitly refuses to step into a done row.

**Implementation**: `assertOwnership()` and `claimPreviousInFile()`'s explicit `status === "done"` check, both in `src/lib/queue.ts`.

### Rule: Both outreach messages must be copied before a stage can be marked done

**Why**: Prevents accidentally advancing a lead's outreach stage (and losing the 3-day window on it) without actually having sent anything.

**Condition**: Applies per stage — resets whenever the record or its stage changes.

**Result**: "Done and Next Name" stays disabled until the copy button for both Message 1 and Message 2 has been clicked at least once (a box with zero configured templates for its slot is treated as already satisfied, so a gap in the template library can't jam the whole queue).

**Implementation**: `box1Ready`/`box2Ready`/`doneReady` logic in `src/components/RowdeskScreen.tsx`.

### Rule: The last active admin can never be disabled or demoted

**Why**: Prevents the team from accidentally locking everyone out of the admin section entirely.

**Condition**: An admin tries to disable, or change the role of, another admin.

**Result**: Blocked with a clear error, *unless* at least one other active admin remains.

**Implementation**: `countActiveAdmins()` in `src/app/api/admin/users/[id]/route.ts`.

### Rule: A stale claim self-heals

**Why**: If someone claims a lead and then goes idle (closes the laptop, gets pulled into something else), that lead shouldn't be stuck unreachable forever.

**Condition**: A record's `claimedAt` is older than the configured timeout (Admin → Settings, default 30 minutes).

**Result**: Automatically released back to the pool — checked every time *anyone* tries to claim a new lead, not on a background timer.

**Implementation**: `releaseStaleClaims()` in `src/lib/queue.ts`.

---

## 11. Data, Explained for Humans

### RECORD (a "lead")

**What is it?** One business listing — a row from a scraped CSV, cleaned up.
**Why does the system need it?** It's the actual thing being worked — the whole app exists to move Records through the outreach sequence to completion.
**Who creates it?** The CSV import pipeline (manual or Drive).
**Who modifies it?** Whoever currently has it claimed (via the queue actions), and the stale-claim sweep.
**Who reads it?** Everyone, filtered by "is it claimable" or "is it mine."
**What happens to it over time?** It moves through claim → outreach stages → either "done" (permanent) or "skipped" (returns to the pool).
**What depends on it?** Statistics, the audit log (references it by id), the CSV export.

### SOURCE FILE (an "import batch")

**What is it?** One CSV upload — a container for the Records it produced.
**Why does the system need it?** To track where leads came from and show per-file progress (e.g. on `/admin/queue`).
**Who creates it?** The import pipeline, once per successful upload.
**Who modifies it?** Nobody, after creation — it's a historical record of the import event itself (total rows, rows removed and why).

### TEMPLATE DICTIONARY / TEMPLATE (the "message library")

**What is it?** A named set of outreach message texts, one per stage-and-language combination.
**Why does the system need it?** So the actual wording sent to businesses is admin-controlled and can be revised without a code change, and multiple message variants can be A/B-rotated.
**Who creates/modifies it?** Admins only, via `/admin/templates`.
**What happens to it over time?** Old wording is "retired," not deleted, so history is preserved; exactly one dictionary is "active" (in use) at a time.

### AUDIT LOG ENTRY

**What is it?** One row recording "who did what, to what, and when."
**Why does the system need it?** Accountability and troubleshooting — e.g. "who marked this lead done?" or "who disabled this user?"
**Who creates it?** The system itself, automatically, alongside almost every meaningful action — never the user directly.
**What happens to it over time?** Nothing — it accumulates forever; there's no deletion or archival logic (see [§27](#27-known-issues)).

### Conceptual Relationship

```text
SOURCE FILE (one CSV import)
   │
   ├── contains
   ▼
RECORD (one lead)
   │
   ├── worked through, using
   ▼
TEMPLATE (message text, picked by its current outreach stage + language)
   │
   └── every meaningful action on any of the above produces
       AUDIT LOG ENTRY
```

---

## 12. Data Lifecycle

**For a `Record`** (the central entity):

```text
CREATED           — a CSV row survives cleaning during import
   ↓
VALIDATED         — name present, phone normalized to a real mobile number (this happens *before* creation — a row that fails validation is never created at all)
   ↓
STORED            — status = "pending", outreachStage = "initial"
   ↓
CLAIMED           — a user claims it (claimedById/claimedAt set)
   ↓
UPDATED           — called/verified toggled, outreach stage advanced (repeats up to 3 times, 3 days apart each)
   ↓
USED              — read by Statistics, the Audit Log, and (once done) the CSV export
   ↓
FINISHED (terminal) — status = "done", never modified again
```
There is no archival or deletion stage anywhere in the current implementation — a `Record`, once created, exists forever (see [§27](#27-known-issues)). "Skipped" is not an end state — a skipped record simply re-enters the CLAIMED step of this cycle later.

---

## 13. Architecture — Two Levels

### Level A — Beginner Architecture

```text
TEAM MEMBER'S BROWSER
        ↓
    ROWDESK WEBSITE
        ↓
  (one combined app that
   both serves pages and
   handles all the logic)
        ↓
     DATABASE
   (stores everything:
   leads, users, messages,
   the audit trail)
        ↓
 (optionally) GOOGLE DRIVE
   — only if an admin
   connected it, to pull
   in CSVs automatically
```

In plain terms: there's no separate "backend server" and "frontend server" — it's one Next.js application that renders the pages *and* handles the logic behind them, all deployed together on Vercel. The only other thing it ever talks to is the database, and, optionally, Google Drive.

### Level B — Developer Architecture

```text
Browser
 ↓ (fetch() for interactive actions)
Next.js Route Handlers  (src/app/api/**)          — the "API" layer
 ↓                                        ↑
 │                          Next.js Server Components (src/app/**/page.tsx) — render pages, query data directly
 ↓                                        ↓
Business logic modules  (src/lib/*.ts)   — auth, queue, csv, templates, googleDrive, audit, rateLimit, csrf
 ↓
Prisma ORM  (src/lib/prisma.ts)
 ↓
PostgreSQL  (Neon, one database for local dev + production)
 ↓ (optional, admin-triggered only)
Google Drive API  (via googleapis, OAuth2)
```

There's no separate "controller" layer beyond the Route Handlers themselves, no message queue/worker process, and no cache layer — every page load and API call talks to Postgres directly through Prisma.

---

## 14. Component Responsibilities

| Component | Responsibility | Input | Output | Depends On | Location |
|---|---|---|---|---|---|
| `RowdeskScreen` | Renders the queue screen; owns all client-side interaction state (message copy status, toasts, busy flags) | The claimed record + active templates, from the server | Calls to `/api/queue/*` and `/api/records/*` | `queue.ts`'s types, `templates.ts`, `csv.ts`'s `extractDomain` | `src/components/RowdeskScreen.tsx` |
| `queue.ts` | The claim/skip/done/advance/previous state machine | `userId`, `recordId`, an action | Updated `Record` rows, audit log entries | `prisma.ts`, `settings.ts`, `audit.ts` | `src/lib/queue.ts` |
| `csv.ts` | Column detection + row cleaning (pure logic, no I/O) | Raw header list / raw row | Column mapping / cleaned record or a rejection reason | Nothing (pure functions) | `src/lib/csv.ts` |
| `csvImport.ts` | Orchestrates parse → clean → persist for one CSV file | File text + filename | An `ImportSummary` or an error | `csv.ts`, `prisma.ts`, `audit.ts` | `src/lib/csvImport.ts` |
| `auth.ts` | Password hashing, session lifecycle, page/route guards | Credentials or a session cookie | A `SessionUser` or a redirect/`null` | `prisma.ts`, `bcryptjs` | `src/lib/auth.ts` |
| `googleDrive.ts` | OAuth client, folder scanning, file classification, token refresh | OAuth codes / a folder ID | Drive file lists, an authorized client | `googleapis`, `encryption.ts`, `prisma.ts` | `src/lib/googleDrive.ts` |
| `templateDictionary.ts` | Loads the *active* dictionary's templates grouped by stage × language | — | A `TemplatesByStage` structure | `prisma.ts`, `templates.ts` | `src/lib/templateDictionary.ts` |
| `AppHeader` | Top navigation, different link set per role | The signed-in user | Rendered nav | `auth.ts`'s `SessionUser` type | `src/components/AppHeader.tsx` |

---

## 15. Request Lifecycle

Walking through one concrete request — a Data Processor clicking "Done and Next Name":

```text
Browser
 ↓  fetch POST /api/queue/action { recordId, action: "advance" }
Route  (src/app/api/queue/action/route.ts)
 ↓
Same-origin check  (isSameOrigin() — is this really coming from our own site?)
 ↓
Authentication  (getApiUser() — reads the session cookie, looks up the Session row, confirms it's not expired and the user isn't disabled)
 ↓
Validation  (parseJsonBody() against a Zod schema — is the request shape actually valid?)
 ↓
Business logic  (advanceStage() in queue.ts — checks the caller actually owns this record's claim, decides schedule-next-stage vs. complete)
 ↓
Database  (Prisma UPDATE on Record, INSERT into AuditLog)
 ↓
Business logic again  (claimNextRecordForUser() — picks and claims the caller's next lead)
 ↓
Route  (assembles the JSON response)
 ↓
Response  { record: <next lead> }
 ↓
Browser  (RowdeskScreen re-renders with the new lead)
```

Plain language: the browser asks "I'm done with this lead, give me the next one" — the server double-checks the request is legitimate and really from this user, applies the outreach rule (schedule vs. complete), records what happened, then immediately looks for and hands back the next available lead, all in one round trip.

---

## 16. State & Status Changes

A `Record`'s `status` field:

```text
pending
   ├── claimed → done            (permanent — no way out)
   ├── claimed → skipped         (re-enters the pool)
   └── claimed → pending         ("Next"/"Previous" — claim released, status unchanged)

skipped
   ├── claimed → done
   ├── claimed → skipped         (skip again)
   └── claimed → pending/skipped (Next/Previous)

done
   └── (terminal — nothing changes it further)
```

A `Record`'s `outreachStage` field (independent of `status`, but `status` becomes `done` exactly when `outreachStage` reaches `finished`):

```text
initial
   ↓ (advance, non-final)
followup1
   ↓ (advance, non-final)
followup2
   ↓ (advance, final — also sets status=done)
finished
```

For each state:

| State | Meaning | Reached By | User Can | System Does Next |
|---|---|---|---|---|
| `pending` | Never worked, or claim released without completing | CSV import; skip/next/release actions on a `skipped` record don't reach here, only on a `pending` one | Claim it | Nothing until claimed |
| `skipped` | Explicitly skipped at least once | The `skip` action | Claim it (once no `pending` records remain) | Nothing until claimed |
| `done` | Fully worked | `done`/final-stage `advance` | Nothing — read-only forever | Counts toward Statistics/CSV export |
| `initial`/`followup1`/`followup2` | Which outreach touch is next | CSV import (`initial`) / non-final `advance` | Work that stage's messages | Schedule the next stage 3 days out, or finish |
| `finished` | Sequence fully completed | Final-stage `advance` | Nothing | Nothing further |

---

## 17. Error & Failure Workflows

| Situation | What Happens | User Experience | Recovery |
|---|---|---|---|
| Invalid form input (e.g. a password under 8 characters) | Route Handler's Zod validation rejects it before touching the database | The exact validation message is shown inline (e.g. "Password must be at least 8 characters.") | Fix the input and resubmit |
| Not signed in | `401` from any API route; a redirect to `/login` from any page | Bounced to the login screen | Sign in again |
| Signed in as the wrong role | `403` from admin API routes; a redirect to `/dashboard` from admin pages | Sent back to the dashboard, no error shown on pages (routes show a JSON error) | N/A — genuinely not permitted |
| Acting on a lead you no longer hold | `409 Conflict` ("This record is no longer assigned to you") | A toast: "Couldn't save — try again" | The screen re-syncs on the next action; nothing is lost |
| Too many failed logins | `429` after 8 attempts per account or 20 per IP within 15 minutes | "Too many login attempts. Try again in a few minutes." | Wait, or have an admin reset the password if genuinely forgotten |
| A CSV with no recognizable Name/Phone column | Import rejected before any row is processed | "Couldn't find a ... column in this CSV. Columns found: ..." | Rename the header row appropriately and re-upload |
| Google Drive not connected/configured | `400`, or a redirect back to `/admin/drive` with an explanation | An inline banner explaining exactly what's missing | Complete the OAuth setup / connect the account |
| Unexpected server error | Caught by a Next.js `error.tsx` boundary | A generic "Something went wrong" card with a "Try again" button | Click Try again; if it persists, check server logs (there's no automatic error reporting — see [§19](#19-security--explained-simply)) |

---

## 18. External Integrations

### Google Drive

**What is it?** A Google service for storing and sharing files.

**Why is it needed?** So an admin can drop new CSVs into a shared Drive folder and have them picked up automatically, without a manual upload step every time.

**What information is exchanged?** Rowdesk only ever *reads* — it lists file names/modified-times in one configured folder (and subfolders), and downloads the content of `.csv` files it decides to import. It also reads the connected account's email address (to show "connected as ..."). It never writes to, deletes from, or modifies anything in Drive.

**When is it called?** Only when an admin clicks "Scan Drive" or "Process New & Updated" on `/admin/drive` — there is no automatic background polling.

**What happens if it fails?** Per-file errors are captured and shown in the file's status ("error", with the reason); a total connection failure (e.g. revoked access) surfaces a clear message asking the admin to reconnect.

**Where is it implemented?** `src/lib/googleDrive.ts`, `src/app/api/admin/drive/*`.

```text
ROWDESK  (admin clicks Scan/Process)
     │
     ▼
GOOGLE DRIVE API   (list files / download file content)
     │
     ▼
RESPONSE  (file list, or CSV text)
     │
     ▼
ROWDESK  (classifies files, or runs the CSV through the same cleaning pipeline as manual upload)
```

No other external service is integrated — there is no email provider, no SMS/WhatsApp API (sending is manual, by design), no payment provider, no analytics/error-tracking service.

---

## 19. Security — Explained Simply

**Authentication answers: "Who are you?"** — you prove it with a username/email + password. Rowdesk checks the password against a securely-hashed copy (never the real password itself, which is never stored anywhere) and, if correct, gives your browser a secure cookie that says "you're signed in as this person" for up to 30 days.

**Authorization answers: "What are you allowed to do?"** — once Rowdesk knows who you are, it checks your role. `DATA_PROCESSOR` gets the queue and their own stats; `ADMIN` gets everything. This check happens twice, independently — once on the page itself (so you literally can't navigate to an admin page without the right role) and again inside every single admin API action (so even a crafted direct request is rejected).

**What's actually implemented**:
- Passwords: bcrypt-hashed, never stored or logged in plain text.
- Sessions: a random, unguessable session ID in an `httpOnly` cookie (JavaScript on the page can't read it, limiting theft via a compromised script) that only travels to Rowdesk's own domain.
- Cross-site request forgery protection: every action that changes data double-checks the request actually came from Rowdesk's own site, not another website tricking your browser into submitting a form.
- Input validation: every form submission is checked against strict rules on the server before anything is saved — you can't bypass client-side validation by crafting your own request.
- Secrets at rest: the Google Drive connection's access tokens are encrypted before being stored in the database — even someone with raw database access can't read them without the separate encryption key.
- Brute-force protection: repeated failed logins get temporarily blocked, both per account and per network address.
- Message safety: outreach message text (both admin-written templates and lead data pulled into them) is safely escaped before being shown, so neither an admin's typo nor a scraped business name can accidentally inject working HTML into the page.

**Recommended Improvements** (not implemented today — see [§27](#27-known-issues) for the full list): the login rate limiter only works correctly on a single running instance; there's no multi-factor authentication; there's no self-service password recovery if the sole admin gets locked out.

---

## 20. Codebase Map for New Developers

| I Want To Change... | Start Here | Related Files | Related API | Related Data |
|---|---|---|---|---|
| The dashboard queue screen's look/feel | `src/components/RowdeskScreen.tsx` + `RowdeskScreen.module.css` | `src/app/dashboard/page.tsx` | `/api/queue/*`, `/api/records/[id]` | `Record` |
| Which columns a CSV needs, or the phone-cleaning rule | `src/lib/csv.ts` | `src/lib/csv.test.ts` | `/api/import` | `Record`, `SourceFile` |
| How long a claim can sit idle before releasing | `src/lib/settings.ts` + `src/app/admin/settings/SettingsForm.tsx` | `src/lib/queue.ts`'s `releaseStaleClaims()` | `/api/admin/settings` | `SystemSetting` |
| The wait time between outreach stages (currently 3 days, fixed) | `src/lib/queue.ts` (`STAGE_WAIT_DAYS` constant) | `queue.test.ts` | `/api/queue/action` | `Record.stageDueAt` |
| Outreach message wording | Don't touch code — use `/admin/templates` in the running app | — | `/api/admin/templates`, `/api/admin/dictionaries` | `Template`, `TemplateDictionary` |
| Who can do what (roles) | `src/lib/auth.ts` (`requireUser`/`requireAdmin`/`getApiUser`) | Every `page.tsx`/`route.ts` re-checks role individually | all `/api/admin/*` | `User.role` |
| Login/session behavior | `src/lib/auth.ts` | `src/app/api/auth/login/route.ts`, `src/app/login/page.tsx` | `/api/auth/login`, `/api/auth/logout` | `User`, `Session` |
| Google Drive scanning/import | `src/lib/googleDrive.ts` | `src/app/api/admin/drive/*`, `src/app/admin/drive/` | `/api/admin/drive/*` | `GoogleDriveConnection`, `DriveFile` |
| Add a new database field | `prisma/schema.prisma` | run `npx prisma migrate dev --name <x>` | wherever it's read/written | new migration under `prisma/migrations/` |
| Add a new page | `src/app/<route>/page.tsx` (new folder) | add a link in `src/components/AppHeader.tsx` if it needs nav | new route handler if it needs its own API | whatever it queries |
| Statistics calculations | `src/lib/stats.ts` (`dailyCounts`) + the page files themselves | `src/app/statistics/page.tsx`, `src/app/admin/statistics/page.tsx` | none — Server Components query Prisma directly | `Record`, `AuditLog`, `Session` |
| Colors/typography | `src/app/globals.css` (CSS custom properties) + `src/app/layout.tsx` (fonts) | — | — | — |

---

## 21. Where Should I Look?

### If the UI shows the wrong thing

```text
Page (src/app/**/page.tsx — usually a Server Component fetching data)
 ↓
Client component it renders (the "use client" file next to it)
 ↓
Styles (Tailwind classes inline, or globals.css custom properties)
 ↓
Client-side state (useState calls inside that component)
```

### If the data itself looks wrong

```text
UI (does it display what the API actually returned? check the Network tab)
 ↓
API route (src/app/api/**/route.ts — is it querying the right thing?)
 ↓
lib function it calls (src/lib/*.ts — is the business logic correct?)
 ↓
Database (npx prisma studio — is the stored data itself correct?)
```

### If login is broken

```text
Login UI (src/app/login/page.tsx)
 ↓
POST /api/auth/login (src/app/api/auth/login/route.ts)
 ↓
Rate limiter (src/lib/rateLimit.ts) — is it being wrongly triggered?
 ↓
Password check (src/lib/auth.ts — hashPassword/verifyPassword)
 ↓
Session creation (createSession()) — cookie set correctly?
 ↓
Every subsequent page's requireUser()/requireAdmin() (src/lib/auth.ts)
```

### If the queue is behaving unexpectedly (wrong lead handed out, stuck claim, etc.)

```text
src/lib/queue.ts — this is the single source of truth for all queue behavior
 ↓
Check: releaseStaleClaims() (is the timeout setting wrong?)
 ↓
Check: findCandidate() (is the ordering/priority logic doing what's expected?)
 ↓
Check: the specific action function (skipRecord/completeRecord/advanceStage/claimPreviousInFile)
 ↓
queue.test.ts already covers most edge cases — check whether a failing scenario is actually tested first
```

### If Google Drive isn't picking up files

```text
/admin/drive UI — does it show "Connected"? A folder name?
 ↓
Check GOOGLE_* and GOOGLE_DRIVE_FOLDER_ID env vars are set correctly
 ↓
src/lib/googleDrive.ts — listCsvFilesInFolder() (is the folder ID right? does the connected account have access?)
 ↓
DriveFile table (npx prisma studio) — what status is each file actually in, and is there an errorMessage?
```

---

## 22. Change Impact Map

| Feature | Components Affected | APIs Affected | Data Affected | Tests Affected | Risk |
|---|---|---|---|---|---|
| Queue claim/state-machine logic | `RowdeskScreen`, `AppHeader` (indirectly via nav) | `/api/queue/*`, `/api/records/[id]` | `Record`, `AuditLog` | `queue.test.ts` (extensive) | **High** — this is the core mechanic every user touches every day |
| CSV cleaning rules | `AdminImportPage`, `CleaningSummary`, `DrivePanel` | `/api/import`, `/api/admin/drive/process` | `Record`, `SourceFile` | `csv.test.ts` | **Medium** — changing rules silently changes what data enters the system going forward; doesn't affect existing rows |
| Outreach stage timing/count | `RowdeskScreen`, `DictionariesPanel`, `admin/statistics` | `/api/queue/action` | `Record.outreachStage`/`stageDueAt`, `Template.stage` | `queue.test.ts` | **High** — changing stage count/timing affects every in-flight lead's schedule |
| Auth/session logic | Every page (via `requireUser`/`requireAdmin`) | Every API route (via `getApiUser`) | `User`, `Session` | `auth.test.ts` | **Critical** — a bug here can lock everyone out or, worse, let the wrong people in |
| Database schema (`prisma/schema.prisma`) | Anything querying the changed model | Anything querying the changed model | The migration itself | Whatever tests touch that model | **High** — requires a reviewed migration; a bad migration is hard to reverse cleanly against production data |
| Google Drive integration | `DrivePanel` only | `/api/admin/drive/*` | `GoogleDriveConnection`, `DriveFile` | `googleDrive.test.ts` | **Low** — isolated, optional feature; breaking it doesn't affect manual import or the queue |
| Styling / design tokens | Every page (shared `globals.css`) | none | none | none (no visual regression tests) | **Low** risk of breakage, but **wide** blast radius — a token change is visible everywhere |

---

## 23. Safe Development Guide

**Safe to modify** — relatively isolated, low blast radius:
- Styling/CSS within a single component's module file.
- Admin-only UI copy/labels.
- Adding a new field to a Statistics page (read-only, additive).
- Template/message content (this is meant to be edited constantly — it's admin UI, not code, for exactly this reason).

**Modify carefully** — has real dependents:
- `src/lib/csv.ts` — the phone-normalization and column-detection rules are precisely tuned (see the exhaustive test file) and affect every future import; a change here doesn't touch existing data but does change what gets accepted going forward.
- `src/lib/queue.ts` — every function here is exercised by multiple other parts of the UI; the test file is your safety net, run it before and after any change.
- `src/lib/schemas.ts` — a stricter Zod schema can silently reject requests the frontend still sends if the two aren't updated together.

**High-risk areas** — changes here can affect authentication, core business logic, or production data:
- `src/lib/auth.ts` — session/role logic. A mistake can lock out the whole team or (far worse) grant access it shouldn't.
- `prisma/schema.prisma` — every migration is permanent once applied to production; there's no "undo," only a new forward migration. Always review the generated SQL before running `migrate dev` against real data.
- `src/lib/googleDrive.ts`'s token handling / `src/lib/encryption.ts` — a mistake here can corrupt or expose the stored Drive credentials.
- Anything inside a Route Handler's same-origin/auth/role checks — removing or weakening one of these checks (even briefly, for debugging) directly creates a security hole if shipped.

---

## 24. Common Developer Tasks

### Add a New Page

```text
1. Create src/app/<route>/page.tsx (Server Component — can query Prisma directly)
2. If it needs interactivity, add a co-located "use client" component and import it
3. Add a link in src/components/AppHeader.tsx's PROCESSOR_NAV or ADMIN_NAV
4. If admin-only, put it under src/app/admin/ — the layout there already enforces requireAdmin()
5. Add export const dynamic = "force-dynamic" if the page must always show live data (matches every existing page's pattern)
6. Add an error.tsx / loading.tsx alongside it if it's a top-level section (optional, but matches existing conventions)
```

### Modify the Queue's Behavior

```text
1. Find the relevant function in src/lib/queue.ts (all queue logic lives in this one file)
2. Trace who calls it — src/app/api/queue/action/route.ts and/or a page's server-side load
3. Check existing tests in queue.test.ts for the behavior you're about to change
4. Make the change
5. Update/add tests — this file is the project's most heavily tested area for a reason
6. Manually verify in the browser: claim a lead, run through skip/done/advance/previous
```

### Add a New Admin API Route

```text
1. Create src/app/api/admin/<name>/route.ts
2. Copy the standard guard pattern from any existing admin route:
   isSameOrigin() check → getApiUser() → role !== "ADMIN" check → parseJsonBody() against a new/existing Zod schema
3. Implement the logic, calling into src/lib/*.ts rather than embedding business logic directly in the route
4. Call logAudit() if the action is meaningful enough to belong in the audit trail (check src/lib/audit.ts's AuditAction list — add a new action name there if needed)
5. Return NextResponse.json(...) with an appropriate status code
```

---

## 25. Testing From the Product Perspective

| Scenario | User Action | Expected Result | Failure Case |
|---|---|---|---|
| Happy path — full outreach cycle | Claim → copy both messages → Done and Next Name, three times | Lead ends at `status=done` after the third "Done"; each intermediate step schedules a 3-day wait | Covered directly in `queue.test.ts` |
| Invalid CSV | Upload a CSV with no name/phone-like column | Import rejected with a specific error naming the missing column | Covered in `csv.test.ts` (column detection) |
| Permission failure | A Data Processor tries to open `/admin/users` directly | Redirected to `/dashboard`; no admin data ever reaches the browser | Enforced by `admin/layout.tsx`'s `requireAdmin()` — not currently covered by an automated UI test (see [§28](#28-knowledge-gaps)) |
| Empty state | Every lead is already claimed or done | `/dashboard` shows "All done" instead of a broken/blank screen | Manually verified; not automated |
| Concurrent claim (race condition) | Two users hit "claim next" at effectively the same instant | Exactly one of them gets the lead; the other gets the next available one | Explicitly covered in `queue.test.ts` |
| Ownership conflict | User A has a lead claimed; it gets stale-released; User A then tries to act on it | `409` error, clear toast, no data corruption | Covered in `queue.test.ts` |
| Network failure mid-action | Any fetch() from the dashboard fails | A toast explains the failure; the on-screen lead is left untouched (nothing is optimistically lost) | Manually verified; not automated |

Run the automated suite with `npm test`. Two files (`auth.test.ts`, `queue.test.ts`) require `TEST_DATABASE_URL` pointed at a disposable Postgres database — see [`docs/PROJECT_DOCUMENTATION.md` §14](PROJECT_DOCUMENTATION.md#14-testing) for the exact setup. **Not implemented**: no browser-driven end-to-end tests, no automated UI-level permission tests, no visual regression tests.

---

## 26. Deployment, Explained Simply

**How does this project go from code on a developer's computer to something the team actually uses?**

```text
Developer
 ↓  writes code, commits, pushes to Git
Source Code  (GitHub/GitLab/etc., wherever the repo is hosted)
 ↓  Vercel detects the push
Build  (Vercel runs: generate the database client → apply any new database migrations → build the Next.js app)
 ↓
Deployment  (Vercel publishes the new build)
 ↓
Server / Cloud  (Vercel's serverless functions, one shared Postgres database on Neon)
 ↓
Users  (the team, at crm-fx2.vercel.app)
```

**In plain terms**: there is no separate manual deployment step and no staging environment — pushing to the repository (or running `vercel --prod`) *is* the deploy. Database schema changes travel with the code itself (as migration files) and are applied automatically as part of the same build, so the database and the code version are always in sync. There is no automated test/lint gate before this happens — a human is expected to have run `npm test`/`npm run lint`/`npm run build` locally first.

**Technical deployment architecture** and the exact build command live in [`docs/PROJECT_DOCUMENTATION.md` §16](PROJECT_DOCUMENTATION.md#16-deployment).

---

## 27. Known Issues

| Issue | In Plain Language | Where | Impact |
|---|---|---|---|
| Rate limiting doesn't scale across multiple servers | The "too many login attempts" counter lives in one server's memory — if Vercel ever runs more than one instance of the app at once, an attacker could spread attempts across instances and the limit wouldn't catch it | `src/lib/rateLimit.ts` | Currently low impact (single-instance scale), but a real gap if traffic grows |
| No duplicate-import detection | Uploading the same CSV twice creates a second full set of leads, with no warning | `src/lib/csvImport.ts` | An admin mistake creates duplicate work in the queue |
| `timezone` setting isn't actually used | Admin → Settings lets you set a timezone, but nothing in the statistics date-bucketing code currently reads it | `src/lib/settings.ts`, `src/lib/stats.ts` | The setting is misleading — it implies a behavior it doesn't have |
| Audit log grows forever | Every login, claim, done, skip, etc. is logged permanently with no cleanup | `AuditLog` table | Not a bug today, but will eventually need a retention policy as volume grows |
| No error-tracking/monitoring service | If something breaks in production, the only visibility is Vercel's raw function logs | (repo-wide) | Slower to notice/diagnose a production issue than with a service like Sentry |
| No automated end-to-end tests | The queue and import flows are tested at the logic level, not by actually driving a browser | (repo-wide) | A UI-layer regression (e.g. a button silently stops working) could ship undetected by the test suite |

---

## 28. Knowledge Gaps

| Missing Knowledge | Why It Matters | Evidence | Recommended Action |
|---|---|---|---|
| Whether "Skip" is meant to still be reachable from the dashboard UI | The queue's `skip` action exists and is fully implemented/tested in `src/lib/queue.ts` and exposed at the API level (`action: "skip"`), but `RowdeskScreen.tsx`'s visible buttons are only Previous / Done and Next Name / Next — "Next" releases the claim without marking it skipped, which is a different outcome. It's unclear whether "Skip" was intentionally folded into "Next," or is a UI gap left over from the action-bar simplification in commit `ded0ead` ("Simplify queue action bar to Previous / Done / Next only"). | `src/components/RowdeskScreen.tsx` has no button calling `action: "skip"`; `src/lib/queue.ts`'s `skipRecord()` and the `/api/queue/action` route both still fully support it | Confirm with whoever made that simplification decision whether "skip" (distinct from "next") should still be reachable from the UI, or whether the `skipRecord`/`"skipped"` status path is now effectively dead code from the dashboard's perspective |
| Exact backup/point-in-time-recovery configuration on the production Neon database | Affects real disaster-recovery capability, but is a dashboard setting outside this codebase | Confirmed integration exists (Vercel Marketplace); retention window not inspectable from the repo | Check directly in the Neon/Vercel dashboard, document the actual retention window |
| Whether Google Drive folder access is scoped per-file or per-folder-tree on the Google side | Affects who besides the connected admin account can drop files that get auto-imported | Not verifiable from code — depends on Drive sharing settings outside this repo | Verify directly in Google Drive's sharing settings for the configured folder |

---

## 29. 30-Minute New-Developer Onboarding

Read in this order — each step should leave you able to explain the next section's "why" before you get there.

```text
1. §2 Product in One Minute        — what this thing is and why it exists (2 min)
        ↓
2. §4 Who Uses the System          — the two roles and what each can do (3 min)
        ↓
3. §5 Product Map                  — every screen, at a glance (2 min)
        ↓
4. §8 End-to-End Workflows         — the three most important flows, step by step (8 min)
        ↓
5. §13 Architecture                — how the pieces actually fit together (5 min)
        ↓
6. §20 Codebase Map                — where to go for a given kind of change (3 min)
        ↓
7. §15 of PROJECT_DOCUMENTATION.md — developer setup: get it running locally (5 min reading + setup time)
        ↓
8. §24 Common Developer Tasks      — a few concrete "how do I..." recipes (2 min)
        ↓
9. §27 Known Issues                — what's already known to be imperfect, so you don't "rediscover" it (2 min)
        ↓
10. §31 Glossary                   — reference as needed while reading code
```

After this, you should be able to: explain what Rowdesk does to a non-technical person in one sentence, name both roles and what each can/can't do, trace what happens end-to-end when a Data Processor clicks "Done and Next Name," find the one file that owns queue logic, and get the app running locally.

---

## 30. FAQ for New Developers

**"Where does the application start?"** — `src/app/page.tsx`, which does nothing but redirect to `/dashboard` or `/login`. The real entry point most users experience is `src/app/dashboard/page.tsx`.

**"Where is the homepage?"** — There isn't a marketing/public homepage; `/` is purely a redirect. The closest thing to a "home" is `/dashboard`.

**"Where is authentication implemented?"** — `src/lib/auth.ts` (all of it — hashing, sessions, the three guard functions), wired into `src/app/api/auth/login/route.ts` and `src/app/api/auth/logout/route.ts`.

**"Where is the database configuration?"** — `prisma/schema.prisma` (the schema itself) and `src/lib/prisma.ts` (the client singleton). The connection string comes entirely from the `DATABASE_URL` environment variable — there's no other config file.

**"Where does the outreach-sequence feature begin?"** — `src/lib/queue.ts`'s `advanceStage()` function is the heart of it; the UI side is `src/components/RowdeskScreen.tsx`'s "Done and Next Name" button.

**"Which API handles CSV import?"** — `POST /api/import` for manual upload; `POST /api/admin/drive/process` for Drive-sourced files. Both funnel through the same `importCsvText()` in `src/lib/csvImport.ts`.

**"Where is the phone-cleaning rule implemented?"** — `normalizePhone()` in `src/lib/csv.ts`, with every edge case covered in `src/lib/csv.test.ts`.

**"How do I run the project?"** — See [`docs/PROJECT_DOCUMENTATION.md` §15](PROJECT_DOCUMENTATION.md#15-developer-setup) or the root `README.md`'s "Local development" section — in short: `npm install`, `vercel env pull .env.local`, `npx prisma generate`, `npm run dev`.

**"How do I test a queue-logic change?"** — Point `TEST_DATABASE_URL` at a disposable Postgres database (never production — these tests delete rows) and run `npm test`; `queue.test.ts` is the relevant file.

**"What should I avoid changing casually?"** — `src/lib/auth.ts` and `prisma/schema.prisma` — see [§23 Safe Development Guide](#23-safe-development-guide) for the full reasoning.

---

## 31. Glossary

| Term | Simple Meaning | Project-Specific Meaning | Appears In |
|---|---|---|---|
| **API** | A way for the browser to ask the server to do something | Route Handlers under `src/app/api/**` | Throughout |
| **Frontend** | The part of the app that runs in the browser | React Client Components (`"use client"` files) | `RowdeskScreen.tsx` and similar |
| **Backend** | The part of the app that runs on the server | Server Components + Route Handlers + `src/lib/*.ts` | Throughout |
| **Database** | Where the app's information is permanently stored | One PostgreSQL database, hosted on Neon | `prisma/schema.prisma` |
| **Endpoint** | One specific URL the app responds to | A Route Handler, e.g. `POST /api/queue/action` | `src/app/api/**/route.ts` |
| **Component** | A reusable piece of UI | A React function returning JSX | `src/components/*.tsx` |
| **Service / lib module** | A chunk of logic focused on one job | Files under `src/lib/` | `queue.ts`, `csv.ts`, etc. |
| **Authentication** | Proving who you are | Username/email + password → session cookie | `src/lib/auth.ts` |
| **Authorization** | Being allowed to do a specific thing | Role check (`ADMIN` vs `DATA_PROCESSOR`) | Every admin-only page/route |
| **Session** | "You're currently signed in" | A `Session` database row + a cookie referencing it | `src/lib/auth.ts` |
| **Migration** | A recorded, applyable database change | Files under `prisma/migrations/` | Applied via `prisma migrate deploy`/`dev` |
| **Deployment** | Publishing a new version for real use | A `git push` triggering a Vercel build | `vercel.json` |
| **Claim** | Temporarily "owning" one lead | `Record.claimedById`/`claimedAt` | `src/lib/queue.ts` |
| **Outreach stage** | Where a lead is in its 3-touch sequence | `initial`/`followup1`/`followup2`/`finished` | `Record.outreachStage` |
| **Template Dictionary** | A swappable set of message wording | `TemplateDictionary`/`Template` tables | `/admin/templates` |
| **Audit log** | A permanent record of who did what | `AuditLog` table | `/admin/audit` |

---

## 32. Documentation Confidence

**HIGH** confidence (directly verified by reading the exact source file): every claim about routes, database fields, business rules, API behavior, the queue state machine, CSV cleaning logic, and test coverage in this document.

**MEDIUM** confidence: the exact production Neon backup/retention configuration (the *integration* is confirmed, the specific settings are outside the repo — see [§28](#28-knowledge-gaps)); whether the "Skip" action's UI absence on the dashboard is intentional or a gap (also [§28](#28-knowledge-gaps)).

**LOW** confidence: none — everything else in this document was directly verifiable in code.

---

## 33. Final System Summary

```text
USER  (Data Processor or Admin)
 ↓
PRODUCT  (Rowdesk — a shared lead-cleaning-and-outreach tool)
 ↓
FEATURES  (locked queue, CSV cleaning, 3-stage bilingual outreach, template library, user/stat/audit admin tools)
 ↓
WORKFLOWS  (claim → message → advance, repeated three times per lead; import → clean → queue)
 ↓
FRONTEND  (Next.js Server + Client Components, one combined app)
 ↓
BACKEND  (Next.js Route Handlers + src/lib business logic modules)
 ↓
BUSINESS LOGIC  (queue state machine, phone/CSV cleaning rules, outreach timing, role checks)
 ↓
DATA  (Records, Source Files, Templates, Users, Sessions, Audit Log — one Postgres database)
 ↓
EXTERNAL SERVICES  (Google Drive — optional, read-only, admin-triggered only)
 ↓
INFRASTRUCTURE  (Vercel serverless hosting + Neon Postgres, single environment for dev and production)
```

**What is this product?** A shared tool for cleaning scraped business-lead data and running a timed, bilingual, three-touch outreach sequence against it, as a team.

**Who uses it?** Data Processors (work the queue) and Admins (feed it data, manage the team and message library, watch the numbers).

**What can they do?** See [§4](#4-who-uses-the-system) and [§6](#6-feature-catalog).

**How does each major feature work?** See the deep-dives in [§6](#6-feature-catalog) and the step-by-step flows in [§8](#8-end-to-end-workflows).

**What happens when a user performs an action?** See [§9](#9-what-happens-when-you-click-something).

**Where does the data go?** Into one shared Postgres database — see [§11](#11-data-explained-for-humans) and [§12](#12-data-lifecycle).

**How do the different parts communicate?** Browser → Route Handlers/Server Components → `src/lib` business logic → Prisma → Postgres, with an optional side channel to Google Drive — see [§13](#13-architecture--two-levels) and [§15](#15-request-lifecycle).

**Where is each feature implemented?** See [§20](#20-codebase-map-for-new-developers).

**What happens when something fails?** See [§17](#17-error--failure-workflows).

**How can I modify the project safely?** See [§23](#23-safe-development-guide).

**How can I add a new feature?** See [§24](#24-common-developer-tasks).

**How do I run, test, and deploy it?** See [§29](#29-30-minute-new-developer-onboarding) for the reading path, and [`docs/PROJECT_DOCUMENTATION.md`](PROJECT_DOCUMENTATION.md) §§15–16 for the exact commands.

---

*This handbook reflects the codebase at commit `bd3c535`, branch `master`. Every claim was verified against the actual source file in question; anything not fully verifiable is explicitly flagged in [§28](#28-knowledge-gaps) and [§32](#32-documentation-confidence) rather than assumed.*
