# Kambriq

[![CI](https://github.com/kloudnat-digital/kambriq-api/actions/workflows/ci.yml/badge.svg)](https://github.com/kloudnat-digital/kambriq-api/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/kloudnat-digital/kambriq-api/branch/main/graph/badge.svg)](https://codecov.io/gh/kloudnat-digital/kambriq-api)

An Nx monorepo holding four things: a NestJS API, a Next.js web application, a
Sanity Studio for the site content, and four Prisma schemas backed by four
separate PostgreSQL databases.

The API is a single gateway. Each business domain has its own database and its
own generated Prisma client, and there are no foreign keys between databases.
The web application is a Next.js client and a BFF: it calls the API and holds no
database client of its own.

> **Two documents govern how work is done here, and this README is not one of
> them.** [`CLAUDE.md`](CLAUDE.md) holds the working rules, the invariants and
> the catalogue of defects this codebase has already paid for. [`docs/ops/registre-chantiers.md`](docs/ops/registre-chantiers.md)
> is the record of what has been proved and how. Read this README to run the
> project. Read those two before changing it.

---

## Repository layout

```text
apps/
  api/          NestJS API gateway
    src/app/        root module: global config, guards, filters
    src/core/       authentication, users, roles, profiles, contact, logging
    src/kbs/        training courses, exams, certificates
    src/kamnet/     agent network, tiers, referrals, sales
    src/lands/      land parcels, reservations, payments, commissions
    src/cms/        Sanity webhook and the policy archive
    src/newsletter/ newsletter subscriptions
    src/health/     health and deployed-build identity
    src/__test__/   unit specs, convention guards, database-backed specs
  api-e2e/      delivery journeys, run against a DEPLOYED api
  web/          Next.js application (App Router, Turbopack)
  web-e2e/      Playwright browser tests

libs/
  common/       shared library: guards, decorators, filters, dto, email,
                payments, cms contracts, i18n, generated Prisma clients

prisma/
  core/ kbs/ kamnet/ lands/    one schema, one migration history each
  seed.ts                      idempotent and restorative seed
  seed-data/                   seed fixtures, including the KCA1 course
  bootstrap-admins.ts          creates the super administrators
  run-migrations.js            migration runner used by the deploy workflow

studio/         Sanity Studio. A separate install, outside the pnpm workspace.
scripts/        CI gate, deploy script, Sanity webhook management
docs/           ADRs, the chantier register, deploy runbooks
docker/         Dockerfiles and the local development stack
.github/        four workflows
```

### Nx projects

`npx nx show projects` returns six projects. The Studio is deliberately not one
of them.

| Project   | Path           | Targets                                                               |
| --------- | -------------- | --------------------------------------------------------------------- |
| `api`     | `apps/api`     | `build`, `serve`, `test`, `test-db`, `lint`, and the prune targets    |
| `web`     | `apps/web`     | `dev`, `build`, `test`, `lint`                                        |
| `common`  | `libs/common`  | `build`, `test`, `lint`                                               |
| `api-e2e` | `apps/api-e2e` | `journeys`, `test`                                                    |
| `web-e2e` | `apps/web-e2e` | Playwright, inferred                                                  |
| `studio`  | `studio`       | **none.** Listed in `.nxignore` and absent from `pnpm-workspace.yaml` |

The Studio is excluded on purpose. Adding it to the workspace would make every
CI job install `sanity` and its dependencies, which is several hundred
megabytes, and Nx would infer a seventh project that joins `run-many --all`. It
has its own `pnpm-lock.yaml` and its own install.

---

## Domains and databases

| Domain    | Database            | State              | Contents                                                        |
| --------- | ------------------- | ------------------ | --------------------------------------------------------------- |
| Core      | `kambriq_core`      | In use             | Authentication, users, roles, profiles, contact, policy archive |
| KBS       | `kambriq_kbs`       | In use             | Courses, lessons, quizzes, exams, certificates                  |
| Kamnet    | `kambriq_kamnet`    | In use             | Agents, tiers, referrals, sales, commissions                    |
| Lands     | `kambriq_lands`     | In use             | Parcels, reservations, payments, receipts                       |
| Verify    | `kambriq_verify`    | Created, no schema | Nothing. See the note below.                                    |
| Valuation | `kambriq_valuation` | Created, no schema | Nothing.                                                        |

`docker/init.sql` creates all six databases on the first Postgres boot, and
`DATABASE_URL_VERIFY` and `DATABASE_URL_VALUATION` are accepted as optional
environment variables. Neither has a Prisma schema, a migration or a generated
client, so nothing reads them today.

**The VERIFY product itself is already live, and it is served from
`kambriq_kbs`.** Certificate verification is `GET /api/v1/kbs/public/verify/:kcaNumber`,
with the public page at `/verify-certificate/[certificateNumber]`. Do not read
the empty `kambriq_verify` database as meaning the feature does not exist.

Each domain's Prisma client is generated into `libs/common/src/prisma/`, one
directory per domain.

---

## Tech stack

### API

| Layer           | Technology                                                           |
| --------------- | -------------------------------------------------------------------- |
| Framework       | [NestJS](https://nestjs.com) 11                                      |
| Monorepo        | [Nx](https://nx.dev) 22                                              |
| Package manager | [pnpm](https://pnpm.io) 10 (workspace)                               |
| ORM             | [Prisma](https://www.prisma.io) 7, four schemas, `pg` driver adapter |
| Database        | PostgreSQL 16                                                        |
| Cache and queue | Redis 7 with [BullMQ](https://docs.bullmq.io)                        |
| Authentication  | JWT access and refresh tokens through Passport                       |
| Validation      | [Zod](https://zod.dev) with nestjs-zod                               |
| File storage    | AWS S3, presigned uploads                                            |
| Email           | AWS SES v2                                                           |
| Configuration   | AWS SSM Parameter Store, read at runtime through the SDK             |
| Logging         | [Pino](https://getpino.io) through nestjs-pino, with correlation ids |
| i18n            | nestjs-i18n, default French                                          |
| API docs        | Swagger at `/api/v1/docs`, outside production                        |
| Security        | Helmet, Throttler rate limiting, CORS                                |
| Language        | TypeScript 5.9                                                       |

### Web

| Layer        | Technology                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| Framework    | [Next.js](https://nextjs.org) 16, App Router, Turbopack, standalone output |
| Auth         | [NextAuth](https://authjs.dev) 5, JWT, no database adapter                 |
| Styling      | [Tailwind CSS](https://tailwindcss.com) 4 with shadcn/ui and Radix         |
| Server state | [TanStack Query](https://tanstack.com/query) 5                             |
| Client state | Zustand, and `nuqs` for URL state                                          |
| Forms        | react-hook-form with Zod resolvers                                         |
| i18n         | [next-intl](https://next-intl.dev), French and English                     |
| CMS          | Sanity, through `@sanity/client` and `@portabletext/react`                 |
| Maps         | [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js)                       |
| Charts       | Recharts                                                                   |
| Test mocking | MSW                                                                        |
| Language     | TypeScript 5.9                                                             |

---

## Prerequisites

- **Node.js 24 or later.** `.nvmrc` pins 24 and CI uses 24.
- **pnpm 10.** `package.json` declares `pnpm@10.22.0`.
- **Docker** and **Docker Compose**.

`.npmrc` sets `engine-strict=true`, so an older Node or pnpm produces a refused
install rather than a warning. If you use nvm:

```bash
nvm use 24
```

---

## Getting started

### 1. Install

```bash
pnpm install
```

`postinstall` generates the four Prisma clients. If a branch changes a schema,
run the matching `db:generate:*` script: generated code is not in git and does
not change when you switch branches.

### 2. Configure

```bash
cp .env.example .env
```

`.env.example` does not list every variable the code reads. See
[Environment variables](#environment-variables) for the full set and for the
three local settings that matter most.

### 3. Start the database and seed it

First time, which starts the services, applies all four migration histories and
seeds:

```bash
pnpm docker:dev:init
```

That starts:

- PostgreSQL 16 on port `5432`
- Redis 7 on port `6379`
- pgAdmin 4 on [http://localhost:5050](http://localhost:5050)

Afterwards, when the data is already there:

```bash
pnpm docker:dev
```

### 4. Run the applications

```bash
pnpm start:dev     # API on http://localhost:3000
pnpm start:web     # web on http://localhost:3001
```

Swagger is at [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs).

---

## Scripts

### Running the applications

| Command           | What it does                            |
| ----------------- | --------------------------------------- |
| `pnpm start:dev`  | API in watch mode                       |
| `pnpm start:web`  | Web in development mode, port 3001      |
| `pnpm build`      | Production build of the API             |
| `pnpm build:web`  | Production build of the web application |
| `pnpm start:prod` | Run the built API                       |

### Quality

| Command              | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `pnpm lint`          | `nx run-many -t lint --all`, which covers the six Nx projects |
| `pnpm lint:web`      | Lint the web project only                                     |
| `pnpm typecheck`     | Typecheck **the API only**                                    |
| `pnpm typecheck:web` | Typecheck the web application                                 |
| `pnpm format`        | Format with Prettier                                          |
| `pnpm format:check`  | Check formatting without writing                              |

`pnpm lint` does not lint the whole repository. The root `prisma/` directory
belongs to no Nx project, so `seed.ts`, `bootstrap-admins.ts` and the KCA1
loaders are never reached by that command. The pre-commit hook does reach them,
because `lint-staged` runs ESLint on staged paths from the repository root. When
you add or widen an ESLint rule, check it against both scopes.

### Tests

| Command                | What it runs                                          |
| ---------------------- | ----------------------------------------------------- |
| `pnpm test`            | Unit tests for `api`, `common`, `web` and `api-e2e`   |
| `pnpm test:api`        | API unit tests                                        |
| `pnpm test:common`     | Shared library unit tests                             |
| `pnpm test:web`        | Web unit tests                                        |
| `pnpm test:cov`        | The same four projects with coverage                  |
| `pnpm test:db`         | Database-backed specs against a real Postgres         |
| `pnpm test:db:reset`   | The same, resetting the test database first           |
| `pnpm test:journeys`   | The delivery journeys, against a deployed environment |
| `pnpm test:e2e`        | Playwright browser tests                              |
| `pnpm test:e2e:report` | Open the last Playwright report                       |

### Database

| Command                      | What it does                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| `pnpm db:setup`              | Migrate all four, then seed                                   |
| `pnpm db:migrate:dev`        | Create and apply migrations, all four schemas                 |
| `pnpm db:migrate:dev:<m>`    | One module: `core`, `kbs`, `kamnet` or `lands`                |
| `pnpm db:migrate:deploy`     | Apply existing migrations, all four                           |
| `pnpm db:migrate:deploy:<m>` | Apply existing migrations for one module                      |
| `pnpm db:seed`               | Run the seed. Idempotent **and** restorative                  |
| `pnpm db:bootstrap`          | Create the super administrators from the SSM bootstrap prefix |
| `pnpm db:generate:<m>`       | Regenerate one Prisma client                                  |
| `pnpm db:studio`             | Prisma Studio, all four                                       |
| `pnpm db:studio:<m>`         | Prisma Studio for one module, ports 5555 to 5558              |
| `pnpm db:reset`              | Reset all four databases. Local only                          |
| `pnpm db:reset:<m>`          | Reset one database                                            |

The seed is restorative on purpose: consuming a seeded parcel and re-running the
seed puts it back. It also refuses to run if an account already exists at a
seeded address with a different id, because the seed keys users on email while
every other module keys on the id.

Four scripts under `prisma/` have no `package.json` entry and are run directly:
`load-kca1.ts`, `apply-kca1.ts`, `kca1-apply.ts` and
`sweep-orphaned-user-objects.ts`. Each states its own usage in its header.

### Docker

| Command                 | What it does                       |
| ----------------------- | ---------------------------------- |
| `pnpm docker:dev:init`  | Start services, migrate, seed      |
| `pnpm docker:dev`       | Start services                     |
| `pnpm docker:down`      | Stop containers, keep volumes      |
| `pnpm docker:dev:reset` | Stop containers and delete volumes |
| `pnpm docker:dev:logs`  | Tail all service logs              |
| `pnpm docker:build`     | Build the images locally           |

### Nx

`pnpm nx:graph` opens the project graph. `pnpm nx:reset` clears the Nx cache.

---

## Testing

There are five layers, and they run in different places. A test only counts if
you know which job runs it.

| Layer             | Command              | Where it runs             | Needs                |
| ----------------- | -------------------- | ------------------------- | -------------------- |
| Unit and guards   | `pnpm test`          | Every pull request        | Nothing              |
| Database-backed   | `pnpm test:db`       | Locally, by hand          | The Docker Postgres  |
| Delivery journeys | `pnpm test:journeys` | On develop, after a merge | A deployed API       |
| Browser           | `pnpm test:e2e`      | Locally and in CI         | A running web server |
| Convention guards | part of `pnpm test`  | Every pull request        | Nothing              |

Spec file counts, for scale:

| Project        | Files                            |
| -------------- | -------------------------------- |
| `apps/api`     | 99 unit specs, 15 database specs |
| `libs/common`  | 21                               |
| `apps/web`     | 41                               |
| `apps/api-e2e` | 6 (2 of them unit)               |
| `apps/web-e2e` | 8, and one setup file            |

**One journey is opt-in**, and skips unless its variable is set:
`RUN_BALANCE_JOURNEY=1` - journey 7 in `apps/api-e2e`, a deposit and a balance
taken to validation. It consumes a parcel on the environment it runs against.

The page walks in `apps/web-e2e` (`human-paths.spec.ts`, `emailed-links.spec.ts`)
run on every deploy, Chromium only.

`pnpm test:e2e` signs in once per role for the whole run (`sessions.setup.ts`)
and keeps every other sign-in inside the API's limits (`support/auth-budget.ts`).

**The unit suite opens no database or network connection.** Everything external
is mocked.

**`pnpm test:db` does open a database.** The specs are named `*.dbspec.ts` and
live in `apps/api/src/__test__/database/`. They run against `kambriq_lands_test`
on the Docker Postgres, migrated by the real migration files, and the runner
refuses any database whose name does not end in `_test`. These specs exist
because a trigger or a CHECK constraint is text in a migration file until
something executes it: a migration dropping all of them would otherwise pass a
green unit suite.

Two rules that come with that suite. A guarantee is proved by removing it and
watching the test fail, not by watching it pass. And the suite must pass twice in
a row with no reset, because `PolicySnapshot` and the payment ledger tables are
append-only, so a fixture written with a fixed id is permanent.

**`pnpm test:journeys` runs against a deployed environment**, not a local one. It
reads `KAMBRIQ_API_URL` and, when you want to be sure which build answered, gate
it with `EXPECTED_SHA`. The journeys are skipped on pull requests and run on the
push after a merge, so a journey assertion that goes stale cannot be caught by
any pull request gate.

**Convention guards** live in `apps/api/src/__test__/conventions/` and there are
32 of them. They are ordinary unit tests that read the source tree and fail on a
shape rather than on a behaviour: a role code written as a bare string, a route
that is public without being on the public list, a controller registered in an
order that shadows another, a build variable that reaches no workflow.

Coverage is uploaded to [Codecov](https://codecov.io/gh/kloudnat-digital/kambriq-api)
from the quality job, which runs on pull requests and on pushes to `main` and
`develop`. Note that `pnpm test:cov` runs four projects but only `api` and
`common` produce a coverage report.

---

## Environment variables

`.env.example` is the starting point but it is not complete: several variables
the code reads are missing from it. The authoritative list is the Zod schema in
`libs/common/src/config/env.validation.ts` for the API, and the `ARG` lines in
`docker/Dockerfile.web` for the web build.

### Three settings to get right locally

| Variable                     | Set it to  | Why                                                                     |
| ---------------------------- | ---------- | ----------------------------------------------------------------------- |
| `EMAIL_TRANSPORT`            | `console`  | Logs messages instead of sending them through SES                       |
| `STORAGE_TRANSPORT`          | `disabled` | No S3 credentials needed. Upload calls throw instead of failing quietly |
| `PAYMENT_CHANNELS_TRANSPORT` | `disabled` | No SSM needed. Composing a payment instruction throws                   |

Each degraded mode is an explicit setting, never an inference from a missing
variable. An unset variable is a sentence nobody wrote.

### Core

| Variable       | Description                                                                                                              | Example                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `NODE_ENV`     | `development`, `production` or `test`                                                                                    | `development`           |
| `APP_ENV`      | Which deployment this is                                                                                                 | `production`            |
| `PORT`         | API port                                                                                                                 | `3000`                  |
| `API_PREFIX`   | Global route prefix                                                                                                      | `api/v1`                |
| `CORS_ORIGINS` | Comma-separated allowed origins. Default `http://localhost:3000`, which is the API's own port, so set it to the web port | `http://localhost:3001` |
| `FRONTEND_URL` | Origin used in email links                                                                                               | `http://localhost:3001` |

`APP_ENV` is the environment discriminator, not `NODE_ENV`.
`docker/Dockerfile.web` sets `ENV NODE_ENV=production` on every environment,
because that is what a Next.js production build runs as, so `NODE_ENV` cannot
tell dev from prd. `APP_ENV` exists for that one decision. Absent means "not the
public site", so an image is safe to deploy anywhere by default and production
must declare itself.

### Databases

| Variable                  | Description                    |
| ------------------------- | ------------------------------ |
| `DATABASE_URL_CORE`       | Core database                  |
| `DATABASE_URL_KBS`        | KBS database                   |
| `DATABASE_URL_KAMNET`     | Kamnet database                |
| `DATABASE_URL_LANDS`      | Lands database                 |
| `DATABASE_URL_VERIFY`     | Optional. Nothing reads it yet |
| `DATABASE_URL_VALUATION`  | Optional. Nothing reads it yet |
| `DATABASE_URL_CORE_TEST`  | Used by `pnpm test:db`         |
| `DATABASE_URL_LANDS_TEST` | Used by `pnpm test:db`         |

### Authentication

| Variable                 | Description                              | Example |
| ------------------------ | ---------------------------------------- | ------- |
| `JWT_SECRET`             | Signing secret, 32 characters or more    | -       |
| `JWT_ACCESS_EXPIRATION`  | Access token lifetime                    | `15m`   |
| `JWT_REFRESH_EXPIRATION` | Refresh token lifetime                   | `15d`   |
| `AUTH_SECRET`            | Read implicitly by NextAuth 5 on the web | -       |

### Rate limiting

| Variable            | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `THROTTLE_TTL`      | Window in milliseconds. Default `60000`                          |
| `THROTTLE_LIMIT`    | Requests per window. Default `100`                               |
| `WEB_CALLER_SECRET` | Shared by the web and the API so the web can vouch for a visitor |

`WEB_CALLER_SECRET` matters more than it looks. Almost every call reaches the API
from the Next server, through the same load balancer, so without it every
visitor spends one shared rate-limit bucket for the whole site. The web presents
this secret alongside the visitor's address, and the API believes a forwarded
address only when the secret is present.

### Redis and queues

| Variable         | Description                        |
| ---------------- | ---------------------------------- |
| `REDIS_HOST`     | Hostname                           |
| `REDIS_PORT`     | Port                               |
| `REDIS_PASSWORD` | Optional                           |
| `REDIS_TLS`      | `true` or `false`. Default `false` |

### Email

| Variable                | Description                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `EMAIL_TRANSPORT`       | `ses` sends, `console` logs                                                                                        |
| `EMAIL_FROM`            | Sender address                                                                                                     |
| `EMAIL_FROM_NAME`       | Sender display name                                                                                                |
| `SES_CONFIGURATION_SET` | Named on every SES send; required with `ses`                                                                       |
| `SES_EVENTS_TOPIC_ARN`  | The SNS topic whose bounce and complaint events `POST /email/ses-events` accepts; unset, every delivery is refused |

### Storage and images

| Variable            | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| `STORAGE_TRANSPORT` | `s3` stores, `disabled` throws                                    |
| `AWS_S3_BUCKET`     | Bucket for uploads                                                |
| `AWS_S3_REGION`     | Bucket region                                                     |
| `AWS_REGION`        | Default region for the SDK                                        |
| `MEDIA_BUCKET_HOST` | Build-time. The one bucket hostname the image optimizer may fetch |

`MEDIA_BUCKET_HOST` is a build argument and is missing from `.env.example`. It is
a single literal hostname. A wildcard is refused, and an absent value means the
bucket is simply not on the allowlist. The image optimizer at `/_next/image` is
anonymous and hands whatever it fetches to `sharp`, so a wildcard there would let
a stranger choose the bytes the server decodes.

### Payments

| Variable                        | Description                             |
| ------------------------------- | --------------------------------------- |
| `PAYMENT_CHANNELS_TRANSPORT`    | `ssm` or `disabled`. Default `ssm`      |
| `PAYMENT_CHANNELS_SSM_PREFIX`   | Prefix of the twelve channel parameters |
| `PAYMENT_VALIDITY_DAYS`         | Default `30`                            |
| `PAYMENT_REMINDER_OFFSETS_DAYS` | Default `7,1`                           |
| `DUNNING_SWEEP_CRON`            | Default `0 6 * * *`                     |

Bank details, mobile money numbers and the notary's contact are read from SSM at
runtime through the SDK, not from the task definition. A wrong account number
sends a client's money to the wrong place, so it has to be correctable with one
command rather than a deploy. Nothing is optional and nothing may be blank: the
service fails at startup when the prefix is set and incomplete, and refuses to
compose a message when it is absent.

### Contact and newsletter

| Variable                    | Description                          |
| --------------------------- | ------------------------------------ |
| `CONTACT_INBOX_EMAIL`       | Where a contact request is announced |
| `CONTACT_DIGEST_CRON`       | Default `0 7 * * *`                  |
| `CONTACT_BACKOFFICE_LOCALE` | `fr` or `en`. Default `fr`           |
| `AWS_SES_CONTACT_LIST_NAME` | Default `kambriq-newsletter`         |

The daily digest is sent every day, zero included, so its absence is the signal.
An alert fires on a condition somebody predicted; the contact form sent nothing
for its entire life and no alert noticed.

### Bootstrap

| Variable               | Description                                  |
| ---------------------- | -------------------------------------------- |
| `BOOTSTRAP_SSM_PREFIX` | Prefix of the super-administrator parameters |

`prisma/bootstrap-admins.ts` reads these at runtime through the SSM SDK. The dev
deploy runs it unconditionally after the migrations and fails the deploy on a
non-zero exit. A missing or blank parameter therefore turns the deploy red, and
that is the design: the alternative is a deploy that silently skips creating an
administrator.

### Web build

These reach the image as build arguments. See
[Build-time variables](#build-time-variables-and-why-the-order-matters).

| Variable                        | Description                             |
| ------------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | API origin the browser calls            |
| `NEXT_PUBLIC_APP_URL`           | The site's own origin                   |
| `NEXT_PUBLIC_MAPBOX_TOKEN`      | Mapbox token for the map widget         |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project                          |
| `NEXT_PUBLIC_SANITY_DATASET`    | Sanity dataset                          |
| `SANITY_STUDIO_ORIGIN`          | Studio origin allowed to frame the site |
| `MEDIA_BUCKET_HOST`             | See above                               |

### Build identity

`GIT_SHA`, `GIT_REF`, `BUILD_TIME`, `IMAGE_TAG` and `APP_VERSION` are set by the
workflow from the commit being built and served by `GET /api/v1/health/version`.
Use that endpoint to find out what is actually running. A monotonic counter such
as an ECS revision number tells you something changed, not what is running.

### AWS credentials are not environment variables

On Fargate the SDK resolves them from the ECS task role through the default
provider chain. Locally it uses `~/.aws` or `AWS_PROFILE`.

`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` were once listed here and read by
`storage.service.ts` as a gate. They are never set on Fargate, so every upload
and download was dead until that gate was removed. **Do not reintroduce them.**
Two specs pin their removal.

---

## The Sanity CMS

The site's editorial and legal pages are written in Sanity rather than in the
repository. Eight editorial pages and eight legal pages, each in French and
English, are fetched at request time and rendered as Portable Text. Consent
recorded by the contact form points at an archived copy of the exact privacy
policy the visitor agreed to.

There are three moving parts:

1. **The Studio**, in `studio/`. Sanity's own hosted editor, deployed to
   Sanity's hosting. It is never built or shipped by this repository's images.
2. **Delivery**, in `apps/web/src/lib/cms/`. The web application queries Sanity
   directly with `@sanity/client`, anonymously, and renders the result.
3. **The archive**, in `apps/api/src/cms/`. When a legal policy is published,
   Sanity calls a webhook on the API, which renders the document to HTML and
   stores it in an append-only table.

### Why these choices

**The dataset is public and the delivery client sends no token.** Everything the
site reads is published content. A private dataset makes every CMS page answer 404.

**Delivery uses `@sanity/client`, not `next-sanity`.** Measured on 2026-09-26:
`next-sanity@13.3.4` declares `sanity` as a non-optional peer dependency, and
pnpm installs peers, so adding it pulls the entire Studio into the root install
that every CI job and both image builds pay for. 1846 lockfile entries against
128 for `@sanity/client` plus `@portabletext/react`. The cost of the choice is
`<SanityLive>` and the Presentation tool, neither of which is in use.

**The API version is pinned to `v2025-02-19`, not `latest`.** From that version
the client's default perspective is `published` rather than `raw`, which is what
keeps a draft away from a visitor.

**Document ids use hyphens and never dots.** In a public dataset Sanity treats
any document whose `_id` contains a period as private, which is the same rule
that hides `drafts.*`. An earlier id scheme used dots: the import succeeded, the
Studio listed every document, and every page on the site answered 404, because
the only caller without a token saw an empty dataset.

**The archive stores rendered HTML, not a reference.** Sanity keeps three days of
revision history on this project's plan, so a stored `_rev` stops resolving long
before anybody asks what a policy said. A consent record has to answer for as
long as the consent stands.

### The document model

Two document types, and every document is a singleton with a computed id.

| Type          | Slugs                                                          | Id                              |
| ------------- | -------------------------------------------------------------- | ------------------------------- |
| `legalPolicy` | `legal-mentions`, `legal-privacy`, `legal-rgpd`, `legal-terms` | `legalPolicy-<slug>-<language>` |
| `contentPage` | `about`, `methode`, `plan`, `verify`                           | `contentPage-<slug>-<language>` |

Languages are `fr` and `en`. Four slugs times two languages times two types is
sixteen documents, and there is no seventeenth. The create menu is empty, the
structure opens each document by id, and `slug` and `language` are read-only and
set by a template. Delivery is `*[_id == $id][0]`: by id rather than by a filter,
because a filter that matches two documents takes the first and reports nothing
wrong.

`verify` is served at `/products/verify`, not `/verify`.

What an editor may use in a body:

| Kind        | Allowed                                         |
| ----------- | ----------------------------------------------- |
| Block types | `block`, `divider`, `labelDefinitions`, `table` |
| Styles      | `normal`, `h2`, `h3`, `h4`, `blockquote`        |
| Marks       | `strong`, `em`, `code`, and a `link` annotation |
| Lists       | `bullet`, `number`                              |

There is no `h1`: the page heading comes from the translation files, so an `h1`
in a body would be a second top-level heading.

The style list is enforced in the Studio rather than at render time, and that is
deliberate. `@portabletext/react` merges its own default components under ours,
so an unknown style such as `h5` resolves to the library's unstyled heading and
never reaches the missing-component handler. A guard that cannot fire is not a
guard, so the style is simply not offered.

An unknown block **type** does throw, in both renderers. The default behaviour of
`@portabletext/to-html` is to emit `<div style="display:none">` and carry on,
which for an archive of what somebody consented to is the worst available
outcome: a complete-looking document with a clause missing and nothing saying so.

`labelDefinitions` carries no text of its own. The TFL, VEFL and VEFIL
definitions are code, in `libs/common/src/kbs/label-definitions.ts`, because the
KBS question bank is pinned to the same values and a definition an editor could
reword would be the same fact in two places with nothing comparing them.

### Environment variables

| Variable                        | Read by | Needed at         | Required                   | When it is absent                                                     |
| ------------------------------- | ------- | ----------------- | -------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | web     | build **and** run | No                         | No CMS. Every CMS page answers 404                                    |
| `NEXT_PUBLIC_SANITY_DATASET`    | web     | build **and** run | Yes, if the project is set | Both absent: no CMS. Project set, dataset absent: **the build fails** |
| `SANITY_STUDIO_ORIGIN`          | web     | build only        | No                         | `frame-ancestors 'none'`                                              |
| `SANITY_WEBHOOK_SECRET`         | API     | run               | For the webhook            | Every delivery answers 503 and is logged                              |
| `SANITY_STUDIO_PROJECT_ID`      | Studio  | Studio commands   | Yes                        | The Studio refuses to start                                           |
| `SANITY_STUDIO_DATASET`         | Studio  | Studio commands   | Yes                        | The Studio refuses to start                                           |
| `SANITY_STUDIO_HOST`            | Studio  | `sanity deploy`   | No                         | `sanity deploy` prompts for it                                        |

Every absent value fails closed. That is the right default in each case, and it
has a consequence worth stating: **a variable that never arrives looks exactly
like a variable somebody chose not to set.** An empty CMS and an unconfigured CMS
produce the same 404.

Malformed values do not fail closed, they fail loudly. A project id that is not a
valid project id, a dataset name that is not a valid dataset name, a bucket host
that is not a plain hostname, and a Studio origin that is a wildcard, a path or
plain http all fail the build and name the variable.

**`SANITY_STUDIO_ORIGIN` is a single literal origin.** Published guides suggest
`https://*.sanity.studio`. Anybody can create a Sanity project and be given a
subdomain there, so that pattern lets any Sanity customer's Studio frame this
site. The same reasoning applies to `cdn.sanity.io`, which is one hostname for
every Sanity customer: the image allowlist scopes it by path, to
`/images/<projectId>/`, so it is not a wildcard wearing a literal name.

### Build-time variables, and why the order matters

`apps/web` is built with `output: 'standalone'`. That freezes two things into the
build: the `images` configuration and the output of `headers()`. A value supplied
only to the running container therefore changes neither the image allowlist nor
the Content Security Policy.

A build-time variable has to be wired in three places, and a spec,
`build-vars-reach-the-image.spec.ts`, pins all three in both directions:

1. an `ARG` in `docker/Dockerfile.web`, before `next build`
2. a `build-args:` line in **both** workflows, `ci.yml` and `manual-deploy-dev.yml`
3. the GitHub repository variable that feeds it

Seven variables are wired this way: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_MAPBOX_TOKEN`, `MEDIA_BUCKET_HOST`, `NEXT_PUBLIC_SANITY_PROJECT_ID`,
`NEXT_PUBLIC_SANITY_DATASET` and `SANITY_STUDIO_ORIGIN`. An `ARG` the list does
not name fails the spec too.

**The two Sanity variables are also needed at runtime.** They are read through a
constant rather than as a literal `process.env.NEXT_PUBLIC_SANITY_PROJECT_ID`
expression, so Next does not inline them at build time. Measured: the variable
name survives as a string in the built standalone server. The production stage of
`docker/Dockerfile.web` sets only `PORT`, `HOSTNAME`, `NODE_ENV`, `APP_ENV`,
`AUTH_TRUST_HOST` and the build metadata, so **the web task definition must carry
both variables as well.** Task definitions live in the `kambriq-infra`
repository. Set them in the build and not in the task definition and the pages
answer 404, which is indistinguishable from having no project yet.

**Consequence for ordering: set the variables before the deploy, or rebuild after
setting them.** Nothing warns about this.

### Deploying the Studio

Everything below runs from `studio/`.

```bash
pnpm install --ignore-workspace
npx sanity login
npx sanity projects create kambriq     # prints the project id
cp .env.example .env                   # fill in SANITY_STUDIO_PROJECT_ID
pnpm validate
pnpm dev                               # http://localhost:3333
pnpm run deploy                        # https://<SANITY_STUDIO_HOST>.sanity.studio
```

Four things about those commands.

**`--ignore-workspace` is required.** Without it pnpm walks up, finds the
workspace root and refuses.

**Use `sanity projects create`, not `sanity init`.** `sanity init` scaffolds a
second studio into a new directory with an empty schema, and this codebase is
already the studio. The scaffold is harmless until somebody runs `sanity deploy`
from it, at which point editors get a Studio with none of these documents in it.

**`pnpm run deploy`, not `pnpm deploy`.** `deploy` is a pnpm builtin that deploys
a workspace package to a directory, so it shadows the script and fails with
`ERR_PNPM_NOTHING_TO_DEPLOY`. `dev`, `build` and `validate` are not builtins and
work either way.

**`pnpm build` does not validate the schema, it bundles one.** An object type with
no fields builds clean, exits 0, and produces a Studio that shows "Schema errors"
on the first page load. `pnpm validate` is the command that answers. Run it
before every deploy.

Nothing in CI touches `studio/`. `pnpm validate` and `pnpm typecheck` there are
run by hand.

### The archive and the webhook

| Item           | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Route          | `POST /api/v1/cms/webhooks/sanity`                                   |
| Authentication | HMAC-SHA256 over the raw request body, verified by `@sanity/webhook` |
| Table          | `PolicySnapshot` in the core database                                |
| Immutability   | A `BEFORE UPDATE OR DELETE` trigger that raises                      |
| Idempotence    | Unique on `(documentId, revision)`                                   |

The route is public in the sense that it carries no JWT, and the signature is
what authenticates it. The API must be started with `rawBody: true`, because a
signature over a re-serialised body is a signature over different bytes.

Creating the webhook is a script:

```bash
SANITY_PROJECT_ID=... \
SANITY_MANAGE_TOKEN=sk... \
SANITY_WEBHOOK_SECRET=... \
KAMBRIQ_API_URL=https://dev.kambriq.com \
  npx tsx scripts/sanity/upsert-policy-webhook.ts
```

Add `--check` to report the current state and write nothing. The script reads the
hook back after writing it, because the response to a write is what the server
accepted rather than what it stored.

`KAMBRIQ_API_URL` is the site's own origin and nothing else. The webhook path
already carries `/api/v1`.

Two limits of `@sanity/webhook` 4.0.4, read from its source. Nothing checks the
signature timestamp's age, so a captured delivery can be replayed; the unique
index is what makes a replay a no-op, so replay protection is structural rather
than in the guard. And the final comparison is a plain string comparison, not
constant-time.

### Consent

The contact form stores `consentPolicySnapshotId`, resolved on the server as the
newest archived revision of `legal-privacy` in the page's language. A consent
timestamp supplied by a browser is a claim about the past, so the column is the
server's.

Until a privacy policy has been published once in each language, there is no
snapshot to point at: a consent in that language records no version, the API logs
it at `error`, and the daily digest counts it. **Check both languages before the
contact form is live in production.**

### Content is written in the Studio, not imported

Decided on 2026-09-27. A new project's dataset is empty, so all sixteen pages
answer 404 until somebody writes them in the Studio.
`scripts/sanity/content/initial-content.ndjson` is kept for local development
only:

```bash
cd studio
npx sanity dataset import ../scripts/sanity/content/initial-content.ndjson --dataset production
```

**Never run that against a dataset somebody is editing.** An import overwrites,
and after the first write the dataset is the content rather than the file.

### Deployment checklist

In this order, because two of the steps cannot be reordered.

1. Create the Sanity project in the Kambriq organisation, dataset `production`,
   **public**.
2. Set the GitHub repository variables `NEXT_PUBLIC_SANITY_PROJECT_ID` and
   `NEXT_PUBLIC_SANITY_DATASET`. Both or neither: a project with no dataset fails
   the build on purpose.
3. Add the same two variables to the web task definition in `kambriq-infra`.
4. Deploy, or rebuild if the variables were set after a deploy.
5. Put `SANITY_WEBHOOK_SECRET` in SSM and in the API task definition, then run
   the upsert script.
6. Set `SANITY_STUDIO_PROJECT_ID` in `studio/.env` and run `pnpm run deploy`.
7. Write the sixteen documents in the Studio.
8. Verify: one row in `PolicySnapshot`, then submit the contact form and read
   `consentPolicySnapshotId` on the row.

---

## The web application

Two conventions will bite you if you do not know them.

**Every URL carries its locale.** `localePrefix: 'always'`, configured in
`apps/web/src/i18n/routing.ts`. Every page lives under `app/[locale]/`, which is
also the root layout: there is deliberately no `app/layout.tsx`, because two
files rendering `<html>` is invalid.

Navigation goes through `@/i18n/navigation`. `next/link` and `next/navigation`'s
`useRouter`, `usePathname` and `redirect` know nothing about the prefix, so they
produce URLs that resolve to nothing. A spec bans them and also bans a hardcoded
`/fr` in an href.

**The proxy asks `isProtected()`, never `!isPublic()`.** The matcher has to see
public paths in order to redirect an unprefixed URL to a locale, so being matched
no longer implies being protected. A negative matcher under that wider matcher
turns every typo into a redirect to the login page.

`PUBLIC_PATHS` matches on prefix. `/legal` is what makes `/legal/privacy`,
`/legal/terms`, `/legal/mentions` and `/legal/rgpd` public. Removing it sends
four legal pages to the login screen.

---

## API overview

All routes are prefixed with `/api/v1`. Every route is authenticated unless a
`@Public()` decorator removes it, because `JwtAuthGuard` and `RolesGuard` are
global.

There are 169 routes across 17 controllers, so the authoritative list is Swagger
at `/api/v1/docs`, or `route-guards.spec.ts`, which pins the public surface as a
list. A few worth naming because they are easy to guess wrong:

| Method | Path                            | Auth      | Description                        |
| ------ | ------------------------------- | --------- | ---------------------------------- |
| POST   | `/auth`                         | Public    | Register. Not `/auth/signup`       |
| POST   | `/auth/login`                   | Public    | Log in. Not `/auth/signin`         |
| POST   | `/auth/refresh`                 | Public    | Refresh the access token           |
| GET    | `/users/me`                     | Required  | Current user. Not `/users/profile` |
| GET    | `/kbs/me`                       | Required  | Candidate state and progress       |
| POST   | `/kbs/modules/:moduleId/quiz`   | Required  | Submit a module quiz               |
| POST   | `/kbs/exam/:examId/submit`      | Required  | Submit an exam. The id is required |
| GET    | `/kbs/public/verify/:kcaNumber` | Public    | Verify a certificate               |
| GET    | `/health/version`               | Public    | `gitSha`, `imageTag`, `buildTime`  |
| POST   | `/cms/webhooks/sanity`          | Signature | Archive a published policy         |

Every response is `{ success, data, meta? }`, including every error response.

### Roles

`ADMIN_GLOBAL` implies everything and is the only super administrator.
`ADMIN_LANDS` implies `AGENT` implies `CLIENT`. `ADMIN_KBS` implies
`CANDIDATE_KBS`. `ADMIN_KBS`, `ADMIN_KAMNET` and `ADMIN_LANDS` are lateral and
none inherits from another, so when you test a refusal, pick a role the hierarchy
does not imply.

The last active `ADMIN_GLOBAL` cannot be removed through any of four doors:
revoking the role, replacing the role set without it, blocking the account, or
the holder deleting their own account.

---

## Seed data

`pnpm db:seed` populates all four databases. Every account uses the password
`Test1234!`.

### Users

| Email                       | Role           | Notes               |
| --------------------------- | -------------- | ------------------- |
| `admin@kambriq.com`         | `ADMIN_GLOBAL` | Super administrator |
| `jean.kbs@kambriq.com`      | `ADMIN_KBS`    | KBS admin           |
| `claude.kamnet@kambriq.com` | `ADMIN_KAMNET` | Kamnet admin        |
| `pierre.lands@kambriq.com`  | `ADMIN_LANDS`  | Lands admin         |
| `eric.mbou@kambriq.com`     | `AGENT`        | AGT-2025-0001       |
| `sylvie.ngo@kambriq.com`    | `AGENT`        | AGT-2025-0002       |
| `boris.tcha@kambriq.com`    | `AGENT`        | AGT-2025-0003       |
| `amina.fall@kambriq.com`    | `AGENT`        | AGT-2025-0004       |
| `paul.fouda@kambriq.com`    | `AGENT`        | AGT-2025-0005       |

### Kamnet sponsorship tree

```text
Eric  (CONFIRMED, 6 sales)  <- root sponsor
  Sylvie (JUNIOR, 2 sales)
    Amina  (JUNIOR, 0 sales)
  Boris  (JUNIOR, 1 sale)
  Paul   (JUNIOR, 0 sales)
```

A sale pays the agent who made it and their direct sponsor, and nobody beyond.

### KBS

- 1 published course, 2 modules, 6 lessons
- 120 questions: 60 quiz, 30 per module against a quiz of 10, and 60 exam, 30 per
  module against an exam of 20. A three times pool in both cases, so retiring a
  question does not silently shrink the exercise
- 5 enrolled candidates at various stages
- 5 certificates, one per agent. These are **seeded artefacts, not earned**: they
  exist against zero exam rows, so do not read them as evidence that grading
  works

> **The KBS question bank has had no editorial and no legal validation pass.** It
> is fit to prove the engine and the journey. It is not fit to teach.

**A second course, KCA1, exists in the repository and is not part of the seed.**
`prisma/seed-data/kca1.ts` carries 4 parcours, 33 lessons and 80 questions, and
is loaded by `prisma/load-kca1.ts` and applied by `prisma/apply-kca1.ts`. No
workflow applies it. On an environment where it has been loaded there are two
courses and six modules, so the numbers above no longer describe that database,
and activating it is a second write: `apply-kca1.ts` does not set
`KbsSettings.activeCourseId`.

That second write is not optional. An active course that is not published
navigates and serves nothing: the dashboard reads the active course by id without
checking `isPublished`, while lesson and module reads require it.

### Lands

- 3 land labels, 20 parcels, 18 available
- 2 confirmed reservations, both on Eric's agent account. One is RESERVED and one
  is SOLD, and the SOLD one carries two Kamnet commissions
- The pool is larger than one pass consumes, and a re-run restores it

A reservation that carries a payment is skipped by the seed rather than deleted.
The payment ledger is append-only by trigger, so money that arrived is not test
data and a reset that could erase a receipt could erase evidence.

---

## Documentation

| Document                                                           | What it is                                          |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                           | Working rules, invariants, and the defect catalogue |
| [`docs/ops/registre-chantiers.md`](docs/ops/registre-chantiers.md) | The record of work: state and proof, one entry each |
| [`docs/adr/`](docs/adr/)                                           | Nine architecture decision records                  |
| [`docs/deploy-dev.md`](docs/deploy-dev.md)                         | Deploying to dev                                    |
| [`docs/deploy-prd.md`](docs/deploy-prd.md)                         | Deploying to production                             |
| [`studio/README.md`](studio/README.md)                             | The Sanity Studio in detail                         |

Infrastructure is in a separate repository, `kambriq-infra`, which owns the
Terraform and the task definitions.

---

## Contributing

- **Branch, then open a pull request.** Never merge or apply without explicit
  approval.
- **Never use `--no-verify`.** The hooks run commitlint, ESLint and Prettier. If a
  hook blocks you, fix the cause.
- **Commit subjects are lowercase**, enforced by commitlint.
- **Use plain hyphens in prose**, not em dashes.
- **Update the register in the same commit as the work it describes.** A chantier
  closed in code and left open in the register teaches people to distrust the
  register.
- **Update this README in the same pull request as a change that dates it.** A new
  variable, a renamed script, a new test layer, a moved file: if this file would
  now mislead a reader, it is part of the change.
- Do not add `Made-with: Cursor` to commits.

---

## License

MIT
