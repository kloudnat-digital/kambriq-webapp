# Kambriq

[![CI](https://github.com/kloudnat-digital/kambriq-api/actions/workflows/ci.yml/badge.svg)](https://github.com/kloudnat-digital/kambriq-api/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/kloudnat-digital/kambriq-api/branch/main/graph/badge.svg)](https://codecov.io/gh/kloudnat-digital/kambriq-api)

Full-stack Nx monorepo containing the NestJS API and Next.js web application. The API exposes a single unified gateway routing requests across domain-specific modules, each backed by its own isolated PostgreSQL database. The web app is a Next.js 16 client consuming the API.

---

## Architecture

```text
apps/
├── api/                        # NestJS API gateway
│   └── src/
│       ├── app/                # Root module (global config, guards, filters)
│       ├── core/               # Domain: authentication, users, roles, profiles
│       ├── kbs/                # Domain: training courses, exams, certificates
│       ├── kamnet/             # Domain: agent network, tiers, referrals, sales
│       └── lands/              # Domain: land parcels, reservations, commissions
└── web/                        # Next.js 16 frontend (Turbopack)

libs/
└── common/                     # Shared library (guards, decorators, filters, i18n, services…)

prisma/
├── core/                       # Prisma schema & migrations - kambriq_core DB
├── kbs/                        # Prisma schema & migrations - kambriq_kbs DB
├── kamnet/                     # Prisma schema & migrations - kambriq_kamnet DB
└── lands/                      # Prisma schema & migrations - kambriq_lands DB
```

Each domain has a dedicated Prisma client generated into `libs/common/src/prisma/` and connects to its own database, ensuring full data isolation between concerns.

---

## Domains

| Domain        | Database            | Status      | Description                                              |
| ------------- | ------------------- | ----------- | -------------------------------------------------------- |
| **Core**      | `kambriq_core`      | Implemented | Authentication, user management, roles & permissions     |
| **KBS**       | `kambriq_kbs`       | Implemented | Training courses, exams, progress tracking, certificates |
| **Kamnet**    | `kambriq_kamnet`    | Implemented | Agent network, tier promotions, referrals, commissions   |
| **Lands**     | `kambriq_lands`     | Implemented | Land parcel listings, reservations, agent commissions    |
| **Verify**    | `kambriq_verify`    | Planned     | -                                                        |
| **Valuation** | `kambriq_valuation` | Planned     | -                                                        |

---

## Tech Stack

### API

| Layer           | Technology                                                               |
| --------------- | ------------------------------------------------------------------------ |
| Framework       | [NestJS](https://nestjs.com) v11                                         |
| Monorepo        | [Nx](https://nx.dev) v22                                                 |
| Package manager | [pnpm](https://pnpm.io) v9 (workspace)                                   |
| ORM             | [Prisma](https://www.prisma.io) v7 (multi-schema, per-domain clients)    |
| Database        | PostgreSQL 16                                                            |
| Cache / Queue   | Redis 7 + [BullMQ](https://docs.bullmq.io)                               |
| Authentication  | JWT (access + refresh tokens) via Passport                               |
| Validation      | [Zod](https://zod.dev) + nestjs-zod                                      |
| File Storage    | AWS S3 (presigned uploads)                                               |
| Email           | AWS SES v2                                                               |
| Logging         | [Pino](https://getpino.io) via nestjs-pino (structured, correlation IDs) |
| i18n            | nestjs-i18n (default language: French)                                   |
| API Docs        | Swagger / OpenAPI (`/api/v1/docs` in non-production)                     |
| Security        | Helmet, rate limiting (Throttler), CORS                                  |
| Health          | @nestjs/terminus                                                         |
| Language        | TypeScript v5.9                                                          |

### Web

| Layer        | Technology                                                   |
| ------------ | ------------------------------------------------------------ |
| Framework    | [Next.js](https://nextjs.org) v16 (App Router, Turbopack)    |
| Auth         | [NextAuth](https://authjs.dev) v5 (JWT, no database adapter) |
| Styling      | [Tailwind CSS](https://tailwindcss.com) v4 + shadcn/ui       |
| State / Data | [TanStack Query](https://tanstack.com/query) v5              |
| i18n         | [next-intl](https://next-intl-docs.vercel.app) (fr / en)     |
| Maps         | [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js)         |
| Language     | TypeScript v5.9                                              |

---

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Docker** and **Docker Compose**

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

> `postinstall` automatically generates all four Prisma clients (`core`, `kbs`, `kamnet`, `lands`).

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values (see [Environment Variables](#environment-variables)).

### 3. Start the Docker dev stack and initialize the database

**First time only** (starts services, applies all migrations, and seeds demo data):

```bash
pnpm docker:dev:init
```

This starts:

- **PostgreSQL 16** on port `5432` (databases: `kambriq_core`, `kambriq_kbs`, `kambriq_kamnet`, `kambriq_lands`)
- **Redis 7** on port `6379`
- **pgAdmin 4** on [http://localhost:5050](http://localhost:5050) (`admin@kambriq.com` / `admin`)

Then runs `db:setup` (all four migrations + seed script). See [Seed Credentials](#seed-credentials) for the demo accounts.

**Subsequent runs** (data already present):

```bash
pnpm docker:dev
```

### 4. Start the API in development mode

```bash
pnpm start:dev
```

The API will be available at [http://localhost:3000](http://localhost:3000).
Swagger docs: [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)

---

## Available Scripts

### API scripts

| Command            | Description                           |
| ------------------ | ------------------------------------- |
| `pnpm start:dev`   | Start API in watch mode (hot reload)  |
| `pnpm build`       | Production build (API)                |
| `pnpm start:prod`  | Run production build                  |
| `pnpm lint`        | Run ESLint                            |
| `pnpm typecheck`   | Run TypeScript type checking          |
| `pnpm test`        | Run all unit tests (`api` + `common`) |
| `pnpm test:api`    | Run API unit tests only               |
| `pnpm test:common` | Run `@kambriq/common` unit tests only |
| `pnpm format`      | Format all source files with Prettier |

### Web scripts

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `pnpm web:dev`   | Start web app in dev mode (port 3001) |
| `pnpm web:build` | Production build (Next.js)            |
| `pnpm web:start` | Serve the production build            |

### Database scripts

| Command                      | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `pnpm db:migrate:dev`        | Create and apply migrations (dev) - all 4 schemas    |
| `pnpm db:migrate:dev:core`   | Migrations for Core DB only                          |
| `pnpm db:migrate:dev:kbs`    | Migrations for KBS DB only                           |
| `pnpm db:migrate:dev:kamnet` | Migrations for Kamnet DB only                        |
| `pnpm db:migrate:dev:lands`  | Migrations for Lands DB only                         |
| `pnpm db:migrate:deploy`     | Apply existing migrations (production) - all 4       |
| `pnpm db:seed`               | Run seed script (idempotent - safe to re-run)        |
| `pnpm db:setup`              | Migrate all + seed (shortcut for fresh environments) |
| `pnpm db:generate:core`      | Regenerate Core Prisma client                        |
| `pnpm db:generate:kbs`       | Regenerate KBS Prisma client                         |
| `pnpm db:generate:kamnet`    | Regenerate Kamnet Prisma client                      |
| `pnpm db:generate:lands`     | Regenerate Lands Prisma client                       |
| `pnpm db:studio:core`        | Open Prisma Studio for Core DB (port 5555)           |
| `pnpm db:studio:kbs`         | Open Prisma Studio for KBS DB (port 5556)            |
| `pnpm db:studio:kamnet`      | Open Prisma Studio for Kamnet DB (port 5557)         |
| `pnpm db:studio:lands`       | Open Prisma Studio for Lands DB (port 5558)          |
| `pnpm db:reset`              | Reset all databases (dev only)                       |

### Docker scripts

| Command                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `pnpm docker:dev:init`  | First-time setup: start services + migrate + seed    |
| `pnpm docker:dev`       | Start dev containers (data already present)          |
| `pnpm docker:down`      | Stop all containers (volumes preserved)              |
| `pnpm docker:dev:reset` | Stop containers and remove all volumes (clean slate) |
| `pnpm docker:dev:logs`  | Tail logs from all services                          |

---

## Testing

Unit tests are co-located in `__test__/` directories within each Nx project. The suite covers service-layer logic and shared library utilities; no database or external service is started - all dependencies are mocked.

Coverage is tracked automatically on every push to `main` via [Codecov](https://codecov.io/gh/kloudnat-digital/kambriq-api). To generate reports locally:

```bash
pnpm test:cov          # both projects
pnpm test:cov:api      # apps/api only  → coverage/apps/api/
pnpm test:cov:common   # libs/common only → coverage/libs/common/
```

### `apps/api` - Domain services

| Suite                                   | Covers                                                       |
| --------------------------------------- | ------------------------------------------------------------ |
| `core/auth/auth.service`                | Sign-up, sign-in, token refresh, password hashing            |
| `core/auth/strategies/jwt.strategy`     | JWT payload validation and user lookup                       |
| `core/users/users.service`              | User CRUD, role assignment                                   |
| `core/roles/roles.service`              | Role lookup and management                                   |
| `kbs/candidates/candidates.service`     | Candidate enrollment and progress                            |
| `kbs/courses/courses.service`           | Course creation, listing, deletion                           |
| `kbs/exam/exam.service`                 | Exam scheduling, submission, and grading logic               |
| `kbs/exam/grading-processor`            | BullMQ job routing, pass/fail email dispatch, KCA role grant |
| `kbs/certificates/certificates.service` | Certificate generation and public verification               |

### `libs/common` - Shared library

| Suite                             | Covers                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `interceptors/transform-response` | Response envelope (`{ success, data }`), passthrough for pre-wrapped responses |
| `middleware/correlation-id`       | Correlation ID generation and header propagation                               |
| `guards/roles.guard`              | Role-based access enforcement                                                  |
| `dto/pagination.dto`              | Pagination query parsing and defaults                                          |
| `email/email.service`             | SES template dispatch                                                          |

---

## Environment Variables

| Variable                 | Description                             | Example                 |
| ------------------------ | --------------------------------------- | ----------------------- |
| `NODE_ENV`               | Runtime environment                     | `development`           |
| `PORT`                   | API listening port                      | `3000`                  |
| `API_PREFIX`             | Global route prefix                     | `api/v1`                |
| `DATABASE_URL_CORE`      | PostgreSQL connection - Core domain     | `postgresql://...`      |
| `DATABASE_URL_KBS`       | PostgreSQL connection - KBS domain      | `postgresql://...`      |
| `DATABASE_URL_KAMNET`    | PostgreSQL connection - Kamnet domain   | `postgresql://...`      |
| `DATABASE_URL_LANDS`     | PostgreSQL connection - Lands domain    | `postgresql://...`      |
| `JWT_SECRET`             | JWT signing secret (≥ 32 chars)         | -                       |
| `JWT_ACCESS_EXPIRATION`  | Access token lifetime                   | `15m`                   |
| `JWT_REFRESH_EXPIRATION` | Refresh token lifetime                  | `15d`                   |
| `CORS_ORIGINS`           | Comma-separated allowed origins         | `http://localhost:3001` |
| `THROTTLE_TTL`           | Rate limit window in milliseconds       | `60000`                 |
| `THROTTLE_LIMIT`         | Max requests per window                 | `100`                   |
| `REDIS_HOST`             | Redis hostname                          | `localhost`             |
| `REDIS_PORT`             | Redis port                              | `6379`                  |
| `AWS_ACCESS_KEY_ID`      | AWS credentials                         | -                       |
| `AWS_SECRET_ACCESS_KEY`  | AWS credentials                         | -                       |
| `AWS_S3_BUCKET`          | S3 bucket name for file uploads         | `kambriq-uploads`       |
| `AWS_REGION`             | AWS region                              | `eu-central-1`          |
| `EMAIL_FROM`             | Sender email address                    | `noreply@kambriq.com`   |
| `EMAIL_FROM_NAME`        | Sender display name                     | `KAMBRIQ`               |
| `EMAIL_TRANSPORT`        | `ses` sends mail, `console` only logs   | `ses`                   |
| `STORAGE_TRANSPORT`      | `s3` stores files, `disabled` throws    | `s3`                    |
| `FRONTEND_URL`           | Frontend origin (used in email links)   | `http://localhost:3001` |
| `SALT_ROUNDS`            | bcrypt salt rounds for password hashing | `12`                    |

---

## API Overview

All endpoints are prefixed with `/api/v1`. Authentication uses Bearer JWT tokens.

### Core - Auth & Users

| Method | Path             | Auth     | Description                |
| ------ | ---------------- | -------- | -------------------------- |
| POST   | `/auth/signup`   | Public   | Register a new user        |
| POST   | `/auth/signin`   | Public   | Login and obtain tokens    |
| POST   | `/auth/refresh`  | Public   | Refresh access token       |
| GET    | `/users/profile` | Required | Get current user's profile |
| PATCH  | `/users/:id`     | Required | Update user profile        |

### KBS - Training & Exams

| Method | Path                              | Auth       | Description                          |
| ------ | --------------------------------- | ---------- | ------------------------------------ |
| GET    | `/kbs/courses`                    | Required   | List published courses               |
| POST   | `/kbs/enroll`                     | Required   | Enroll in a course                   |
| GET    | `/kbs/progress`                   | Required   | Get candidate progress               |
| POST   | `/kbs/quiz/submit`                | Required   | Submit module quiz answers           |
| POST   | `/kbs/exam/schedule`              | Required   | Schedule an exam attempt             |
| POST   | `/kbs/exam/submit`                | Required   | Submit exam and trigger auto-grading |
| GET    | `/kbs/public/certificate/:number` | Public     | Verify a KCA certificate             |
| POST   | `/kbs/admin/courses`              | Admin only | Create a course                      |
| PATCH  | `/kbs/admin/courses/:id`          | Admin only | Update a course                      |
| DELETE | `/kbs/admin/courses/:id`          | Admin only | Delete a course                      |
| PATCH  | `/kbs/admin/settings`             | Admin only | Update global KBS settings           |

Full interactive documentation is available at `/api/v1/docs` when running in development or staging.

---

## Project Structure

```text
.
├── apps/
│   ├── api/                        # NestJS API application
│   └── api-e2e/                    # End-to-end tests
├── libs/
│   └── common/                     # Shared library
│       └── src/
│           ├── config/             # Zod-based env validation
│           ├── constants/          # Role codes, queue names, enums, job payloads
│           ├── decorators/         # @CurrentUser, @Roles, @Public
│           ├── dto/                # Shared DTOs (pagination, etc.)
│           ├── email/              # SES email service & templates
│           ├── exceptions/         # Custom exception classes
│           ├── filters/            # Global, Prisma, Zod exception filters
│           ├── guards/             # JWT auth guard, roles guard
│           ├── i18n/               # Translation files (en / fr)
│           ├── interceptors/       # Response transform interceptor
│           ├── middleware/         # Correlation ID middleware
│           ├── prisma/             # Generated Prisma clients (core, kbs, kamnet, lands)
│           ├── queue/              # BullMQ configuration
│           ├── redis/              # RedisService (ioredis wrapper, global)
│           ├── services/           # StorageService (S3)
│           ├── types/              # Shared types & enums
│           └── utils/              # Password hashing, etc.
├── prisma/
│   ├── core/                       # Core schema, migrations, config
│   ├── kbs/                        # KBS schema, migrations, config
│   ├── kamnet/                     # Kamnet schema, migrations, config
│   ├── lands/                      # Lands schema, migrations, config
│   └── seed.ts                     # Idempotent seed script (all domains)
├── docker/
│   ├── docker-compose.yml          # Dev infrastructure
│   └── init.sql                    # Creates all 4 databases on first Postgres boot
└── nx.json
```

---

## Seed Credentials

Running `pnpm db:seed` (or `pnpm docker:dev:init`) populates all four databases with demo data. All accounts use the password **`Test1234!`**.

### Core - Users

| Email                       | Role           | Notes                 |
| --------------------------- | -------------- | --------------------- |
| `admin@kambriq.com`         | `ADMIN_GLOBAL` | Platform super-admin  |
| `jean.kbs@kambriq.com`      | `ADMIN_KBS`    | KBS domain admin      |
| `claude.kamnet@kambriq.com` | `ADMIN_KAMNET` | Kamnet domain admin   |
| `pierre.lands@kambriq.com`  | `ADMIN_LANDS`  | Lands domain admin    |
| `eric.mbou@kambriq.com`     | `AGENT`        | Agent (AGT-2025-0001) |
| `sylvie.ngo@kambriq.com`    | `AGENT`        | Agent (AGT-2025-0002) |
| `boris.tcha@kambriq.com`    | `AGENT`        | Agent (AGT-2025-0003) |
| `amina.fall@kambriq.com`    | `AGENT`        | Agent (AGT-2025-0004) |
| `paul.fouda@kambriq.com`    | `AGENT`        | Agent (AGT-2025-0005) |

### Kamnet - Agent sponsorship tree

```text
Eric  (CONFIRMED, 6 sales)  ← root sponsor
├── Sylvie (JUNIOR, 2 sales)
│   └── Amina  (JUNIOR, 0 sales)
├── Boris  (JUNIOR, 1 sale)
└── Paul   (JUNIOR, 0 sales)
```

### KBS - Training data

- 1 published course with 2 modules and 6 lessons
- 5 enrolled candidates at various progress stages
- 5 certificates (1 per agent)

### Lands - Parcel data

- 3 land labels, 5 land parcels (mixed availability)
- 1 completed reservation linked to Eric's agent account

---

## License

MIT

## Commit Hygiene

- Do not add `Made-with: Cursor` to commits.
