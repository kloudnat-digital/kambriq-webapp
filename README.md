# Kambriq — Server

A modular, enterprise-grade backend platform built with NestJS and managed as an Nx monorepo. The server exposes a single unified API gateway that routes requests across domain-specific modules, each backed by its own isolated PostgreSQL database.

---

## Architecture

```text
apps/
└── api/                        # Single NestJS API gateway
    └── src/
        ├── app/                # Root module (global config, guards, filters)
        ├── core/               # Domain: authentication, users, roles, profiles
        └── kbs/                # Domain: training courses, exams, certificates

libs/
└── common/                     # Shared library (guards, decorators, filters, i18n, services…)

prisma/
├── core/                       # Prisma schema & migrations — kambriq_core DB
└── kbs/                        # Prisma schema & migrations — kambriq_kbs DB
```

Each domain has a dedicated Prisma client generated into `libs/common/src/prisma/` and connects to its own database, ensuring full data isolation between concerns.

---

## Domains

| Domain        | Database            | Status      | Description                                              |
|---------------|---------------------|-------------|----------------------------------------------------------|
| **Core**      | `kambriq_core`      | Implemented | Authentication, user management, roles & permissions     |
| **KBS**       | `kambriq_kbs`       | Implemented | Training courses, exams, progress tracking, certificates |
| **Kamnet**    | `kambriq_kamnet`    | Planned     | —                                                        |
| **Lands**     | `kambriq_lands`     | Planned     | —                                                        |
| **Verify**    | `kambriq_verify`    | Planned     | —                                                        |
| **Valuation** | `kambriq_valuation` | Planned     | —                                                        |

---

## Tech Stack

