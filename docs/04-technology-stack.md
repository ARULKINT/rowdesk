# 04 — Technology Stack

All versions below are read directly from `package.json` / `prisma/schema.prisma` / `vercel.json` — none are guessed.

## 1. Complete Technology Table

| Technology | Version | Category | Purpose | Used In |
|---|---|---|---|---|
| TypeScript | ^5 | Language | Static typing across the entire codebase | Everywhere |
| Next.js | 16.3.4 | Framework | App Router, Server Components, Route Handlers, build/deploy | Entire app |
| React | 19.2.8 | UI library | Component rendering | `src/app`, `src/components` |
| React DOM | 19.2.8 | UI library | DOM rendering target | Entire app |
| Prisma Client | ^6.19.3 | ORM | Type-safe database access | `src/lib/prisma.ts` and all `src/lib/*` |
| Prisma CLI | ^6.19.3 | Dev tool | Migrations, client generation | `prisma/`, build command |
| PostgreSQL | (Neon-hosted) | Database | The only database — local dev, tests (when `TEST_DATABASE_URL` is set), and production all use Postgres | `prisma/schema.prisma` |
| bcryptjs | ^3.0.3 | Security | Password hashing (cost 12) | `src/lib/auth.ts` |
| zod | ^4.5.4 | Validation | Request body schema validation | `src/lib/schemas.ts`, all mutating routes |
| papaparse | ^5.7.0 | Data parsing | CSV parsing | `src/lib/csvImport.ts` |
| googleapis | ^178.0.0 | External API SDK | Google Drive API v3 + OAuth2 client | `src/lib/googleDrive.ts` |
| server-only | ^0.0.1 | Build safety | Prevents server-only modules from being bundled client-side | Most of `src/lib` |
| Node.js `crypto` (built-in) | Node runtime | Security | AES-256-GCM encryption, random tokens | `src/lib/encryption.ts` |
| Tailwind CSS | ^4 | Styling | Utility classes for layout/spacing | Admin pages, forms |
| CSS Modules | (native Next.js support) | Styling | Scoped component styles for the Dashboard card | `RowdeskScreen.module.css` |
| CSS Custom Properties | — | Design tokens | Color system (light/dark) | `globals.css` |
| Google Fonts (`next/font/google`) | — | Typography | Libre Franklin (display), IBM Plex Sans (body), IBM Plex Mono (data) | `src/app/layout.tsx` |
| Vitest | ^5.0.0 | Testing | Unit/integration test runner | `**/*.test.ts` |
| ESLint | ^9 | Linting | Static code quality checks | `eslint.config.mjs` |
| tsx | ^4.23.13 | Dev tool | Run TypeScript scripts directly | — |
| dotenv | ^17.4.2 | Dev tool | Load `.env` then `.env.local` (override) for Prisma CLI commands | `prisma.config.ts` |
| Vercel | — | Hosting / CI-CD | Build, deploy, environment variables, aliasing | Production deployment |
| Vercel CLI | 58.9.2 (used interactively) | Dev tool | Deploy from the command line | Deployment workflow |
| Neon | — | Managed database | Serverless Postgres, provisioned via Vercel Marketplace integration | Production `DATABASE_URL` |
| GitHub | — | Source control | Repository hosting (`ARULKINT/rowdesk`, private) | Version control, Vercel Git integration |

## 2. Why Each Major Choice

| Choice | Rationale |
|---|---|
| **Next.js App Router** | Single deployable unit combining SSR pages and API routes; Server Components remove the need for a separate REST layer on read-heavy admin pages. |
| **Prisma** | Type-safe queries and a single schema-driven migration workflow against one Postgres database. |
| **One Postgres database everywhere, no local database** | Neon Postgres is the only database — local dev, tests, and production. There's no separate local/SQLite copy to keep in sync with production — see [18-deployment.md](18-deployment.md). |
| **bcryptjs over a native bcrypt binding** | Pure JavaScript, no native compilation step — simpler to deploy on Vercel's serverless runtime. |
| **Session cookie + DB-backed sessions, not JWT** | Sessions can be revoked instantly (password reset, disabling a user) because every request re-checks the database; a stateless JWT cannot be revoked without an extra denylist mechanism. |
| **In-memory rate limiting** | Simplest possible implementation for a single-instance deployment; explicitly documented as needing a shared store (e.g. Redis) before scaling to multiple instances — see [22-performance-scalability.md](22-performance-scalability.md). |
| **AES-256-GCM via Node's built-in `crypto`** | No extra dependency; authenticated encryption (tamper-evident) for the one genuinely sensitive at-rest secret the app stores (Google OAuth tokens). |
| **Zod** | Runtime validation matching the TypeScript types, with a single shared `parseJsonBody` helper so every mutating route validates consistently. |
| **CSS custom properties instead of a component library** | The visual design is a specific, deliberate typographic/data-forward aesthetic (see `globals.css` tokens) rather than a generic component-library look. |

## 3. Explicitly Not Used

| Not used | Why it matters to state |
|---|---|
| GraphQL | All APIs are REST-style JSON Route Handlers |
| Redis / any shared cache or queue | Rate limiting and session lookups are in-memory / direct DB reads respectively |
| Docker | No containerization; Vercel builds and runs the Next.js app directly |
| Any AI/ML library or LLM API | No AI/ML functionality exists in this codebase |
| A frontend state-management library (Redux, Zustand, etc.) | All client state is local `useState`/`useMemo` in `RowdeskScreen.tsx` and the admin panel components |
| A component/UI kit (MUI, Chakra, shadcn) | All UI is hand-built with Tailwind utilities and CSS Modules |
