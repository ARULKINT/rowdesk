# 01 — Project Overview

## 1. Executive Summary

| | |
|---|---|
| **Project name** | Rowdesk |
| **Project type** | Full-stack web application (Next.js App Router, server-rendered + Route Handler API, single Postgres/SQLite database) |
| **Purpose** | Internal tool for cleaning scraped business-listing data (Google Maps exports) and running a manual outreach workflow against it |
| **Target users** | A small internal team: one or more **Admins** who manage data ingestion, users, and configuration, and one or more **Data Processors** who work the lead queue |
| **Primary technical objective** | Guarantee exactly one person works on a given lead at a time, keep a full audit trail, and remove hand-formatting work from outreach messaging |
| **Current implementation status** | Fully implemented and deployed to production (Vercel + Neon Postgres) |
| **Technology overview** | Next.js 16 (App Router) + TypeScript, Prisma ORM, SQLite (dev) / PostgreSQL (prod), Tailwind CSS, session-cookie auth, Google Drive API v3 (OAuth2) |

Rowdesk exists to solve one concrete operational problem: a business (in this deployment, **Forge & Flint**, a small digital-services outreach operation) periodically receives CSV exports of scraped Google Maps business listings ("mobile repair shop", "electronics", etc., per city/town) and needs a team of people to clean that data and manually contact each business. Doing this in a shared spreadsheet causes two people to call the same lead, loses track of who did what, and leaves outreach messages to be typed from scratch every time. Rowdesk replaces the spreadsheet with a single-record, locked work queue plus a templated message composer.

## 2. Project Overview

### What the software does

1. **Ingests** business-listing CSVs, either uploaded manually by an admin or pulled automatically from a fixed Google Drive folder (and all of its subfolders).
2. **Cleans** each CSV on import: rows missing a Name or Phone are dropped (both are required to make a call); rows missing Rating, Google Maps URL, or Website are kept but tracked as data-quality gaps.
3. **Serves a locked queue**: any signed-in user visiting the Dashboard is atomically handed the next available record — nobody else can be handed that same record while they hold it.
4. **Composes outreach messages** from a set of admin-managed templates, substituting the record's business name (`{name}`) or website domain (`{domain}`) automatically, with one-click copy to the clipboard.
5. **Tracks outcomes** — Done (permanently locked), Skipped (returned to the pool), or abandoned via Next/Previous (returned to the pool, status unchanged) — and reports on them through Statistics, the Processing Queue view, and a full Audit Log.

### Why it exists

Manually distributing rows of a spreadsheet across a team does not prevent duplicate work, does not survive someone closing their laptop mid-row, and provides no record of who did what or when. Rowdesk's queue-claim model and audit log solve exactly that, while its outreach-template system removes the repetitive typing that a spreadsheet-based workflow would otherwise require of every team member.

### Who uses it

- **Admins**: configure everything (users, Google Drive connection, outreach templates, claim-timeout settings), import data, and review team performance and history.
- **Data Processors**: sign in, work through the queue one record at a time, verify/call/message each lead, and mark it done or skip it.

### Primary workflows

1. Admin imports a CSV (manually or via Google Drive) → records enter the shared queue.
2. A user visits the Dashboard → claims the next record → calls the number, opens the Google Maps listing to verify it, copies an outreach message, and marks the record Done, Skipped, or moves on via Next/Previous.
3. Admin reviews progress in Statistics / Processing Queue, exports completed leads as CSV, and manages templates and users as needed.

### Scope

In scope: CSV/Google-Drive ingestion, data cleaning, a single shared locked queue, templated outreach message composition, role-based admin tooling, statistics, and a full audit trail.

### Out-of-scope functionality

- Sending messages automatically (WhatsApp/SMS/email) — the app only *composes and copies* a message; the user sends it themselves through whatever channel they use.
- Any AI/ML component — none exists in this codebase.
- Multi-tenant/organization support — this is a single-organization internal tool; there is one shared queue, not per-team or per-client partitioning.
- Payment, billing, or CRM-pipeline features (deal stages, quotes, invoices).

### Assumptions

- A small team (in practice, a handful of users) works the queue concurrently — the locking mechanism is not built or tested for high-concurrency (hundreds of simultaneous claimants).
- The deployment runs as a single serverless instance set (Vercel) — see [15-error-handling.md](15-error-handling.md) and [22-performance-scalability.md](22-performance-scalability.md) for the specific consequences (in-memory rate limiting does not share state across instances).
- Leads are Indian phone numbers in practice (the phone-normalization logic assumes a leading trunk `0` or `91` country-code prefix per [12-data-processing.md](12-data-processing.md)).

### Constraints & limitations

- No "Previous"-across-files navigation, no bulk operations on records, no in-app messaging/dialing integration — see [24-known-issues.md](24-known-issues.md) for the complete list.

## 3. Goals & Objectives

| Goal | Type | Success criteria |
|---|---|---|
| No two people work the same lead simultaneously | Technical | Verified by an automated concurrency test — two simultaneous claims never return the same record ([17-testing.md](17-testing.md)) |
| Full accountability for every action taken on a record | Technical / Business | Every claim, skip, done, and admin action is written to `AuditLog` |
| Reduce outreach message composition time to zero manual typing | User | One-click "Copy message" with the business name pre-filled |
| Ingest new leads with no manual CSV handling | Business | Google Drive folder is scanned and new/changed files are imported automatically on admin request |
| Every imported record is callable | Technical | Rows without a Name or Phone are rejected at import time, never enter the queue |

## 4. Glossary Pointer

See [27-glossary.md](27-glossary.md) for definitions of domain terms used throughout this documentation set (Claim, Source File, Template Dictionary, etc.).
