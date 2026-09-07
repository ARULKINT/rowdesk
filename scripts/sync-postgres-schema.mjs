// Regenerates prisma/postgres/schema.prisma from prisma/schema.prisma,
// swapping only the datasource block (sqlite -> postgresql) so the two
// schemas can never drift on models/fields. Run after any change to
// prisma/schema.prisma that you want reflected in the production schema:
//
//   node scripts/sync-postgres-schema.mjs
//
// Then regenerate the production migration history the normal Prisma way,
// pointed at a real Postgres URL:
//
//   npx prisma migrate dev --schema prisma/postgres/schema.prisma --name <change>

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(root, "prisma", "schema.prisma");
const targetPath = path.join(root, "prisma", "postgres", "schema.prisma");

const source = readFileSync(sourcePath, "utf8");

const sqliteDatasource = /datasource db \{[^}]*\}/s;
if (!sqliteDatasource.test(source)) {
  throw new Error("Couldn't find a datasource block in prisma/schema.prisma to replace.");
}

const postgresDatasource = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`;

const header = `// GENERATED FILE — do not edit directly.
// Regenerate with: node scripts/sync-postgres-schema.mjs
// (mirrors prisma/schema.prisma with the datasource swapped to postgresql
// for the Vercel/production build — see README.md > Database)

`;

const output = header + source.replace(sqliteDatasource, postgresDatasource);
writeFileSync(targetPath, output);
console.log(`Wrote ${path.relative(root, targetPath)}`);
