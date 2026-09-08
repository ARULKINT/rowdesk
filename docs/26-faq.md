# 26 — Frequently Asked Questions

## For Data Processors

**Q: Can two people work on the same lead at once?**
No. The moment you're given a lead, it's locked to you until you Skip, mark it Done, or move on with Next/Previous (or your claim times out from inactivity). See [11-business-logic.md](11-business-logic.md).

**Q: I skipped a lead by accident — is it lost?**
No. Skipping just returns it to the shared pool; it can be claimed again (by you or anyone) later.

**Q: What's the difference between Skip and Next?**
**Skip** marks the lead as `skipped` (a status you and everyone else can see and that's tracked in Statistics). **Next** just moves you on without marking anything — the lead's status doesn't change.

**Q: What does Previous actually do?**
It takes you back to the row right before the one you're on, in the same file — even if someone else has since started working it. Use it to quickly fix something you just did wrong, not as a general way to browse.

**Q: Why can't I click Previous?**
You're on the very first row of the current file — there's nothing before it.

**Q: The outreach message has the wrong business name in it — is that a bug?**
The name comes directly from the imported CSV data. If it's wrong, the source data was wrong; report it to an admin so the source file can be corrected.

**Q: I forgot my password — what do I do?**
There's no self-service reset. Ask an admin to reset it for you from Admin → Users.

## For Admins

**Q: Why can't I edit the Google Drive source folder from the UI?**
It's deliberately fixed via an environment variable (`GOOGLE_DRIVE_FOLDER_ID`), not admin-editable in the app itself, to prevent accidentally repointing production imports at the wrong folder with a stray click. Change the environment variable and redeploy to point at a different folder.

**Q: I re-uploaded a CSV I already imported — what happens?**
It gets imported again as a brand-new, fully duplicate set of records — there's currently no duplicate-detection guard. Avoid re-uploading the same file; see [24-known-issues.md](24-known-issues.md).

**Q: Can I delete a lead or a whole imported file?**
No. There is no delete path anywhere in the admin panel for records, source files, or audit log entries — by design, everything is permanent history. If truly necessary, direct database access is the only option, and isn't recommended for routine use.

**Q: How do I stop the last admin account from being locked out?**
You can't accidentally disable or demote the last active admin — the system blocks that specific action automatically.

**Q: Does changing the Timezone setting affect anything?**
Not currently — it's stored but not yet wired into any date calculation. See [24-known-issues.md](24-known-issues.md).

**Q: How do I get the first admin account on a brand-new deployment?**
There's no self-registration. The very first admin has to be created via a one-off script or direct database insert against the production database — see [18-deployment.md](18-deployment.md) §7. After that, every subsequent user (admin or otherwise) is created normally through Admin → Users.

## For Developers

**Q: Why are there two Prisma schema files?**
Because Prisma's datasource provider is a static string and migration SQL is provider-specific — SQLite (local dev/test) and PostgreSQL (production) can't share one migration history. See [18-deployment.md](18-deployment.md).

**Q: I changed the schema and now `npm run dev` throws weird undefined errors.**
Restart the dev server — Node doesn't hot-reload the generated Prisma Client. See [19-developer-setup.md](19-developer-setup.md).

**Q: Is there a staging environment?**
Not a persistent one. Vercel creates preview deployments (with their own Neon branch) for non-production branches, but none is used as an ongoing staging environment today.

**Q: Where do I add a new outreach-message placeholder token (beyond `{name}`/`{domain}`)?**
`src/lib/templates.ts` — extend the `ComposeValues` interface and the `FALLBACKS` map, then pass the new value through wherever `composeMessage`/`composeMessageHtml` is called (currently only `RowdeskScreen.tsx`).

## For Testers / QA

**Q: What database do tests run against?**
An isolated, freshly-migrated SQLite file (`prisma/test.db`), recreated on every run — never the local dev database. See [17-testing.md](17-testing.md).

**Q: Is there an end-to-end (browser) test suite?**
No — see [17-testing.md](17-testing.md) and [24-known-issues.md](24-known-issues.md) for what exists and what's recommended.

## For Stakeholders

**Q: What problem does this actually solve, in one sentence?**
It replaces a shared spreadsheet (which lets two people call the same lead and loses track of who did what) with a single-record locked work queue plus one-click outreach messaging.

**Q: Is this a CRM?**
No — it has no deal pipeline, quotes, invoicing, or multi-channel messaging automation. It's a purpose-built data-cleaning-and-outreach queue for one specific workflow.

**Q: Does it use AI?**
No. See [13-ai-ml.md](13-ai-ml.md) for an explicit confirmation.