| Layer              | Technology                                                              |
|--------------------|-------------------------------------------------------------------------|
| Framework          | [NestJS](https://nestjs.com) v11                                        |
| Monorepo           | [Nx](https://nx.dev) v22                                                |
| ORM                | [Prisma](https://www.prisma.io) v7 (multi-schema, per-domain clients)   |
| Database           | PostgreSQL 16                                                           |
| Cache / Queue      | Redis 7 + [BullMQ](https://docs.bullmq.io)                              |
| Authentication     | JWT (access + refresh tokens) via Passport                              |
| Validation         | [Zod](https://zod.dev) + nestjs-zod                                     |
| File Storage       | AWS S3 (presigned uploads)                                              |
| Email              | AWS SES v2                                                              |
| Logging            | [Pino](https://getpino.io) via nestjs-pino (structured, correlation IDs)|
| i18n               | nestjs-i18n (default language: French)                                  |
| API Docs           | Swagger / OpenAPI (`/api/v1/docs` in non-production)                    |
| Security           | Helmet, rate limiting (Throttler), CORS                                 |
| Health             | @nestjs/terminus                                                        |
| Language           | TypeScript v5.9                                                         |

---

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Docker** and **Docker Compose**

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

> `postinstall` automatically generates both Prisma clients (`core` and `kbs`).

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values (see [Environment Variables](#environment-variables)).

### 3. Start the Docker dev stack

```bash
npm run docker:dev
```

This starts:

- **PostgreSQL 16** on port `5432` (databases: `kambriq_core`, `kambriq_kbs`)
- **Redis 7** on port `6379`
- **pgAdmin 4** on [http://localhost:5050](http://localhost:5050) (`admin@kambriq.com` / `admin`)

### 4. Run database migrations

```bash
npm run db:migrate:dev
```

### 5. Start the API in development mode

```bash
npm run start:dev
```

The API will be available at [http://localhost:3000](http://localhost:3000).
Swagger docs: [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)

---

## Available Scripts

### API

| Command              | Description                              |
|----------------------|------------------------------------------|
| `npm run start:dev`  | Start in watch mode (hot reload)         |
| `npm run build`      | Production build                         |
| `npm run start:prod` | Run production build                     |
| `npm run lint`       | Run ESLint                               |
| `npm run typecheck`  | Run TypeScript type checking             |
| `npm run test`       | Run unit tests                           |
| `npm run format`     | Format all source files with Prettier    |

### Database

| Command                    | Description                                      |
|----------------------------|--------------------------------------------------|
| `npm run db:migrate:dev`   | Create and apply migrations (dev) — all schemas  |
| `npm run db:migrate:deploy`| Apply existing migrations (production)           |
| `npm run db:generate:core` | Regenerate Core Prisma client                    |
| `npm run db:generate:kbs`  | Regenerate KBS Prisma client                     |
| `npm run db:studio:core`   | Open Prisma Studio for Core DB (port 5555)       |
| `npm run db:studio:kbs`    | Open Prisma Studio for KBS DB (port 5556)        |
| `npm run db:reset`         | Reset and re-seed all databases (dev only)       |

### Docker

| Command                   | Description                                 |
|---------------------------|---------------------------------------------|
| `npm run docker:dev`      | Start dev containers in the background      |
| `npm run docker:down`     | Stop all containers                         |
| `npm run docker:dev:reset`| Stop containers and remove volumes (reset)  |

---

## Environment Variables

| Variable                  | Description                                      | Example                          |
|---------------------------|--------------------------------------------------|----------------------------------|
| `NODE_ENV`                | Runtime environment                              | `development`                    |
| `PORT`                    | API listening port                               | `3000`                           |
| `API_PREFIX`              | Global route prefix                              | `api/v1`                         |
| `DATABASE_URL_CORE`       | PostgreSQL connection — Core domain              | `postgresql://...`               |
| `DATABASE_URL_KBS`        | PostgreSQL connection — KBS domain               | `postgresql://...`               |
| `JWT_SECRET`              | JWT signing secret (≥ 32 chars)                  | —                                |
| `JWT_ACCESS_EXPIRATION`   | Access token lifetime                            | `15m`                            |
| `JWT_REFRESH_EXPIRATION`  | Refresh token lifetime                           | `15d`                            |
| `CORS_ORIGINS`            | Comma-separated allowed origins                  | `http://localhost:3001`          |
| `THROTTLE_TTL`            | Rate limit window in milliseconds                | `60000`                          |
| `THROTTLE_LIMIT`          | Max requests per window                          | `100`                            |
| `REDIS_HOST`              | Redis hostname                                   | `localhost`                      |
| `REDIS_PORT`              | Redis port                                       | `6379`                           |
| `AWS_ACCESS_KEY_ID`       | AWS credentials                                  | —                                |
| `AWS_SECRET_ACCESS_KEY`   | AWS credentials                                  | —                                |
| `AWS_S3_BUCKET`           | S3 bucket name for file uploads                  | `kambriq-uploads`                |
| `AWS_REGION`              | AWS region                                       | `eu-west-3`                      |
| `EMAIL_FROM`              | Sender email address                             | `noreply@kambriq.com`            |
| `EMAIL_FROM_NAME`         | Sender display name                              | `KAMBRIQ`                        |
| `FRONTEND_URL`            | Frontend origin (used in email links)            | `http://localhost:3001`          |
| `SALT_ROUNDS`             | bcrypt salt rounds for password hashing          | `12`                             |

---

## API Overview

All endpoints are prefixed with `/api/v1`. Authentication uses Bearer JWT tokens.

### Core — Auth & Users

| Method | Path                    | Auth     | Description                |
|--------|-------------------------|----------|----------------------------|
| POST   | `/auth/signup`          | Public   | Register a new user        |
| POST   | `/auth/signin`          | Public   | Login and obtain tokens    |
| POST   | `/auth/refresh`         | Public   | Refresh access token       |
| GET    | `/users/profile`        | Required | Get current user's profile |
| PATCH  | `/users/:id`            | Required | Update user profile        |

### KBS — Training & Exams

| Method | Path                              | Auth       | Description                          |
|--------|-----------------------------------|------------|--------------------------------------|
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
│           ├── constants/          # Role codes, queue names, etc.
│           ├── decorators/         # @CurrentUser, @Roles, @Public
│           ├── dto/                # Shared DTOs (pagination, etc.)
│           ├── email/              # SES email service & templates
│           ├── exceptions/         # Custom exception classes
│           ├── filters/            # Global, Prisma, Zod exception filters
│           ├── guards/             # JWT auth guard, roles guard
│           ├── i18n/               # Translation files
│           ├── interceptors/       # Response transform interceptor
│           ├── middleware/         # Correlation ID middleware
│           ├── prisma/             # Generated Prisma clients
│           ├── queue/              # BullMQ configuration
│           ├── services/           # StorageService (S3)
│           ├── types/              # Shared types & enums
│           └── utils/              # Password hashing, etc.
├── prisma/
│   ├── core/                       # Core schema, migrations, config
│   └── kbs/                        # KBS schema, migrations, config
├── docker/
│   └── docker-compose.yml          # Dev infrastructure
└── nx.json
```

---

## License

MIT
