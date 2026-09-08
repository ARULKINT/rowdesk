# 21 — Administrator Manual

This guide is written for an **Admin** — the role responsible for configuration, data ingestion, team management, and oversight.

## 1. User Management (`/admin/users`)

| Task | How |
|---|---|
| Create a user | Click **+ Create user**, fill Full name, Username, Email (optional), a temporary password (≥ 8 characters), and Role, then **Create**. |
| Change a user's role | Use the Role dropdown directly in their row. |
| Disable / enable a user | Click **Disable**/**Enable** in their row — a disabled user cannot log in even with a valid, unexpired session. |
| Reset a password | Click **Reset password**, enter a new one, click **Set**. This immediately signs the user out everywhere (all their sessions are deleted). |
| See a user's activity | Click **Activity** to jump to the Audit Log pre-filtered to that user. |

**Guardrail**: you cannot disable or demote the last remaining active admin — the system will refuse with an error, to prevent the app from becoming unmanageable.

## 2. Google Drive Setup (`/admin/drive`)

**One-time setup (requires environment configuration, not just clicking around the UI)**:
1. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_DRIVE_FOLDER_ID`, and `ENCRYPTION_KEY` in your deployment's environment variables (see [18-deployment.md](18-deployment.md) and [.env.example](../.env.example)).
2. Redeploy so the new environment variables take effect.
3. Visit `/admin/drive`, click **Connect Google Drive**, sign in with the Google account that has access to the target folder, and approve the requested permissions.

**Ongoing use**:
- Click **Scan Drive** to check the configured folder (and every subfolder) for new or changed CSV files.
- Click **Process New & Updated** to actually import everything the scan flagged.
- The file table shows every CSV ever seen, its status (New / Updated / Unchanged / Processing / Processed / Error), and how many records it produced.

**Note**: the source folder itself is **not** changeable from this page — it's fixed by the `GOOGLE_DRIVE_FOLDER_ID` environment variable on purpose, so it can't be accidentally repointed by a UI click. To scan a different folder, change the environment variable and redeploy.

**Disconnect**: click **Disconnect** to remove the stored connection entirely (you'll need to reconnect, including re-granting consent, to resume Drive imports).

## 3. Manual CSV Import (`/admin/import`)

Use this when you have a CSV file that isn't (or can't be) in the Google Drive folder. Expected columns: name, phone, rating, maps_url, website_url — differently-named columns are detected automatically. Rows missing Name or Phone are silently dropped; you'll see exactly how many in the cleaning summary after upload.

## 4. Template Dictionary Management (`/admin/templates`)

A **dictionary** is a named set of outreach message templates; only one dictionary is **active** at a time, and the active dictionary's templates are what every user sees in their Dashboard composer.

| Task | How |
|---|---|
| Create a dictionary | **+ Create dictionary**, name it, optionally check "Seed with 3 starter templates". |
| Make a dictionary active | Click **Set active** on its card (the previously-active one is automatically deactivated). |
| Add a template | Type the message in the dictionary's textarea, use `{name}` where the business name should go and/or `{domain}` where the website domain should go, click **+ Add template**. |
| Edit a template | Click **Edit**, change the text, **Save**. |
| Hide a template without deleting it | Click **Retire** (and **Restore** to bring it back). |
| Reorder templates | Use the **↑ / ↓** buttons — this controls the order users cycle through with the ◁/▷ arrows on the Dashboard. |

## 5. Processing Queue Overview (`/admin/queue`)

At-a-glance counts (Pending / Claimed / Completed / Skipped), a cleaning-summary rollup across every imported file, a per-file breakdown table, a "currently claimed" table (who has what, since when), and a "recently completed" table. Use **Export processed CSV** to download every completed lead (optionally filter by user/file/date via the query string on `/api/admin/export`).

## 6. Statistics (`/admin/statistics`)

Filter by date range (Today / Yesterday / 7 days / 30 days / Custom), user, and source file. Shows organization-wide totals, a daily completions bar chart, a per-user performance table (including whether each user is currently **Active** — a session created within the last 15 minutes), and data-quality counts.

## 7. Audit Log (`/admin/audit`)

Every consequential action in the system is recorded here: logins (success and failure), every record claim/skip/completion/release, every user/template/settings/Drive change. Filter by user, action type, or free-text search (matches against entity type, entity ID, or the JSON metadata). Paginated 50 rows at a time.

## 8. Settings (`/admin/settings`)

| Setting | Effect |
|---|---|
| **Claim timeout (minutes)** | How long a claimed-but-unresolved record can sit before it's automatically released back to the pool for someone else. Default 30 minutes; range 1–1440. |
| **Timezone** | Free-text label (default `Asia/Kolkata`) — informational; used consistently as the team's reference timezone but does not currently alter how dates are computed/displayed elsewhere in the app (all date math uses server-local `Date` objects). |

## 9. Data Management

There is no bulk-delete, archive, or purge tool anywhere in the admin panel — records, source files, and audit log entries accumulate permanently. See [23-maintenance.md](23-maintenance.md) for what this means operationally, and [24-known-issues.md](24-known-issues.md) for the specific gaps this creates.

## 10. Backups

The application does not implement its own backup mechanism. Rely on your Postgres host's automated backups / point-in-time recovery — Neon (the host used in this deployment) offers this by default. See [18-deployment.md](18-deployment.md) for provisioning details.

## 11. Troubleshooting (Admin-Specific)

| Symptom | Cause | Fix |
|---|---|---|
| "Google Drive isn't configured" banner | Missing env vars | Set `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI`, redeploy |
| "No source folder configured" banner | Missing `GOOGLE_DRIVE_FOLDER_ID` | Set it, redeploy |
| Drive connect fails with a scope/permission error after reconnecting | Google didn't return a refresh token because access was already granted from a prior connection | Revoke Rowdesk's access at `myaccount.google.com/permissions`, then reconnect |
| A Drive file shows `error` status | The CSV was malformed, or missing required columns | Hover the status badge for the specific error message; fix the source file and rescan |
| A user reports they "lost" a lead they were working | Most likely explanation: the claim timeout expired (they left it idle too long) and someone else — or they themselves — reclaimed it, or they used Skip/Next | Check the Audit Log filtered to that user/record for the exact sequence of events |
