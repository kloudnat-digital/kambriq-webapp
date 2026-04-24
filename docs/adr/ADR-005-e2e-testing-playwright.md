# ADR-005: E2E Testing with Playwright

Date: 2026-04-17
Status: Accepted
Deciders: Kambriq Engineering Team

---

## Context and Problem Statement

The Kambriq platform had unit tests (Jest, for API and shared library code) but no automated
browser-level validation of the deployed web application. Critical flows - authentication,
public route accessibility, health endpoints, protected route redirects - were verified
manually after each deployment.

The risk: a broken auth redirect or a 500 on the login page could go undetected until a
user reports it.

---

## Decision Outcome

**Chosen: Playwright E2E tests, run against the deployed environment after every deploy**

Playwright is already installed (`@playwright/test ^1.36.0`, `@nx/playwright 22.6.5`).
The `apps/web-e2e/` scaffold was already present with a placeholder test.
This ADR documents the real test suite and CI integration built on that scaffold.

---

## Test Suite

All tests live in `apps/web-e2e/src/` and run via `pnpm test:e2e`.

### `health.spec.ts` - Health endpoint

| Test                                     | What it checks                              |
| ---------------------------------------- | ------------------------------------------- |
| `web /health returns 200 with status ok` | `GET /health` → HTTP 200, `{"status":"ok"}` |

Validates the web container is running and the health route is reachable by the ALB.

### `auth.spec.ts` - Authentication flow

| Test                                   | What it checks                                                    |
| -------------------------------------- | ----------------------------------------------------------------- |
| Login page renders form                | `GET /login` loads, shows email + password fields + submit button |
| Register page renders form             | `GET /register` loads, shows email + password fields              |
| Protected route redirects              | `GET /dashboard` → redirects to `/login` when unauthenticated     |
| Invalid credentials handled gracefully | Submit bad credentials → stays on login page, no 500              |

### `public-routes.spec.ts` - Public accessibility

Tests that the following routes return HTTP < 400 and do **not** redirect to `/login`:

`/`, `/login`, `/register`, `/about`, `/contact`, `/faq`, `/products`

i18n-aware: next-intl may redirect `/` → `/fr/` (French default). Tests allow locale-prefix
redirects but reject any redirect to `/login`.

---

## Configuration (`apps/web-e2e/playwright.config.ts`)

### `BASE_URL` env var

| Context                       | `BASE_URL`                | Web server                      |
| ----------------------------- | ------------------------- | ------------------------------- |
| Local dev (no `BASE_URL`)     | `http://localhost:3001`   | Auto-started (`nx run web:dev`) |
| CI post-deploy (BASE_URL set) | `https://dev.kambriq.com` | None (already deployed)         |
| CI post-prd-deploy            | `https://kambriq.com`     | None                            |

When `BASE_URL` is set, the local web server is not started. Tests point directly at the
deployed environment.

### Retries and browsers

| Setting  | Local | CI                              |
| -------- | ----- | ------------------------------- |
| Retries  | 0     | 1 (handles transient flakiness) |
| Workers  | 1     | 2                               |
| Chromium | ✅    | ✅                              |
| Firefox  | -     | ✅                              |
| WebKit   | -     | ✅                              |

---

## Scripts

| Script                 | What it does                                |
| ---------------------- | ------------------------------------------- |
| `pnpm test:e2e`        | Run E2E suite (local or CI, reads BASE_URL) |
| `pnpm test:web:e2e`    | Alias for Nx compatibility                  |
| `pnpm test:e2e:report` | Open Playwright HTML report                 |

---

## CI Integration

### After `deploy-dev` (develop push)

`.github/workflows/ci.yml` - `e2e` job:

```
push to develop
  └─► quality: lint + typecheck + test
  └─► build-api + build-web
  └─► deploy-dev (migrations + ECS rolling update + smoke test)
  └─► e2e                                    ← new
        Install Playwright browsers
        pnpm test:e2e
          BASE_URL = https://dev.kambriq.com  (from vars.NEXT_PUBLIC_APP_URL)
          CI = true  (enables Firefox + WebKit + retries)
        Upload playwright-report artifact (7-day retention)
```

The `e2e` job `needs: [deploy-dev]` - it only runs if the deploy succeeds.

### After `deploy-prd` (release tag)

`.github/workflows/deploy-prd.yml` - steps appended after smoke test:

```
v* tag → deploy-prd.yml
  ...
  smoke test (curl)
  pnpm test:e2e                              ← new
    BASE_URL = https://kambriq.com
    CI = true
  Upload playwright-report-prd artifact (30-day retention)
```

### Local development

```bash
# Start the dev server first (or let Playwright start it automatically)
pnpm docker:dev       # Start Postgres + Redis
pnpm start:dev        # Start NestJS API on :3000

# Run E2E tests (Playwright auto-starts Next.js on :3001)
pnpm test:e2e

# Open the HTML report after a run
pnpm test:e2e:report
```

---

## Artifacts

Playwright generates an HTML report after every CI run. It is uploaded as a GitHub Actions
artifact and retained for:

- `playwright-report` (dev): 7 days
- `playwright-report-prd` (prd): 30 days

To view a report: download the artifact zip, unzip, and open `index.html`. Or run
`pnpm test:e2e:report` locally after a run.

---

## What is NOT tested

| Scenario                             | Why excluded                                                           |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Full login with real credentials     | Would require test user secrets in CI; not needed to catch regressions |
| Dashboard / KBS / Lands page content | Too coupled to data; covered by unit tests                             |
| API endpoints directly               | Covered by NestJS unit tests and API smoke test                        |
| Performance / load                   | Not yet needed; add k6 when traffic patterns are known                 |

---

## Consequences

- **CI time**: E2E adds ~3-6 minutes to the develop push pipeline (Playwright installs + 3 browsers + test run). Accepted trade-off.
- **Flakiness**: Retries (`retries: 1` in CI) handle transient network hiccups against the deployed environment. Persistently flaky tests must be fixed, not skipped.
- **BASE_URL dependency**: E2E against the deployed URL requires the deploy to succeed first. If `deploy-dev` fails, the `e2e` job is skipped automatically (not a failure).
- **Cross-browser matrix**: Firefox and WebKit only run in CI to keep local iteration fast. Chromium runs everywhere.
- **No database seeding**: Tests are designed to work against a freshly deployed environment with no test data (only checks public pages and auth redirects).
