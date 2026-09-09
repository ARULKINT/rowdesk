import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// There is no local database anymore — every environment (dev, CI, prisma
// CLI commands) talks to the same Postgres database. .env.local (pulled via
// `vercel env pull`) holds the real DATABASE_URL and takes precedence over
// .env, matching Next.js's own env-loading order — so `next dev` and plain
// `prisma` CLI commands always resolve to the same database.
config();
config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
});
