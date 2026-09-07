import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

// Tests run against an isolated SQLite file, never the dev database (which
// holds real imported data) — created fresh and migrated before each run.
const testDbPath = path.resolve(__dirname, "prisma/test.db");
if (existsSync(testDbPath)) unlinkSync(testDbPath);

process.env.DATABASE_URL = `file:${testDbPath}`;

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
});
