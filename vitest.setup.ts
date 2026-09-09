import { execSync } from "node:child_process";

// There is no local database — the app always talks to Postgres. But the
// tests in auth.test.ts and queue.test.ts freely call deleteMany() on Users,
// Sessions and Records to reset state between cases, so they must NEVER run
// against the real (production) database. They only run when TEST_DATABASE_URL
// points at a disposable Postgres database (e.g. a separate Neon branch) —
// otherwise those test files skip themselves via VITEST_DB_AVAILABLE below,
// and the rest of the suite (which doesn't touch the database) still runs.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
  process.env.VITEST_DB_AVAILABLE = "1";
} else {
  console.warn(
    "\nTEST_DATABASE_URL is not set — skipping database-backed tests " +
      "(auth.test.ts, queue.test.ts) rather than risk running them against " +
      "production. Point TEST_DATABASE_URL at a disposable Postgres database " +
      "(e.g. a separate Neon branch) to run the full suite.\n"
  );
}
